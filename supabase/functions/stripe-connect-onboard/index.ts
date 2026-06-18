const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brokerId, brokerEmail, returnUrl } = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Vérifier si le courtier a déjà un compte Connect
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}&select=stripe_account_id,onboarding_complete`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
    );
    const existing = await existingRes.json();

    let stripeAccountId: string;

    if (existing.length > 0) {
      stripeAccountId = existing[0].stripe_account_id;
    } else {
      // Créer un nouveau compte Connect Express
      const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "type": "express",
          "email": brokerEmail,
          "country": "CH",
          "capabilities[transfers][requested]": "true",
          "business_type": "individual",
          "metadata[broker_id]": brokerId,
        }).toString(),
      });
      const account = await accountRes.json();
      if (!accountRes.ok) throw new Error(account.error?.message ?? "Erreur création compte");
      stripeAccountId = account.id;

      // Sauvegarder en base
      await fetch(`${supabaseUrl}/rest/v1/broker_connect_accounts`, {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          broker_id: brokerId,
          stripe_account_id: stripeAccountId,
          onboarding_complete: false,
        }),
      });
    }

    // Générer le lien d'onboarding
    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "account": stripeAccountId,
        "refresh_url": `${returnUrl}?connect=refresh`,
        "return_url": `${returnUrl}?connect=success`,
        "type": "account_onboarding",
      }).toString(),
    });
    const link = await linkRes.json();
    if (!linkRes.ok) throw new Error(link.error?.message ?? "Erreur lien onboarding");

    return new Response(JSON.stringify({ url: link.url, accountId: stripeAccountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
