const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true dans config.toml —
 *  avant même l'exécution de cette fonction). Ne JAMAIS faire confiance à
 *  un id envoyé dans le corps de la requête pour l'identité de l'appelant :
 *  n'importe qui pourrait sinon usurper n'importe quel autre compte. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Non authentifié.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Jeton invalide.");
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const payload = JSON.parse(atob(b64));
  if (!payload.sub) throw new Error("Jeton invalide.");
  return payload.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const brokerId = getVerifiedUserId(req);
    const { clientId, amountChf, description, returnUrl } = await req.json();

    if (!amountChf || amountChf < 80) {
      throw new Error("Le montant minimum de facturation est de 80 CHF.");
    }
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Récupérer le compte Connect du courtier
    const accountRes = await fetch(
      `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}&select=stripe_account_id,onboarding_complete`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
    );
    const accounts = await accountRes.json();

    if (!accounts.length || !accounts[0].onboarding_complete) {
      throw new Error("Compte bancaire non configuré. Veuillez d'abord connecter votre compte bancaire dans votre profil.");
    }

    const stripeAccountId = accounts[0].stripe_account_id;
    const amountCentimes = Math.round(amountChf * 100);

    // Commission 10% pour SwissBroker Pro
    const applicationFee = Math.round(amountCentimes * 0.10);

    // Récupère l'identité actuelle du client pour figer un instantané
    // au moment du paiement (empêche le déblocage PDF de survivre à un
    // changement d'identité sur la fiche client).
    let snapshot: {
      snapshot_first_name: string | null;
      snapshot_last_name: string | null;
      snapshot_date_of_birth: string | null;
      snapshot_gender: string | null;
      snapshot_nationality: string | null;
      snapshot_email: string | null;
    } = {
      snapshot_first_name: null,
      snapshot_last_name: null,
      snapshot_date_of_birth: null,
      snapshot_gender: null,
      snapshot_nationality: null,
      snapshot_email: null,
    };
    if (clientId) {
      // select inclut broker_id : sans cette vérification, n'importe quel
      // compte authentifié pourrait facturer un rendez-vous en désignant le
      // clientId d'un tout autre courtier, embarquant ses données
      // personnelles (nom, date de naissance, email) dans une facture qui
      // n'est pas la sienne.
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=broker_id,first_name,last_name,date_of_birth,gender,nationality,email`,
        { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
      );
      const clientBody = await clientRes.json();
      if (!clientRes.ok) {
        throw new Error("Erreur lors de la vérification du client.");
      }
      if (Array.isArray(clientBody) && clientBody.length > 0 && clientBody[0].broker_id !== brokerId) {
        throw new Error("Ce client n'appartient pas à votre compte.");
      }
      if (Array.isArray(clientBody) && clientBody.length > 0) {
        const c = clientBody[0];
        snapshot = {
          snapshot_first_name: c.first_name ?? null,
          snapshot_last_name: c.last_name ?? null,
          snapshot_date_of_birth: c.date_of_birth ?? null,
          snapshot_gender: c.gender ?? null,
          snapshot_nationality: c.nationality ?? null,
          snapshot_email: c.email ?? null,
        };
      } else {
        console.error("Aucun client trouvé pour clientId lors du snapshot:", clientId, JSON.stringify(clientBody));
      }
    } else {
      console.error("Aucun clientId transmis à stripe-rdv-invoice, snapshot impossible.");
    }

    // Créer un Payment Intent avec transfert automatique
    const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "amount": String(amountCentimes),
        "currency": "chf",
        "description": description || "Conseil en prévoyance SwissBroker Pro",
        "transfer_data[destination]": stripeAccountId,
        "application_fee_amount": String(applicationFee),
        "metadata[broker_id]": brokerId,
        "metadata[client_id]": clientId || "",
        "payment_method_types[]": "card",
      }).toString(),
    });
    const pi = await piRes.json();
    if (!piRes.ok) throw new Error(pi.error?.message ?? "Erreur création paiement");

    // Créer un Payment Link Stripe pour partager facilement
    const plRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "unit_amount": String(amountCentimes),
        "currency": "chf",
        "product_data[name]": description || "Conseil en prévoyance",
      }).toString(),
    });
    const price = await plRes.json();

    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "transfer_data[destination]": stripeAccountId,
        "application_fee_amount": String(applicationFee),
        "metadata[broker_id]": brokerId,
        "metadata[client_id]": clientId || "",
        "after_completion[type]": "hosted_confirmation",
        "after_completion[hosted_confirmation][custom_message]": "Merci pour votre paiement. Votre courtier a été notifié.",
      }).toString(),
    });
    const paymentLink = await linkRes.json();
    if (!linkRes.ok) throw new Error(paymentLink.error?.message ?? "Erreur création lien");

    // Sauvegarder la facture en base, avec l'instantané d'identité du client
    const invoiceInsertRes = await fetch(`${supabaseUrl}/rest/v1/rdv_invoices`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        broker_id: brokerId,
        client_id: clientId || null,
        amount_chf: amountCentimes,
        stripe_payment_intent_id: pi.id,
        stripe_payment_link: paymentLink.url,
        status: "pending",
        pdf_unlocked: false,
        ...snapshot,
      }),
    });
    if (!invoiceInsertRes.ok) {
      const errBody = await invoiceInsertRes.text();
      console.error("Erreur insertion rdv_invoices:", invoiceInsertRes.status, errBody);
    }

    return new Response(JSON.stringify({
      paymentLink: paymentLink.url,
      paymentIntentId: pi.id,
      amountChf,
      commission: applicationFee / 100,
      brokerReceives: (amountCentimes - applicationFee) / 100,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});