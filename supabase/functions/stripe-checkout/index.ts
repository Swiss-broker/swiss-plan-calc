// supabase/functions/stripe-checkout/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche qu'un checkout
// soit rattache a l'identite de quelqu'un d'autre.
function getCallerFromJwt(req: Request): { id: string; email: string | null } | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub !== "string") return null;
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}

export type Env = {
  stripeKey: string;
  starterMonthly?: string;
  starterYearly?: string;
  proMonthly?: string;
  proYearly?: string;
  cabinetMonthly?: string;
  cabinetYearly?: string;
  siteUrl: string;
};

export async function handleStripeCheckoutRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, coupon } = await req.json();
    const { stripeKey } = env;

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY manquante");
    }

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;
    const brokerEmail = caller.email ?? undefined;

    // Correspondance officielle priceId -> plan, definie cote serveur.
    // On ignore volontairement tout "plan" qui viendrait du navigateur :
    // c'est le prix reellement paye qui determine le plan accorde, jamais
    // une valeur envoyee par le client, qui pourrait etre falsifiee.
    const PRICE_TO_PLAN: Record<string, string> = {};
    const { starterMonthly, starterYearly, proMonthly, proYearly, cabinetMonthly, cabinetYearly } =
      env;

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

    const { siteUrl } = env;

    const params: Record<string, string> = {
      "payment_method_types[0]": "card",
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: brokerEmail,
      client_reference_id: brokerId ?? "",
      // Après paiement → page de connexion (pas le dashboard)
      success_url: `${siteUrl}/auth?paiement=ok`,
      cancel_url: `${siteUrl}/`,
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
        Authorization: `Bearer ${stripeKey}`,
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
}

// `Deno` n'existe pas sous Node/Vitest : ce garde-fou permet d'importer ce
// fichier depuis les tests sans jamais tenter de demarrer un vrai serveur
// Deno en dehors du runtime Edge Functions.
declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleStripeCheckoutRequest(req, {
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
      starterMonthly: Deno.env.get("STRIPE_STARTER_MONTHLY"),
      starterYearly: Deno.env.get("STRIPE_STARTER_YEARLY"),
      proMonthly: Deno.env.get("STRIPE_PRO_MONTHLY"),
      proYearly: Deno.env.get("STRIPE_PRO_YEARLY"),
      cabinetMonthly: Deno.env.get("STRIPE_CABINET_MONTHLY"),
      cabinetYearly: Deno.env.get("STRIPE_CABINET_YEARLY"),
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
