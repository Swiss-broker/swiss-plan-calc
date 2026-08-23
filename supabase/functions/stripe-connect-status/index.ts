// supabase/functions/stripe-connect-status/index.ts
// Vérifie auprès de Stripe (jamais du client) si l'onboarding Connect du
// courtier est réellement terminé, et met à jour broker_connect_accounts
// en conséquence. Remplace un ancien mécanisme où le navigateur marquait
// lui-même onboarding_complete=true dès qu'il voyait ?connect=success dans
// l'URL de retour, sans aucune vérification que Stripe avait effectivement
// validé le compte : un courtier pouvait se déclarer "compte bancaire
// vérifié" sans jamais terminer l'inscription Stripe.
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
    const brokerId = getVerifiedUserId(req);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    const rowsRes = await fetch(
      `${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}&select=stripe_account_id,onboarding_complete`,
      { headers: svcHeaders },
    );
    const rows = await rowsRes.json();
    const row = rows[0];
    if (!row?.stripe_account_id) {
      return new Response(JSON.stringify({ onboarding_complete: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Source de vérité : l'état réel du compte chez Stripe, jamais ce que
    // prétend le navigateur.
    const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${row.stripe_account_id}`, {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });
    const acct = await acctRes.json();
    if (!acctRes.ok) throw new Error(acct.error?.message ?? "Erreur Stripe");

    const complete = Boolean(acct.details_submitted && acct.charges_enabled);

    if (complete !== row.onboarding_complete) {
      await fetch(`${supabaseUrl}/rest/v1/broker_connect_accounts?broker_id=eq.${brokerId}`, {
        method: "PATCH",
        headers: { ...svcHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({ onboarding_complete: complete }),
      });
    }

    return new Response(JSON.stringify({ onboarding_complete: complete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
