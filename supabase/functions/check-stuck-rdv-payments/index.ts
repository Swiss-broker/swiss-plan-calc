// supabase/functions/check-stuck-rdv-payments/index.ts
//
// Filet de securite pour exactement le type de panne rencontre le
// 30.08.2026 : le webhook Stripe (stripe-webhook) est la seule chose qui
// fait passer une facture RDV de "pending" a "paid" -- si ce webhook est
// injoignable pour une raison quelconque (mauvaise config, panne Stripe,
// panne reseau), le paiement est bien pris chez Stripe mais la fiche client
// reste bloquee indefiniment, sans que personne ne le sache.
//
// Appelee toutes les 30 minutes par pg_cron (voir migration
// check_stuck_rdv_payments_cron.sql). Pour chaque facture "pending" avec un
// payment_intent deja cree depuis plus de 20 minutes, on demande directement
// a Stripe si le paiement a reellement abouti. Si oui : on corrige la facture
// nous-memes (comme l'aurait fait le webhook) et on alerte les admins, car
// ca signale une vraie panne du webhook a corriger.
//
// Ne touche jamais une facture encore normalement en attente de paiement
// (Stripe repond alors autre chose que "succeeded") : ce n'est pas un bug,
// juste un client qui n'a pas encore paye.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le jeton partage protegeant cet endpoint vit uniquement dans Supabase
// Vault (jamais en clair dans le code), verifie via le RPC
// verify_internal_alert_token.
async function isAuthorized(supabaseUrl: string, supabaseKey: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_internal_alert_token`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: "internal_alert_cron_token", token }),
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      throw new Error("Variables d'environnement manquantes");
    }

    if (!(await isAuthorized(supabaseUrl, supabaseKey, req.headers.get("x-internal-token")))) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const stuckRes = await fetch(
      `${supabaseUrl}/rest/v1/rdv_invoices?status=eq.pending&stripe_payment_intent_id=not.is.null&created_at=lt.${cutoff}&select=id,broker_id,stripe_payment_intent_id`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
    );
    const stuckInvoices: { id: string; broker_id: string; stripe_payment_intent_id: string }[] = await stuckRes.json();

    let corrected = 0;
    for (const invoice of stuckInvoices) {
      const piRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${invoice.stripe_payment_intent_id}`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      const pi = await piRes.json();
      if (pi.status !== "succeeded") continue; // toujours en attente cote client : normal, on ne touche a rien.

      await fetch(`${supabaseUrl}/rest/v1/rdv_invoices?id=eq.${invoice.id}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ status: "paid", pdf_unlocked: true }),
      });

      // Une ligne par admin, meme convention que les triggers notify_admins_*
      // existants (feedback_reply, new_payment, new_feedback) : chaque admin
      // a sa propre ligne dans admin_notifications, et le trigger email ne
      // cible que l'admin de CETTE ligne.
      const adminsRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_users?select=user_id`,
        { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
      );
      const admins: { user_id: string }[] = await adminsRes.json();
      if (admins.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/admin_notifications`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(
            admins.map((a) => ({
              admin_id: a.user_id,
              type: "payment_sync_issue",
              title: "Paiement RDV corrigé automatiquement",
              body: `Le webhook Stripe n'a pas confirmé ce paiement à temps. Stripe confirme qu'il a bien abouti : la facture a été débloquée automatiquement. Vérifiez que le webhook fonctionne normalement.`,
              link: "/payments",
            })),
          ),
        });
      }

      corrected++;
      console.log(`Facture ${invoice.id} corrigee automatiquement (webhook manque le paiement).`);
    }

    return new Response(JSON.stringify({ checked: stuckInvoices.length, corrected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Exception dans check-stuck-rdv-payments:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
