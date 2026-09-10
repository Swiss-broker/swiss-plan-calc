// supabase/functions/send-lead-email/index.ts
// Envoie un e-mail réel (via Brevo, même appel que send-client-email /
// capture-demo-lead / handle-conversion) à UN lead démo/vente précis, à
// partir d'un modèle déjà résolu et édité côté commercial
// (swiss-broker-admin/src/components/LeadEmailComposerDialog.tsx). Système
// parallèle à send-client-email, sans dépendance dessus.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Le compte appelant est déduit du JWT vérifié par la passerelle Supabase
// (verify_jwt=true : la signature est déjà validée avant que ce code ne
// s'exécute), jamais d'un champ du body.
function getCallerFromJwt(req: Request): { id: string } | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub !== "string") return null;
    return { id: payload.sub };
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

// Modèle plein texte (édité librement par le commercial) -> HTML simple et
// sobre, cohérent avec les autres e-mails déjà envoyés par l'app.
function textToHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color:#1f2937; line-height:1.5;">${paragraphs}</div>`;
}

export type Env = { supabaseUrl: string; supabaseKey: string; brevoKey?: string };

export async function handleSendLeadEmailRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { demoRequestId, subject, body, templateKey } = await req.json();
    if (!demoRequestId || typeof demoRequestId !== "string") throw new Error("Lead manquant.");
    if (!subject || typeof subject !== "string" || !subject.trim()) throw new Error("Objet manquant.");
    if (!body || typeof body !== "string" || !body.trim()) throw new Error("Message vide.");

    const caller = getCallerFromJwt(req);
    if (!caller) throw new Error("Authentification requise.");
    const callerId = caller.id;

    const { supabaseUrl, supabaseKey, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // is_staff() vérifié côté serveur : n'importe quel membre de
    // admin_users (admin ou commercial), jamais une prétention du client.
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id,role`,
      { headers: svcHeaders },
    );
    const staffRows = await staffRes.json();
    if (!Array.isArray(staffRows) || staffRows.length === 0) {
      throw new Error("Réservé aux membres de l'équipe (admin ou commercial).");
    }
    const callerRole = staffRows[0].role as string;

    // Un commercial ne peut écrire qu'à un lead qui lui est assigné (même
    // restriction que generate-offer et que la RLS sur demo_requests) ; un
    // admin peut le faire pour n'importe lequel.
    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${demoRequestId}&select=id,email,assigned_to`,
      { headers: svcHeaders },
    );
    const leadRows = await leadRes.json();
    if (!Array.isArray(leadRows) || leadRows.length === 0) {
      throw new Error("Ce lead n'existe pas.");
    }
    const lead = leadRows[0];
    if (callerRole !== "admin" && lead.assigned_to !== callerId) {
      throw new Error("Ce lead ne vous est pas assigné.");
    }
    if (!lead.email) {
      throw new Error("Ce lead n'a pas d'adresse e-mail enregistrée.");
    }

    await sendBrevoEmail(brevoKey, lead.email, subject.trim(), textToHtml(body));

    const logRes = await fetch(`${supabaseUrl}/rest/v1/lead_email_log`, {
      method: "POST",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        demo_request_id: demoRequestId,
        commercial_id: callerId,
        template_key: typeof templateKey === "string" ? templateKey : null,
        subject: subject.trim(),
      }),
    });
    if (!logRes.ok) {
      // L'email est déjà parti : une erreur de journalisation ne doit pas
      // faire croire à l'expéditeur que l'envoi a échoué.
      console.error("Erreur insertion lead_email_log:", logRes.status, await logRes.text());
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
    handleSendLeadEmailRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
