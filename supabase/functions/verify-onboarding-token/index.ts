// supabase/functions/verify-onboarding-token/index.ts
// Endpoint public (verify_jwt=false) : vérifie un token client_invites
// (généré par handle-conversion après un paiement commercial) et renvoie
// l'email associé, jamais saisi par le visiteur. Lecture seule — la
// consommation réelle du token (used_at) se fait dans complete-onboarding.
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

export type Env = { supabaseUrl: string; supabaseKey: string };

export async function handleVerifyOnboardingTokenRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { supabaseUrl, supabaseKey } = env;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "CONFIG_MISSING" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token || token.length < 16) return jsonResponse({ error: "INVITE_NOT_FOUND" }, 404);

    const res = await fetch(
      `${supabaseUrl}/rest/v1/client_invites?token=eq.${encodeURIComponent(token)}&select=email,plan,revoked,expires_at,used_at`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const rows = await res.json();
    const invite = Array.isArray(rows) ? rows[0] : null;
    if (!invite) return jsonResponse({ error: "INVITE_NOT_FOUND" }, 404);
    if (invite.revoked) return jsonResponse({ error: "INVITE_REVOKED" }, 403);
    if (invite.used_at) return jsonResponse({ error: "INVITE_USED" }, 403);
    if (new Date(invite.expires_at) < new Date()) return jsonResponse({ error: "INVITE_EXPIRED" }, 403);

    return jsonResponse({ email: invite.email, plan: invite.plan });
  } catch (err) {
    return jsonResponse({ error: "UNEXPECTED", detail: String(err) }, 500);
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleVerifyOnboardingTokenRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
