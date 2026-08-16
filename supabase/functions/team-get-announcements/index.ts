// supabase/functions/team-get-announcements/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body. Decoder le payload
// sans re-verifier la signature est donc sur ici, et empeche toute
// usurpation d'identite via un id envoye par l'appelant.
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

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleTeamGetAnnouncementsRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const requesterId = caller.id;

    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const requesterRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${requesterId}&select=cabinet_root_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const requesters = await requesterRes.json();
    const cabinetRootId = requesters[0]?.cabinet_root_id;
    if (!cabinetRootId) throw new Error("Ce compte ne fait pas partie d'un cabinet.");

    // Visible : diffusé à tout le monde (target_id vide), ciblé sur moi,
    // ou posté par moi (pour garder mon propre historique même ciblé).
    const orFilter = `target_id.is.null,target_id.eq.${requesterId},posted_by.eq.${requesterId}`;
    const annRes = await fetch(
      `${supabaseUrl}/rest/v1/team_announcements?cabinet_root_id=eq.${cabinetRootId}&or=(${orFilter})&select=id,message,posted_by,target_id,created_at,profiles!posted_by(first_name,last_name)&order=created_at.desc&limit=10`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const announcements = await annRes.json();

    return new Response(JSON.stringify({ announcements }), {
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
    handleTeamGetAnnouncementsRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
