const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Jeton invalide.");
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (typeof payload?.sub !== "string") throw new Error("Jeton invalide.");
    return payload.sub;
  } catch {
    throw new Error("Jeton invalide.");
  }
}

export type Env = { supabaseUrl: string; supabaseKey: string };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminCompaniesDataRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const callerId = getVerifiedUserId(req);
    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&role=eq.admin&select=user_id`,
      { headers: svcHeaders },
    );
    const adminRows = await adminRes.json();
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      throw new Error("Réservé aux administrateurs.");
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "count_all") {
      const res = await fetch(`${supabaseUrl}/rest/v1/companies?select=id`, {
        method: "HEAD",
        headers: { ...svcHeaders, Prefer: "count=exact" },
      });
      const range = res.headers.get("content-range");
      const count = range ? parseInt(range.split("/")[1] ?? "0", 10) : 0;
      return jsonResponse({ count });
    }

    throw new Error("Action inconnue.");
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleAdminCompaniesDataRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
