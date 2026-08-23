// supabase/functions/team-post-announcement/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true dans config.toml —
 *  avant même l'exécution de cette fonction). Ne JAMAIS faire confiance à
 *  un id envoyé dans le corps de la requête pour l'identité de l'appelant :
 *  n'importe qui pourrait sinon usurper n'importe quel autre compte. */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const posterId = getVerifiedUserId(req);
    const { cabinetRootId, message, targetId } = await req.json();
    if (!cabinetRootId || !message?.trim()) throw new Error("Paramètres manquants.");
    if (message.trim().length > 500) throw new Error("Message trop long (500 caractères maximum).");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const posterRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${posterId}&select=cabinet_role,cabinet_root_id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const posters = await posterRes.json();
    const poster = posters[0];
    const role = poster?.cabinet_role;
    if (role !== "root_director" && role !== "director") {
      throw new Error("Seuls les directeurs peuvent poster une annonce.");
    }

    // Autorité sur le cabinet ciblé : sans ce contrôle, un directeur du
    // cabinet A pourrait poster une annonce dans le cabinet B en devinant/
    // connaissant son cabinetRootId.
    const posterCabinetRootId = role === "root_director" ? posterId : poster.cabinet_root_id;
    if (cabinetRootId !== posterCabinetRootId) {
      throw new Error("Vous n'avez pas l'autorité pour poster dans ce cabinet.");
    }

    // Si un destinataire précis est choisi, vérifier qu'il fait bien
    // partie de l'équipe visible par celui qui poste (son propre courtier,
    // ou n'importe qui du cabinet si c'est le directeur racine).
    if (targetId) {
      const targetRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${targetId}&select=manager_id,cabinet_root_id`,
        { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
      );
      const targets = await targetRes.json();
      const target = targets[0];
      const allowed =
        target &&
        (target.manager_id === posterId || (role === "root_director" && target.cabinet_root_id === posterId));
      if (!allowed) throw new Error("Cette personne ne fait pas partie de votre équipe.");
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/team_announcements`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
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
});