// supabase/functions/send-admin-alert-email/index.ts
//
// Appelee uniquement par le trigger Postgres trg_admin_notifications_email
// (via pg_net), jamais directement par un utilisateur : ni le navigateur du
// courtier ni le panel admin n'ont besoin d'y acceder. Envoie un e-mail a UN
// admin precis (celui de la notification), pas a tous, puisque
// admin_notifications recoit deja une ligne par admin en amont.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendBrevoEmail(to: string, subject: string, htmlContent: string) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, email non envoye");
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SwissBroker Pro", email: "noreply@swissbrokerpro.ch" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const resBody = await res.text();
  console.log(`Brevo status: ${res.status}, reponse: ${resBody}`);
}

const TYPE_LABELS: Record<string, string> = {
  system_error: "Erreur détectée côté courtier",
  payment_sync_issue: "Paiement RDV désynchronisé",
};

// verify_jwt est desactive (obligatoire : cette fonction est appelee par un
// trigger Postgres via pg_net, sans session utilisateur). Le jeton partage
// qui protege cet endpoint vit uniquement dans Supabase Vault (jamais en
// clair dans le code), verifie via le RPC verify_internal_alert_token.
async function isAuthorized(supabaseUrl: string, supabaseKey: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_internal_alert_token`, {
    method: "POST",
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: "internal_alert_email_token", token }),
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
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables d'environnement manquantes");

    if (!(await isAuthorized(supabaseUrl, supabaseKey, req.headers.get("x-internal-token")))) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { admin_id, title, body, link, type } = await req.json();
    if (!admin_id) {
      return new Response(JSON.stringify({ error: "admin_id manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${admin_id}&select=email,display_name`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
    );
    const admins = await adminRes.json();
    const admin = admins[0];
    if (!admin?.email) {
      return new Response(JSON.stringify({ error: "Admin introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // On ne connait pas le domaine de production du panel admin depuis une
    // Edge Function (jamais configure ici) : on indique juste le chemin,
    // sans fabriquer une URL complete potentiellement fausse.
    await sendBrevoEmail(
      admin.email,
      `[SwissBroker Pro] ${TYPE_LABELS[type] ?? title}`,
      `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #b91c1c;">⚠️ ${title}</h2>
        <p>Bonjour ${admin.display_name ?? ""},</p>
        <p style="white-space: pre-wrap;">${body ?? ""}</p>
        ${link ? `<p>Voir dans le panel admin : <strong>${link}</strong></p>` : ""}
        <p style="color:#999; font-size:12px;">SwissBroker Pro — alerte automatique</p>
      </div>
      `
    );

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Exception dans send-admin-alert-email:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
