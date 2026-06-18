const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brokerId, clientId, amountChf, description, returnUrl } = await req.json();
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

    // Sauvegarder la facture en base
    await fetch(`${supabaseUrl}/rest/v1/rdv_invoices`, {
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
      }),
    });

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
