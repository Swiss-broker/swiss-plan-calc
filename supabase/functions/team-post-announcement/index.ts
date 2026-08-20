// supabase/functions/team-post-announcement/index.ts
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

export async function handleTeamPostAnnouncementRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, targetId } = await req.json();
    if (!message?.trim()) throw new Error("Paramètres manquants.");
    if (message.trim().length > 500) throw new Error("Message trop long (500 caractères maximum).");

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const posterId = caller.id;

    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // cabinetRootId n'est plus lu depuis le body (un attaquant aurait pu y
    // mettre le cabinet de quelqu'un d'autre) : il est toujours derive du
    // profil reel du posteur, jamais d'une valeur fournie par l'appelant.
    const posterRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${posterId}&select=cabinet_role,cabinet_root_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const posters = await posterRes.json();
    const posterProfile = posters[0];
    const role = posterProfile?.cabinet_role;
    if (role !== "root_director" && role !== "director") {
      throw new Error("Seuls les directeurs peuvent poster une annonce.");
    }
    const cabinetRootId = posterProfile.cabinet_root_id;
    if (!cabinetRootId) throw new Error("Ce compte ne fait pas partie d'un cabinet.");

    // Si un destinataire précis est choisi, vérifier qu'il fait bien
    // partie de l'équipe visible par celui qui poste (son propre courtier,
    // ou n'importe qui du cabinet si c'est le directeur racine).
    if (targetId) {
      const targetRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${targetId}&select=manager_id,cabinet_root_id`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      const targets = await targetRes.json();
      const target = targets[0];
      const allowed =
        target &&
        (target.manager_id === posterId ||
          (role === "root_director" && target.cabinet_root_id === posterId));
      if (!allowed) throw new Error("Cette personne ne fait pas partie de votre équipe.");
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/team_announcements`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        cabinet_root_id: cabinetRootId,
        posted_by: posterId,
        message: message.trim(),
        target_id: targetId ?? null,
      }),
    });
    const body = await insertRes.json();
    if (!insertRes.ok) throw new Error("Erreur lors de la publication.");

    return new Response(JSON.stringify({ posted: true, announcement: body[0] }), {
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
    handleTeamPostAnnouncementRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
