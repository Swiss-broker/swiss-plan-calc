// supabase/functions/handle-conversion/index.ts
// Webhook Stripe dédié : quand un lead démo/vente paie via le lien généré
// par generate-offer (checkout.session.completed), on marque le lead
// converti et on envoie l'invitation d'onboarding. Endpoint public, jamais
// de verify_jwt Supabase — l'authenticité vient uniquement de la
// signature Stripe (voir verifyStripeSignature ci-dessous).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_PLANS = new Set(["starter", "pro", "cabinet"]);
const PLAN_LABELS: Record<string, string> = { starter: "Starter", pro: "Pro", cabinet: "Cabinet" };

// Même méthode de vérification que stripe-webhook (déjà en production) :
// on recalcule le HMAC-SHA256 attendu à partir du corps brut et du secret
// partagé, puis on compare au(x) v1 de l'en-tête Stripe-Signature. C'est
// l'équivalent fait-maison de stripe.webhooks.constructEvent — on l'utilise
// ici plutôt que le SDK Stripe, qui n'est chargé nulle part ailleurs dans
// ce projet, pour rester cohérent avec le reste du code.
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parts.signatures.includes(expectedSignature);
}

// Même génération de token que DocumentsTab.tsx (randomToken()) : 24
// octets aléatoires cryptographiques, encodés en base36.
function randomToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

async function sendBrevoEmail(
  brevoKey: string | undefined,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  if (!brevoKey) {
    console.error("BREVO_API_KEY manquante, email d'invitation non envoyé");
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

export type Env = {
  supabaseUrl: string;
  supabaseKey: string;
  webhookSecret: string;
  siteUrl: string;
  brevoKey?: string;
};

export async function handleConversionRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey, webhookSecret, siteUrl, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey || !webhookSecret) {
      return jsonResponse({ error: "CONFIG_MISSING" }, 500);
    }

    // Le corps brut doit être lu AVANT d'être parsé en JSON : la signature
    // porte sur le texte exact reçu, pas sur une resérialisation.
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("Requête rejetée : en-tête stripe-signature absent");
      return jsonResponse({ error: "Signature manquante" }, 401);
    }
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Requête rejetée : signature invalide");
      return jsonResponse({ error: "Signature invalide" }, 401);
    }

    const event = JSON.parse(body);

    if (event.type !== "checkout.session.completed") {
      return jsonResponse({ received: true, ignored: true });
    }

    const session = event.data.object;
    const demoRequestId = session.metadata?.demo_request_id;
    if (!demoRequestId) {
      // Un checkout.session.completed qui ne vient pas de generate-offer
      // (ex. un abonnement self-serve classique) : rien à faire ici, c'est
      // stripe-webhook (autre endpoint) qui le traite déjà.
      return jsonResponse({ received: true, ignored: true });
    }

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${demoRequestId}&select=id,name,email,status`,
      { headers: svcHeaders },
    );
    const leadRows = await leadRes.json();
    const lead = Array.isArray(leadRows) ? leadRows[0] : null;
    if (!lead) {
      console.error("handle-conversion: demo_request introuvable pour id", demoRequestId);
      return jsonResponse({ received: true, ignored: true });
    }

    // Idempotence : Stripe peut redélivrer le même événement (retry sur
    // timeout, ou renvoi manuel depuis le dashboard). Si une invitation
    // existe déjà pour ce lead, on ne recrée rien et on ne renvoie pas
    // l'email — sinon le client recevrait plusieurs liens d'onboarding
    // avec des tokens différents.
    const existingInviteRes = await fetch(
      `${supabaseUrl}/rest/v1/client_invites?demo_request_id=eq.${demoRequestId}&select=id&limit=1`,
      { headers: svcHeaders },
    );
    const existingInvites = await existingInviteRes.json();
    if (Array.isArray(existingInvites) && existingInvites.length > 0) {
      return jsonResponse({ received: true, alreadyProcessed: true });
    }

    await fetch(`${supabaseUrl}/rest/v1/demo_requests?id=eq.${demoRequestId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "converted" }),
    });

    const rawPlan = session.metadata?.plan;
    const plan = ALLOWED_PLANS.has(rawPlan) ? rawPlan : "starter";
    if (!ALLOWED_PLANS.has(rawPlan)) {
      console.error("handle-conversion: plan absent/invalide dans les metadata Stripe, repli sur 'starter':", rawPlan);
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviteRes = await fetch(`${supabaseUrl}/rest/v1/client_invites`, {
      method: "POST",
      headers: { ...svcHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        demo_request_id: demoRequestId,
        email: lead.email,
        plan,
        token,
        expires_at: expiresAt,
      }),
    });
    if (!inviteRes.ok) {
      console.error("handle-conversion: échec insertion client_invites:", inviteRes.status, await inviteRes.text());
      return jsonResponse({ error: "Échec création de l'invitation." }, 500);
    }

    // Email best-effort : le lead est déjà marqué converti et l'invitation
    // déjà créée à ce stade, une panne Brevo ne doit pas faire échouer le
    // webhook (Stripe le réinterpréterait comme un échec et réessaierait).
    try {
      const onboardingUrl = `${siteUrl}/onboarding/${token}`;
      await sendBrevoEmail(
        brevoKey,
        lead.email,
        "Bienvenue sur SwissBroker Pro — finalisez votre compte",
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f766e;">Merci pour votre confiance !</h2>
          <p>Bonjour ${lead.name ?? ""},</p>
          <p>Votre abonnement SwissBroker Pro (${PLAN_LABELS[plan]}) est confirmé. Il ne reste qu'une étape pour finaliser la création de votre compte :</p>
          <p style="margin: 24px 0;">
            <a href="${onboardingUrl}" style="background:#0f766e; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">Finaliser mon compte</a>
          </p>
          <p style="color:#666; font-size:13px;">Ce lien est valable 7 jours.</p>
          <p style="color:#999; font-size:12px;">SwissBroker Pro</p>
        </div>
        `,
      );
    } catch (emailErr) {
      console.error("handle-conversion: erreur envoi email d'invitation (lead déjà converti):", emailErr);
    }

    return jsonResponse({ received: true, converted: true });
  } catch (err) {
    console.error("Erreur handle-conversion:", err);
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
    handleConversionRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      webhookSecret: Deno.env.get("STRIPE_CONVERSION_WEBHOOK_SECRET") ?? "",
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
