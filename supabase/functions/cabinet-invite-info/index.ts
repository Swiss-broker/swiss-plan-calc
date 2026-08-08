// supabase/functions/cabinet-invite-info/index.ts
// Renvoie les infos publiques d'une invitation (rôle, qui paie), pour que
// la page d'inscription sache si elle doit rediriger vers un paiement ou
// non après la création du compte. Ne renvoie jamais d'infos sensibles.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) throw new Error("Token manquant.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const res = await fetch(
      `${supabaseUrl}/rest/v1/cabinet_invites?token=eq.${token}&status=eq.pending&select=role,payer,expires_at`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const rows = await res.json();
    const invite = rows[0];
    if (!invite) throw new Error("Invitation introuvable ou déjà utilisée.");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Cette invitation a expiré.");

    return new Response(JSON.stringify({ role: invite.role, payer: invite.payer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});