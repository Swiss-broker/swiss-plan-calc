// supabase/functions/stripe-webhook/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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
    if (!stripeKey || !supabaseUrl || !supabaseKey) {
      throw new Error("Variables d'environnement manquantes");
    }

    const body = await req.text();
    const event = JSON.parse(body);

    const updatePlan = async (email: string, plan: string) => {
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
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details?.email ?? session.customer_email;
      const brokerId = session.metadata?.broker_id;
      const clientId = session.metadata?.client_id;

      // ── Paiement RDV courtier (Payment Link) ──
      if (brokerId) {
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
        if (email) await updatePlan(email, plan);
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
        await updatePlan(customer.email, "expired");

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
      if (customer.email) await updatePlan(customer.email, "expired");
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