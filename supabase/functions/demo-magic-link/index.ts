const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleDemoMagicLinkRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const callerId = getVerifiedUserId(req);
    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // L'email cible est TOUJOURS dérivé du compte appelant lui-même (jamais
    // du body) : impossible de générer un lien de connexion pour quelqu'un
    // d'autre. Seul un compte réellement plan='demo' peut emprunter ce
    // chemin — vérifié ici, côté serveur.
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${callerId}&select=email,plan`,
      { headers: svcHeaders },
    );
    const profiles = await profileRes.json();
    const profile = profiles[0];
    if (!profile || profile.plan !== "demo") {
      throw new Error("Réservé aux comptes en mode démo.");
    }

    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: svcHeaders,
      body: JSON.stringify({
        type: "magiclink",
        email: profile.email,
        redirect_to: "https://swissbrokerpro.ch/dashboard",
      }),
    });
    const linkBody = await linkRes.json();
    if (!linkRes.ok) {
      throw new Error(linkBody?.msg || linkBody?.error_description || "Échec de la génération du lien.");
    }
    const actionLink = linkBody?.properties?.action_link;
    if (!actionLink) throw new Error("Réponse inattendue de l'API.");

    return new Response(JSON.stringify({ ok: true, actionLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleDemoMagicLinkRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
