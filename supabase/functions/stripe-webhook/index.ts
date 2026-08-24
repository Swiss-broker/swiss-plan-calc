// supabase/functions/stripe-webhook/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Verifie que la requete vient bien de Stripe, en recalculant la signature
// attendue a partir du corps brut et du secret partage, puis en comparant
// au contenu de l'en-tete Stripe-Signature. Sans ca, n'importe qui pourrait
// appeler cet endpoint avec un faux evenement "paiement reussi".
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.signatures.includes(expectedSignature);
}

// supabase/functions/stripe-webhook/index.ts
// Remplace uniquement la fonction sendBrevoEmail par cette version avec logs
async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, email non envoyé");
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SwissBroker Pro", email: "noreply@swissbrokerpro.ch" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  // On log systématiquement la réponse de Brevo pour voir si elle refuse la requête
  const resBody = await res.text();
  console.log(`Brevo status: ${res.status}, réponse: ${resBody}`);
}

// Insère une notification cloche pour un courtier via l'API REST Supabase
async function createNotification(
  supabaseUrl: string,
  supabaseKey: string,
  brokerId: string,
  type: string,
  title: string,
  body: string,
  link: string
) {
  await fetch(`${supabaseUrl}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ broker_id: brokerId, type, title, body, link }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !supabaseUrl || !supabaseKey || !webhookSecret) {
      throw new Error("Variables d'environnement manquantes");
    }

    // Le corps brut doit etre lu AVANT d'etre parse en JSON, la signature
    // porte sur le texte exact recu, pas sur une reserialisation.
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Requete rejetee : en-tete stripe-signature absent");
      return new Response(JSON.stringify({ error: "Signature manquante" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Requete rejetee : signature invalide, evenement non authentique");
      return new Response(JSON.stringify({ error: "Signature invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);

    // Journalise chaque changement de plan dans plan_events, avec sa raison,
    // pour que le panel admin puisse voir les échecs de paiement et
    // résiliations récents (aujourd'hui invisibles : le webhook changeait
    // juste profiles.plan sans laisser aucune trace).
    const updatePlan = async (
      email: string,
      plan: string,
      reason: "checkout_completed" | "subscription_deleted" | "payment_failed",
    ) => {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,plan`,
        { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
      );
      const profiles = await profileRes.json();
      const profile = profiles[0];
      if (!profile) return;

      await fetch(
        `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ plan }),
        }
      );

      if (profile.plan !== plan) {
        await fetch(`${supabaseUrl}/rest/v1/plan_events`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            broker_id: profile.id,
            previous_plan: profile.plan,
            new_plan: plan,
            reason,
            stripe_event_id: event.id ?? null,
          }),
        });
      }
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details?.email ?? session.customer_email;
      const brokerId = session.metadata?.broker_id;
      const clientId = session.metadata?.client_id;

      // ── Paiement RDV courtier (Payment Link) ──
      if (session.mode === "payment") {
        const amountTotal = session.amount_total ?? 0;
        const amountChf = amountTotal / 100;
        const commission = Math.round(amountTotal * 0.10) / 100;
        const brokerReceives = amountChf - commission;
        const paymentIntentId = session.payment_intent;

        // Mettre à jour la facture
        await fetch(
          `${supabaseUrl}/rest/v1/rdv_invoices?broker_id=eq.${brokerId}&status=eq.pending`,
          {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({
              status: "paid",
              pdf_unlocked: true,
              stripe_payment_intent_id: paymentIntentId,
            }),
          }
        );

        // Récupérer l'email du courtier
        const brokerRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}&select=email,first_name`,
          { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
        );
        const brokers = await brokerRes.json();
        const broker = brokers[0];

        // Récupérer le nom du client pour personnaliser la notification
        let clientName = "un client";
        if (clientId) {
          const clientRes = await fetch(
            `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=first_name,last_name`,
            { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
          );
          const clientsData = await clientRes.json();
          const client = clientsData[0];
          if (client) clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
        }

        // Créer la notification cloche, en plus de l'email déjà existant
        if (clientId) {
          await createNotification(
            supabaseUrl,
            supabaseKey,
            brokerId,
            "payment_received",
            `Paiement reçu — ${amountChf.toFixed(2)} CHF`,
            `${clientName} a réglé sa consultation. Vous recevrez ${brokerReceives.toFixed(2)} CHF.`,
            `/clients/${clientId}`
          );
        }

        if (broker?.email) {
          await sendBrevoEmail(
            broker.email,
            `Paiement reçu — ${amountChf.toFixed(2)} CHF`,
            `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0f766e;">Paiement reçu 💶</h2>
              <p>Bonjour ${broker.first_name ?? ""},</p>
              <p>${clientName} vient de régler sa consultation.</p>
              <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold;">Montant total</td>
                  <td style="padding:8px 12px;">${amountChf.toFixed(2)} CHF</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;">Commission SwissBroker Pro (10%)</td>
                  <td style="padding:8px 12px;">- ${commission.toFixed(2)} CHF</td>
                </tr>
                <tr style="background:#f0fdf4;">
                  <td style="padding:8px 12px; font-weight:bold;">Vous recevrez</td>
                  <td style="padding:8px 12px; font-weight:bold; color:#0f766e;">${brokerReceives.toFixed(2)} CHF</td>
                </tr>
              </table>
              <p>Le PDF de synthèse du rendez-vous est désormais débloqué dans la fiche de votre client.</p>
              <p style="color:#999; font-size:12px;">SwissBroker Pro — Piliarys</p>
            </div>
            `
          );
        }
      } else {
        // ── Abonnement SwissBroker Pro ──
        const plan = session.metadata?.plan ?? "pro";
        if (email) {
          // Cas particulier : ce paiement correspond à un courtier qui
          // rejoint le cabinet de quelqu'un d'autre (il paie son propre
          // siège), retrouvé via son invitation en attente. Le rattachement
          // ne se fait qu'ici, maintenant que le paiement est confirmé.
          const pendingInviteRes = await fetch(
            `${supabaseUrl}/rest/v1/cabinet_invites?email=eq.${encodeURIComponent(email)}&payer=eq.self&status=eq.pending&order=created_at.desc&limit=1`,
            { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
          );
          const pendingInvites = await pendingInviteRes.json();
          const pendingInvite = pendingInvites[0];

          if (pendingInvite) {
            const managerId =
              pendingInvite.role === "director" ? pendingInvite.cabinet_root_id : pendingInvite.invited_by;

            await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
              method: "PATCH",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({
                plan: "cabinet",
                manager_id: managerId,
                cabinet_root_id: pendingInvite.cabinet_root_id,
                cabinet_role: pendingInvite.role,
              }),
            });

            await fetch(`${supabaseUrl}/rest/v1/cabinet_invites?id=eq.${pendingInvite.id}`, {
              method: "PATCH",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({ status: "accepted", accepted_at: new Date().toISOString() }),
            });

            await createNotification(
              supabaseUrl,
              supabaseKey,
              pendingInvite.invited_by,
              "team_member_joined",
              "Nouveau membre dans votre équipe",
              `Un ${pendingInvite.role === "director" ? "directeur" : "courtier"} a rejoint votre équipe après avoir réglé son propre accès.`,
              "/team"
            );
          } else {
            // Cas normal : quelqu'un souscrit lui-même au plan Cabinet
            // pour créer son propre cabinet (devient Directeur racine).
            await updatePlan(email, plan, "checkout_completed");
            if (plan === "cabinet") {
              const profileRes = await fetch(
                `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,cabinet_role`,
                { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
              );
              const profiles = await profileRes.json();
              const profile = profiles[0];
              if (profile && !profile.cabinet_role) {
                await fetch(
                  `${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      "apikey": supabaseKey,
                      "Authorization": `Bearer ${supabaseKey}`,
                      "Content-Type": "application/json",
                      "Prefer": "return=minimal",
                    },
                    body: JSON.stringify({ cabinet_role: "root_director", cabinet_root_id: profile.id }),
                  }
                );
              }
            }
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${subscription.customer}`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const customer = await customerRes.json();
      if (customer.email) {
        await updatePlan(customer.email, "expired", "subscription_deleted");

        // Cascade : si ce compte avait lui-même invité des membres cabinet
        // (courtiers ou directeurs) sur ce même abonnement désormais résilié,
        // leur accès doit être coupé aussi, puisque plus personne ne paie
        // pour eux. On ne descend qu'un seul niveau : les membres qu'EUX
        // auraient invités à leur tour restent inchangés, puisqu'ils sont
        // facturés sur un abonnement distinct, propre à ce sous-directeur.
        const ownerRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(customer.email)}&select=id`,
          { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
        );
        const owners = await ownerRes.json();
        const ownerId = owners[0]?.id;
        if (ownerId) {
          // Snapshot des membres affectés AVANT le PATCH en masse, pour
          // pouvoir journaliser leur plan précédent individuellement (le
          // panel admin doit pouvoir voir que ces courtiers ont perdu
          // l'accès en cascade, pas juste le directeur qui a résilié).
          const membersRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?manager_id=eq.${ownerId}&select=id,plan`,
            { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
          );
          const members: { id: string; plan: string }[] = await membersRes.json();

          await fetch(
            `${supabaseUrl}/rest/v1/profiles?manager_id=eq.${ownerId}`,
            {
              method: "PATCH",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({ plan: "expired" }),
            }
          );

          for (const member of members) {
            if (member.plan === "expired") continue;
            await fetch(`${supabaseUrl}/rest/v1/plan_events`, {
              method: "POST",
              headers: {
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
              },
              body: JSON.stringify({
                broker_id: member.id,
                previous_plan: member.plan,
                new_plan: "expired",
                reason: "subscription_deleted",
                stripe_event_id: event.id ?? null,
              }),
            });
          }
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/${invoice.customer}`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const customer = await customerRes.json();
      if (customer.email) await updatePlan(customer.email, "expired", "payment_failed");
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const brokerId = pi.metadata?.broker_id;
      if (brokerId) {
        await fetch(
          `${supabaseUrl}/rest/v1/rdv_invoices?stripe_payment_intent_id=eq.${pi.id}`,
          {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ status: "paid", pdf_unlocked: true }),
          }
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});