// @ts-ignore
// supabase-edge-function-config: {"verify_jwt": false}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY manquante");
    if (!sessionId) throw new Error("sessionId manquant");

    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      {
        headers: { "Authorization": `Bearer ${stripeKey}` },
      }
    );

    const session = await response.json();

    if (!response.ok) throw new Error(session.error?.message ?? "Erreur Stripe");

    return new Response(
      JSON.stringify({
        email: session.customer_details?.email ?? session.customer_email ?? "",
        plan: session.metadata?.plan ?? "active",
        status: session.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
