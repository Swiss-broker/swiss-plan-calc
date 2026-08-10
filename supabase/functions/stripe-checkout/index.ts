// supabase/functions/stripe-checkout/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, brokerId, brokerEmail, coupon } = await req.json();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY manquante");
    }

    // Correspondance officielle priceId -> plan, definie cote serveur.
    // On ignore volontairement tout "plan" qui viendrait du navigateur :
    // c'est le prix reellement paye qui determine le plan accorde, jamais
    // une valeur envoyee par le client, qui pourrait etre falsifiee.
    const PRICE_TO_PLAN: Record<string, string> = {};
    const starterMonthly = Deno.env.get("STRIPE_STARTER_MONTHLY");
    const starterYearly = Deno.env.get("STRIPE_STARTER_YEARLY");
    const proMonthly = Deno.env.get("STRIPE_PRO_MONTHLY");
    const proYearly = Deno.env.get("STRIPE_PRO_YEARLY");
    const cabinetMonthly = Deno.env.get("STRIPE_CABINET_MONTHLY");
    const cabinetYearly = Deno.env.get("STRIPE_CABINET_YEARLY");

    if (starterMonthly) PRICE_TO_PLAN[starterMonthly] = "starter";
    if (starterYearly) PRICE_TO_PLAN[starterYearly] = "starter";
    if (proMonthly) PRICE_TO_PLAN[proMonthly] = "pro";
    if (proYearly) PRICE_TO_PLAN[proYearly] = "pro";
    if (cabinetMonthly) PRICE_TO_PLAN[cabinetMonthly] = "cabinet";
    if (cabinetYearly) PRICE_TO_PLAN[cabinetYearly] = "cabinet";

    const resolvedPlan = PRICE_TO_PLAN[priceId];
    if (!resolvedPlan) {
      throw new Error("priceId inconnu ou non autorisé");
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch";

    const params: Record<string, string> = {
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "customer_email": brokerEmail,
      "client_reference_id": brokerId ?? "",
      // Après paiement → page de connexion (pas le dashboard)
      "success_url": `${siteUrl}/auth?paiement=ok`,
      "cancel_url": `${siteUrl}/`,
      // Le plan transmis au webhook est celui resolu cote serveur, pas
      // celui envoye par le navigateur.
      "metadata[plan]": resolvedPlan,
      "metadata[broker_id]": brokerId ?? "",
      "subscription_data[metadata][plan]": resolvedPlan,
      // Période d'essai 3 jours sur tous les plans
      "subscription_data[trial_period_days]": "3",
    };

    if (coupon) {
      params["discounts[0][coupon]"] = coupon;
    }

    const body = new URLSearchParams(params);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      throw new Error(session.error?.message ?? "Erreur Stripe");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});