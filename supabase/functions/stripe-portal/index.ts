const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { brokerEmail } = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://swiss-plan-calc.vercel.app";

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY manquante");

    // Cherche le customer Stripe par email
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(brokerEmail)}&limit=1`,
      { headers: { "Authorization": `Bearer ${stripeKey}` } }
    );
    const searchData = await searchRes.json();
    const customer = searchData.data?.[0];
    if (!customer) throw new Error("Client Stripe introuvable");

    // Génère le lien du portail client
    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customer.id,
        return_url: `${siteUrl}/account`,
      }).toString(),
    });

    const portal = await portalRes.json();
    if (!portalRes.ok) throw new Error(portal.error?.message ?? "Erreur portail");

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
