// supabase/functions/team-get-announcements/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { requesterId } = await req.json();
    if (!requesterId) throw new Error("Paramètre manquant.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const requesterRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${requesterId}&select=cabinet_root_id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const requesters = await requesterRes.json();
    const cabinetRootId = requesters[0]?.cabinet_root_id;
    if (!cabinetRootId) throw new Error("Ce compte ne fait pas partie d'un cabinet.");

    // Visible : diffusé à tout le monde (target_id vide), ciblé sur moi,
    // ou posté par moi (pour garder mon propre historique même ciblé).
    const orFilter = `target_id.is.null,target_id.eq.${requesterId},posted_by.eq.${requesterId}`;
    const annRes = await fetch(
      `${supabaseUrl}/rest/v1/team_announcements?cabinet_root_id=eq.${cabinetRootId}&or=(${orFilter})&select=id,message,posted_by,target_id,created_at,profiles!posted_by(first_name,last_name)&order=created_at.desc&limit=10`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
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
});