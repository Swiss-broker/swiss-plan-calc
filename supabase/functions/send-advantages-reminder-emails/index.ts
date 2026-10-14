// supabase/functions/send-advantages-reminder-emails/index.ts
//
// Rappel mensuel (cron, voir run_send_advantages_reminder_emails dans la
// migration add_advantages_reminder_columns) : pour chaque courtier abonné
// (plan "active") qui n'a pas encore coché "j'ai eu mon rendez-vous
// avantages" dans son profil, et qui n'a pas déjà reçu ce rappel dans les
// 30 derniers jours, envoie un email lui rappelant de réserver l'appel, ou
// de cocher la case si le rendez-vous a déjà eu lieu.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALCOM_ADVANTAGES_URL =
  "https://cal.com/swissbroker/presentation-de-vos-avantages-swissbroker-pro";
const REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

async function sendBrevoEmail(brevoKey: string, to: string, subject: string, htmlContent: string) {
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

// Le jeton partagé protégeant cet endpoint vit uniquement dans Supabase
// Vault (jamais en clair dans le code), vérifié via le RPC générique
// verify_internal_alert_token (même mécanisme que check-stuck-rdv-payments).
async function isAuthorized(
  supabaseUrl: string,
  supabaseKey: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_internal_alert_token`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_name: "internal_advantages_reminder_token", token }),
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

export type Env = { supabaseUrl: string; supabaseKey: string; brevoKey: string; siteUrl: string };

interface ReminderProfile {
  id: string;
  email: string;
  first_name: string | null;
}

export async function handleSendAdvantagesReminderEmailsRequest(
  req: Request,
  env: Env,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey, brevoKey, siteUrl } = env;
    if (!supabaseUrl || !supabaseKey || !brevoKey) {
      throw new Error("Variables d'environnement manquantes");
    }

    if (!(await isAuthorized(supabaseUrl, supabaseKey, req.headers.get("x-internal-token")))) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date(Date.now() - REMINDER_INTERVAL_MS).toISOString();
    const query =
      `plan=eq.active&advantages_call_done=eq.false` +
      `&or=(advantages_email_last_sent_at.is.null,advantages_email_last_sent_at.lt.${cutoff})` +
      `&select=id,email,first_name`;
    const dueRes = await fetch(`${supabaseUrl}/rest/v1/profiles?${query}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const due: ReminderProfile[] = await dueRes.json();

    let sent = 0;
    for (const broker of due) {
      if (!broker.email) continue;
      await sendBrevoEmail(
        brevoKey,
        broker.email,
        "Vos avantages SwissBroker Pro, ristournes et commission",
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2>Vos avantages SwissBroker Pro</h2>
          <p>Bonjour ${broker.first_name ?? ""},</p>
          <p>Vous n'avez pas encore réservé votre rendez-vous avec notre équipe pour faire le point sur vos avantages (prise en charge des ristournes, commission à 40-50‰).</p>
          <p>Si ce rendez-vous a déjà eu lieu, pensez simplement à cocher la case correspondante dans votre profil (onglet "Avantages") pour ne plus recevoir ce rappel.</p>
          <p>
            <a href="${CALCOM_ADVANTAGES_URL}" style="display:inline-block;margin-right:12px;">Réserver un appel</a>
            <a href="${siteUrl}/account?tab=avantages">Aller dans mon profil</a>
          </p>
          <p style="color:#999; font-size:12px;">SwissBroker Pro</p>
        </div>
        `,
      );

      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${broker.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ advantages_email_last_sent_at: new Date().toISOString() }),
      });
      sent++;
    }

    return new Response(JSON.stringify({ due: due.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Exception dans send-advantages-reminder-emails:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// `Deno` n'existe pas sous Node/Vitest : ce garde-fou permet d'importer ce
// fichier depuis les tests sans jamais tenter de démarrer un vrai serveur
// Deno en dehors du runtime Edge Functions.
declare const Deno:
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleSendAdvantagesReminderEmailsRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      brevoKey: Deno.env.get("BREVO_API_KEY") ?? "",
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
    }),
  );
}
