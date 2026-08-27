// supabase/functions/admin-set-broker-plan/index.ts
// Change le plan d'un courtier depuis le panel admin (swiss-broker-admin,
// dépôt séparé mais même projet Supabase). Réservé aux administrateurs
// (admin_users) : la colonne profiles.plan n'a volontairement aucun GRANT
// UPDATE côté client (authenticated), même pour un admin, afin qu'aucun
// courtier ne puisse jamais s'auto-attribuer un plan payant en modifiant
// sa propre fiche. Toute écriture de plan passe donc obligatoirement par
// ici, avec vérification serveur de l'appartenance à admin_users.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PLANS = new Set([
  "free",
  "pro",
  "enterprise",
  "trial",
  "starter",
  "cabinet",
  "internal",
  "expired",
]);

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
    const callerId = getVerifiedUserId(req);
    const { brokerId, plan } = await req.json();
    if (!brokerId || typeof brokerId !== "string") throw new Error("brokerId manquant.");
    if (!plan || !ALLOWED_PLANS.has(plan)) throw new Error("Plan invalide.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // Seuls les membres de admin_users peuvent changer le plan d'un
    // courtier. Vérifié côté serveur via service role, jamais confié au
    // client.
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id`,
      { headers: svcHeaders },
    );
    const adminRows = await adminRes.json();
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      throw new Error("Réservé aux administrateurs.");
    }

    const brokerRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}&select=id,plan,cabinet_role`,
      { headers: svcHeaders },
    );
    const brokerRows = await brokerRes.json();
    if (!Array.isArray(brokerRows) || brokerRows.length === 0) {
      throw new Error("Courtier introuvable.");
    }
    const previousPlan = brokerRows[0].plan;

    // Un courtier rattaché à un cabinet (cabinet_role non nul) que l'admin
    // repasse manuellement sur un autre plan doit aussi perdre son
    // rattachement (cabinet_role/cabinet_root_id/manager_id) : sinon il
    // garde un role/cabinet perime pendant que son plan a change ailleurs,
    // meme incohérence que corrigée côté webhook Stripe pour une résiliation.
    const detachFromCabinet = plan !== "cabinet" && !!brokerRows[0].cabinet_role;

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${brokerId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify(
        detachFromCabinet
          ? { plan, cabinet_role: null, cabinet_root_id: null, manager_id: null }
          : { plan },
      ),
    });
    if (!updateRes.ok) {
      const detail = await updateRes.text();
      throw new Error(`Échec de la mise à jour du plan : ${detail}`);
    }

    // Journalise le changement manuel dans plan_events, pour la même
    // visibilité admin que les changements automatiques déclenchés par
    // Stripe (échec de paiement, résiliation) et pour la traçabilité de
    // qui a fait quoi.
    if (previousPlan !== plan) {
      await fetch(`${supabaseUrl}/rest/v1/plan_events`, {
        method: "POST",
        headers: { ...svcHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({
          broker_id: brokerId,
          previous_plan: previousPlan,
          new_plan: plan,
          reason: "admin_override",
          changed_by: callerId,
        }),
      });
    }

    return new Response(JSON.stringify({ updated: true, brokerId, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
