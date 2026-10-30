// supabase/functions/handle-conversion/index.ts
// Webhook Stripe dédié : quand un lead démo/vente paie via le lien généré
// par generate-offer (checkout.session.completed), on marque le lead
// converti et on envoie l'invitation d'onboarding. Endpoint public, jamais
// de verify_jwt Supabase — l'authenticité vient uniquement de la
// signature Stripe (voir verifyStripeSignature ci-dessous).
//
// Même création d'invitation (et même email) que admin-convert-lead, pour
// un commercial qui marque une conversion obtenue hors paiement en ligne —
// voir _shared/onboarding-invite.ts. Un lead "converti" sans jamais passer
// par l'un de ces deux chemins ne reçoit ni invitation ni email, et reste
// introuvable dans Courtiers (profiles) tant qu'il n'a pas terminé
// l'onboarding : c'est ce que cette fonction partagée évite.
import { createOnboardingInvite } from "../_shared/onboarding-invite.ts";

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

    const inviteResult = await createOnboardingInvite({
      supabaseUrl,
      supabaseKey,
      siteUrl,
      brevoKey,
      demoRequestId,
      email: lead.email,
      name: lead.name,
    });

    // Idempotence : Stripe peut redélivrer le même événement (retry sur
    // timeout, ou renvoi manuel depuis le dashboard). Si une invitation
    // existe déjà pour ce lead, on ne recrée rien et on ne renvoie pas
    // l'email — sinon le client recevrait plusieurs liens d'onboarding
    // avec des tokens différents. Le statut n'a alors rien de nouveau à
    // confirmer (déjà converti lors du premier passage).
    if (inviteResult.status === "already_invited") {
      return jsonResponse({ received: true, alreadyProcessed: true });
    }
    if (inviteResult.status === "error") {
      // Le statut du lead n'est PAS marqué "converted" ici : un lead
      // converti sans invitation ni compte créé est exactement le bug que
      // cette fonction partagée doit empêcher (voir admin-convert-lead).
      return jsonResponse({ error: inviteResult.error }, 500);
    }

    // Invitation créée avec succès : seulement maintenant le lead passe
    // "converted", jamais avant d'être sûr que l'invitation existe bien.
    await fetch(`${supabaseUrl}/rest/v1/demo_requests?id=eq.${demoRequestId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "converted" }),
    });

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
