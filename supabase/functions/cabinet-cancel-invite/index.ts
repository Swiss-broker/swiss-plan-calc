// supabase/functions/cabinet-cancel-invite/index.ts
// Annule une invitation en attente : retire le siège de l'abonnement
// Stripe (fin de la facturation) et marque l'invitation comme révoquée.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inviteId, requesterId } = await req.json();
    if (!inviteId || !requesterId) throw new Error("Paramètres manquants.");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // Récupérer l'invitation, et vérifier que celui qui annule est bien
    // celui qui l'a envoyée (sécurité minimale : on ne laisse pas
    // n'importe qui annuler l'invitation de quelqu'un d'autre).
    const inviteRes = await fetch(
      `${supabaseUrl}/rest/v1/cabinet_invites?id=eq.${inviteId}&select=*`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } },
    );
    const invites = await inviteRes.json();
    const invite = invites[0];
    if (!invite) throw new Error("Invitation introuvable.");
    if (invite.invited_by !== requesterId) throw new Error("Vous ne pouvez annuler que vos propres invitations.");
    if (invite.status !== "pending") throw new Error("Cette invitation n'est plus en attente.");

    // Retirer le siège de l'abonnement Stripe, pour arrêter la facturation.
    if (invite.stripe_subscription_item_id) {
      await fetch(`https://api.stripe.com/v1/subscription_items/${invite.stripe_subscription_item_id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ proration_behavior: "always_invoice" }).toString(),
      });
    }

    await fetch(`${supabaseUrl}/rest/v1/cabinet_invites?id=eq.${inviteId}`, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ status: "revoked" }),
    });

    return new Response(JSON.stringify({ cancelled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});