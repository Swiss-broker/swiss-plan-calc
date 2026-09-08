// supabase/functions/capture-demo-lead/index.ts
// Endpoint public (verify_jwt=false) recevant le webhook Cal.com de
// https://cal.com/swissbroker/30min. Capture chaque réservation comme un
// lead dans demo_requests et notifie les admins par e-mail. Aucune
// authentification utilisateur ici : Cal.com appelle directement cette URL,
// c'est la signature HMAC qui remplace le JWT.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cal-signature-256",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mécanisme de signature Cal.com vérifié directement dans leur code source
// officiel (github.com/calcom/cal.com, packages/features/webhooks/lib/
// sendPayload.ts — cal.com et calcom.gitbook.io étaient inaccessibles
// depuis cet environnement) : HMAC-SHA256 du corps brut avec le secret
// défini à la création du webhook, digest hexadécimal SANS préfixe
// "sha256=" (contrairement à ce qu'une source tierce indiquait), porté
// par l'en-tête X-Cal-Signature-256. Sans ce contrôle, n'importe qui
// pourrait forger un faux lead en appelant cette URL directement.
export async function verifyCalSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signatureHeader;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendBrevoEmail(
  brevoKey: string | undefined,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, notification admin non envoyée");
    return;
  }
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
  if (!res.ok) {
    console.error("Brevo a refusé l'envoi:", res.status, await res.text());
  }
}

// Les réponses aux questions du formulaire Cal.com (`payload.responses`)
// sont documentées comme de simples chaînes ("name": "John Doe") mais
// certaines versions de leur API les renvoient sous la forme
// { value, label } : on gère les deux formes sans faire d'hypothèse forte.
function extractResponseValue(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v;
  if (v && typeof v === "object" && "value" in v) {
    const val = (v as { value?: unknown }).value;
    return typeof val === "string" && val.trim() ? val : null;
  }
  return null;
}

export type Env = { supabaseUrl: string; supabaseKey: string; webhookSecret: string; brevoKey?: string };

export async function handleCaptureDemoLeadRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey, webhookSecret, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey || !webhookSecret) {
      return jsonResponse({ error: "CONFIG_MISSING" }, 500);
    }

    // Le corps brut doit être lu AVANT d'être parsé en JSON : la signature
    // porte sur le texte exact reçu, pas sur une reformulation.
    const rawBody = await req.text();
    const signature = req.headers.get("x-cal-signature-256");
    if (!signature) {
      console.error("Requête rejetée : en-tête X-Cal-Signature-256 absent");
      return jsonResponse({ error: "SIGNATURE_MISSING" }, 401);
    }
    const isValid = await verifyCalSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error("Requête rejetée : signature invalide, événement non authentique");
      return jsonResponse({ error: "SIGNATURE_INVALID" }, 401);
    }

    const event = JSON.parse(rawBody);

    // Tout événement autre qu'une nouvelle réservation (annulation,
    // reprogrammation, etc.) est ignoré proprement : 200, aucune action.
    // Sans ça, Cal.com verrait son webhook échouer sur ces événements et
    // le désactiverait après trop d'échecs répétés.
    if (event?.triggerEvent !== "BOOKING_CREATED") {
      return jsonResponse({ received: true, ignored: true });
    }

    const payload = event.payload ?? {};
    const attendee = Array.isArray(payload.attendees) ? payload.attendees[0] : undefined;
    const responses = payload.responses ?? {};

    const name: string = attendee?.name || extractResponseValue(responses.name) || "Sans nom";
    const email: string | null = attendee?.email || extractResponseValue(responses.email);
    if (!email) {
      console.error("Payload Cal.com sans email d'invité, lead ignoré:", rawBody);
      return jsonResponse({ error: "ATTENDEE_EMAIL_MISSING" }, 400);
    }

    // Clé confirmée (issue calcom/cal.com #23375, qui cite explicitement
    // "responses.attendeePhoneNumber.value" dans un vrai payload webhook,
    // recoupé avec la doc d'aide Cal.com : la location "Attendee phone
    // number" est traitée en interne comme la question de réservation
    // "attendeePhoneNumber") : { value: "+41..." } sous payload.responses.
    // Ce champ est obligatoire pour ce type de location, donc attendu à
    // chaque réservation ; les autres emplacements ne sont qu'un filet de
    // sécurité pour une éventuelle variation de version de l'API Cal.com.
    const phone: string | null =
      extractResponseValue(responses.attendeePhoneNumber) ||
      extractResponseValue(responses.phone) ||
      extractResponseValue(responses.smsReminderNumber) ||
      attendee?.phoneNumber ||
      null;
    if (!phone) {
      // Ne bloque pas l'insertion : ce cas ne devrait normalement jamais
      // se produire puisque le téléphone est le canal de contact du RDV,
      // mais mieux vaut un lead incomplet qu'un lead perdu.
      console.warn("Téléphone absent du payload Cal.com alors qu'il est attendu:", rawBody);
    }

    const demoDate: string | null = typeof payload.startTime === "string" ? payload.startTime : null;

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/demo_requests`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        status: "pending",
        assigned_to: null,
        demo_date: demoDate,
      }),
    });
    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      console.error("Échec insertion demo_requests:", insertRes.status, errBody);
      // Réponse non-2xx volontaire ici : le lead n'a PAS été enregistré,
      // un retry de Cal.com est donc légitime et ne créera pas de doublon.
      return jsonResponse({ error: "INSERT_FAILED" }, 500);
    }

    // Le lead est en sécurité en base à partir d'ici : toute erreur de
    // notification ci-dessous ne doit plus faire échouer la réponse, sinon
    // un retry Cal.com réinsérerait le même lead une seconde fois.
    try {
      const adminsRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_users?role=eq.admin&select=email`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      const admins: { email: string }[] = adminsRes.ok ? await adminsRes.json() : [];

      const dateLabel = demoDate
        ? new Date(demoDate).toLocaleString("fr-CH", { dateStyle: "long", timeStyle: "short" })
        : null;

      for (const admin of admins) {
        if (!admin.email) continue;
        await sendBrevoEmail(
          brevoKey,
          admin.email,
          "Nouvelle demande de démo",
          `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color:#1f2937; line-height:1.5;">
            <h2 style="color:#0f766e; margin:0 0 12px;">Nouvelle demande de démo</h2>
            <p style="margin:0 0 8px;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) vient de réserver une démo${dateLabel ? ` pour le ${dateLabel}` : ""}.</p>
            ${phone ? `<p style="margin:0 0 8px;">Téléphone : ${escapeHtml(phone)}</p>` : ""}
            <p style="margin:16px 0 0; color:#6b7280; font-size:12px;">SwissBroker Pro — capture automatique via Cal.com</p>
          </div>`,
        );
      }
    } catch (notifyErr) {
      console.error("Erreur notification admins (lead déjà enregistré):", notifyErr);
    }

    return jsonResponse({ received: true });
  } catch (err) {
    console.error("Erreur capture-demo-lead:", err);
    return jsonResponse({ error: String(err instanceof Error ? err.message : err) }, 400);
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
    handleCaptureDemoLeadRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      webhookSecret: Deno.env.get("CALCOM_WEBHOOK_SECRET") ?? "",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
