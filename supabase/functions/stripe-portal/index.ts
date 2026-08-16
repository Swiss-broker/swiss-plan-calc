const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche qu'un
// utilisateur ouvre le portail de facturation Stripe de quelqu'un d'autre.
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

export type Env = { stripeKey: string; siteUrl: string };

export async function handleStripePortalRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const caller = getCallerFromJwt(req);
    if (!caller?.email) throw new Error("Authentification requise.");
    const brokerEmail = caller.email;

    const { stripeKey, siteUrl } = env;
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY manquante");

    // Cherche le customer Stripe par email
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(brokerEmail)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const searchData = await searchRes.json();
    const customer = searchData.data?.[0];
    if (!customer) throw new Error("Client Stripe introuvable");

    // Génère le lien du portail client
    const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
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
    handleStripePortalRequest(req, {
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swiss-plan-calc.vercel.app",
    }),
  );
}
