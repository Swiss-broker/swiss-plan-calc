// supabase/functions/admin-convert-lead/index.ts
// Marque un lead démo/vente comme converti depuis le panel admin
// (swiss-broker-admin), pour une conversion obtenue hors paiement en ligne
// (ex. virement, accord par téléphone) — réservé à is_staff() (admin OU
// commercial assigné), vérifié côté serveur via admin_users, jamais via
// une prétention du client. Même pas d'authentification requise que
// generate-offer.
//
// Avant cette fonction, LeadDetail.tsx changeait demo_requests.status via
// un simple .update() direct : un lead marqué "Converti" depuis le menu
// déroulant ne recevait ni invitation d'onboarding ni e-mail, et restait
// introuvable dans Courtiers (table profiles) faute de compte jamais créé
// — aucun moyen de voir ses simulations, alors que c'est justement le but
// de marquer un lead converti. Cette fonction crée la même invitation que
// le webhook Stripe (handle-conversion), via _shared/onboarding-invite.ts.
import { createOnboardingInvite } from "../_shared/onboarding-invite.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Identité vérifiée depuis le JWT (déjà validé par la passerelle Supabase,
 * verify_jwt=true). Ne jamais faire confiance à un id envoyé dans le body. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
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

export type Env = {
  supabaseUrl: string;
  supabaseKey: string;
  siteUrl: string;
  brevoKey?: string;
};

export async function handleAdminConvertLeadRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey, siteUrl, brevoKey } = env;
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: "CONFIG_MISSING" }, 500);

    const callerId = getVerifiedUserId(req);
    const { demo_request_id } = await req.json();
    if (!demo_request_id || typeof demo_request_id !== "string") {
      return jsonResponse({ error: "demo_request_id manquant." }, 400);
    }

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
      return jsonResponse({ error: "Réservé aux membres de l'équipe (admin ou commercial)." }, 403);
    }
    const callerRole = staffRows[0].role as string;

    // Même règle d'autorité que generate-offer : un commercial ne peut
    // convertir que ses propres leads, un admin n'importe lequel.
    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${demo_request_id}&select=id,name,email,status,assigned_to`,
      { headers: svcHeaders },
    );
    const leadRows = await leadRes.json();
    if (!Array.isArray(leadRows) || leadRows.length === 0) {
      return jsonResponse({ error: "Lead introuvable." }, 404);
    }
    const lead = leadRows[0];
    if (callerRole !== "admin" && lead.assigned_to !== callerId) {
      return jsonResponse({ error: "Ce lead ne vous est pas assigné." }, 403);
    }
    if (!lead.email) {
      return jsonResponse({ error: "Ce lead n'a pas d'adresse e-mail enregistrée, impossible de l'inviter." }, 400);
    }

    const inviteResult = await createOnboardingInvite({
      supabaseUrl,
      supabaseKey,
      siteUrl,
      brevoKey,
      demoRequestId: demo_request_id,
      email: lead.email,
      name: lead.name,
    });

    if (inviteResult.status === "error") {
      return jsonResponse({ error: inviteResult.error }, 500);
    }

    // Idempotent comme le reste du flux : si une invitation existait déjà
    // (ex. Stripe a converti ce lead entre-temps), on ne la recrée pas,
    // mais le statut passe quand même "converted" si ce n'était pas déjà
    // le cas (utile si un commercial corrige un statut resté en retard).
    if (lead.status !== "converted") {
      await fetch(`${supabaseUrl}/rest/v1/demo_requests?id=eq.${demo_request_id}`, {
        method: "PATCH",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "converted" }),
      });
    }

    return jsonResponse({
      converted: true,
      alreadyInvited: inviteResult.status === "already_invited",
    });
  } catch (err) {
    console.error("Erreur admin-convert-lead:", err);
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
    handleAdminConvertLeadRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      siteUrl: Deno.env.get("SITE_URL") ?? "https://swissbrokerpro.ch",
      brevoKey: Deno.env.get("BREVO_API_KEY"),
    }),
  );
}
