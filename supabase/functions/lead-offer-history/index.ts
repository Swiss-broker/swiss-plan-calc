// supabase/functions/lead-offer-history/index.ts
// Historique des offres déjà générées pour un lead (demo_requests), lu
// depuis admin_actions (action='generate_offer'). Passe par une Edge
// Function plutôt qu'une lecture directe côté client : la policy SELECT
// sur admin_actions est réservée à is_admin() (voir migration
// 20260908113000_restrict_staff_policies_to_admin_role.sql), donc un
// commercial ne verrait sinon jamais ses propres offres générées. Même
// règle d'autorité que generate-offer : admin -> tous les leads,
// commercial -> seulement les leads qui lui sont assignés.
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

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleLeadOfferHistoryRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey } = env;
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

    // Un commercial ne peut voir l'historique que d'un lead qui lui est
    // assigné (même restriction que generate-offer), un admin voit tout.
    const leadRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?id=eq.${demo_request_id}&select=id,assigned_to`,
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

    const actionsRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_actions?target_type=eq.demo_request&target_id=eq.${demo_request_id}` +
        `&action=eq.generate_offer&order=created_at.desc&select=id,admin_id,details,created_at`,
      { headers: svcHeaders },
    );
    const actions = await actionsRes.json();
    if (!Array.isArray(actions)) {
      return jsonResponse({ error: "Erreur lors de la lecture de l'historique." }, 500);
    }

    return jsonResponse({
      offers: actions.map((a: any) => ({
        id: a.id,
        generated_by: a.admin_id,
        created_at: a.created_at,
        plan: a.details?.plan ?? null,
        billing_period: a.details?.billing_period ?? null,
        discount_duration: a.details?.discount_duration ?? null,
        discount_percent: a.details?.discount_percent ?? null,
        checkout_url: a.details?.checkout_url ?? null,
      })),
    });
  } catch (err) {
    console.error("Erreur lead-offer-history:", err);
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
    handleLeadOfferHistoryRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
