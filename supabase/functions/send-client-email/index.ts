// supabase/functions/send-client-email/index.ts
// Envoie un e-mail réel (via Brevo, même appel que stripe-webhook /
// cabinet-add-seat / send-rdv-payment-link) à UN client précis, à partir
// d'un modèle déjà résolu et édité côté courtier
// (src/components/clients/EmailComposerDialog.tsx). Le courtier garde
// toujours la main : cette fonction n'envoie que ce qu'on lui demande
// d'envoyer, elle ne déclenche jamais rien toute seule.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est deduit du JWT verifie par la passerelle Supabase
// (verify_jwt=true sur cette fonction : la signature est deja validee avant
// que ce code ne s'execute), jamais d'un champ du body.
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

async function sendBrevoEmail(
  brevoKey: string | undefined,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  if (!brevoKey) throw new Error("BREVO_API_KEY manquante");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "SwissBroker Pro", email: "noreply@swissbrokerpro.ch" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const resBody = await res.text();
  if (!res.ok) throw new Error(`Brevo a refusé l'envoi (${res.status}): ${resBody}`);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Modèle plein texte (édité librement par le courtier) -> HTML simple et
// sobre, cohérent avec les autres e-mails déjà envoyés par l'app.
function textToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color:#1f2937; line-height:1.5;">${paragraphs}</div>`;
}

export type Env = { supabaseUrl: string; supabaseKey: string; brevoKey?: string };

export async function handleSendClientEmailRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, subject, body, templateKey } = await req.json();
    if (!clientId || typeof clientId !== "string") throw new Error("Client manquant.");
    if (!subject || typeof subject !== "string" || !subject.trim()) throw new Error("Objet manquant.");
    if (!body || typeof body !== "string" || !body.trim()) throw new Error("Message vide.");

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const brokerId = caller.id;

    const { supabaseUrl, supabaseKey, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // broker_id=eq.${brokerId} est essentiel ici : sans ce filtre, un
    // courtier authentifié pourrait envoyer un email au client d'un AUTRE
    // courtier en devinant/connaissant son clientId.
    const clientRes = await fetch(
      `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&broker_id=eq.${brokerId}&select=email,first_name,last_name`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const clientBody = await clientRes.json();
    if (!clientRes.ok) throw new Error("Erreur lors de la vérification du client.");
    if (!Array.isArray(clientBody) || clientBody.length === 0) {
      throw new Error("Ce client n'existe pas ou ne vous appartient pas.");
    }
    const client = clientBody[0];
    if (!client.email) {
      throw new Error("Ce client n'a pas d'adresse e-mail enregistrée.");
    }

    await sendBrevoEmail(brevoKey, client.email, subject.trim(), textToHtml(body));

    const logRes = await fetch(`${supabaseUrl}/rest/v1/client_email_log`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        client_id: clientId,
        broker_id: brokerId,
        template_key: typeof templateKey === "string" ? templateKey : null,
        subject: subject.trim(),
      }),
    });
    if (!logRes.ok) {
      // L'email est deja parti : une erreur de journalisation ne doit pas
      // faire croire au courtier que l'envoi a echoue.
      console.error("Erreur insertion client_email_log:", logRes.status, await logRes.text());
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
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
    handleSendClientEmailRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
