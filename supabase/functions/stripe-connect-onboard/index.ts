const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche qu'un
// utilisateur cree/pilote le compte Stripe Connect de quelqu'un d'autre.
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

export type Env = { supabaseUrl: string; supabaseKey: string; stripeKey: string };

export async function handleStripeConnectOnboardRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { returnUrl } = await req.json();

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;

    const { supabaseUrl, supabaseKey, stripeKey } = env;
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Email de secours pour la creation du compte Connect si le JWT n'en
    // porte pas (cas rare) : lu depuis le profil, jamais depuis le body.
    let brokerEmail: string | undefined = caller.email ?? undefined;
    if (!brokerEmail) {
      const profRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}&select=email`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      const profRows = await profRes.json();
      brokerEmail = profRows[0]?.email;
    }
    if (!brokerEmail) throw new Error("Email du courtier introuvable.");

    // Vérifier si le courtier a déjà un compte Connect
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}&select=stripe_account_id,onboarding_complete`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
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
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          type: "express",
          email: brokerEmail,
          country: "CH",
          "capabilities[transfers][requested]": "true",
          business_type: "individual",
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
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
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
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: stripeAccountId,
        refresh_url: `${returnUrl}?connect=refresh`,
        return_url: `${returnUrl}?connect=success`,
        type: "account_onboarding",
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
    handleStripeConnectOnboardRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
    }),
  );
}
