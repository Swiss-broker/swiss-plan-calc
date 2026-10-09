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
  cotisationPriceId?: string;
  siteUrl: string;
};

export async function handleStripeCheckoutRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { coupon } = await req.json();
    const { stripeKey, cotisationPriceId } = env;

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY manquante");
    }
    // Un seul produit (cotisation annuelle) : pas de priceId envoyé par le
    // navigateur, pas de correspondance à résoudre — le prix vient
    // uniquement du secret serveur STRIPE_COTISATION_ANNUELLE.
    if (!cotisationPriceId) {
      throw new Error("STRIPE_COTISATION_ANNUELLE manquant (secret non configuré).");
    }

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;
    const brokerEmail = caller.email ?? undefined;

    const { siteUrl } = env;

    const params: Record<string, string> = {
      "payment_method_types[0]": "card",
      mode: "subscription",
      "line_items[0][price]": cotisationPriceId,
      "line_items[0][quantity]": "1",
      customer_email: brokerEmail,
      client_reference_id: brokerId ?? "",
      // Après paiement → page de connexion (pas le dashboard)
      success_url: `${siteUrl}/auth?paiement=ok`,
      cancel_url: `${siteUrl}/`,
      "metadata[plan]": "active",
      "metadata[broker_id]": brokerId ?? "",
      "subscription_data[metadata][plan]": "active",
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
      cotisationPriceId: Deno.env.get("STRIPE_COTISATION_ANNUELLE"),
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
