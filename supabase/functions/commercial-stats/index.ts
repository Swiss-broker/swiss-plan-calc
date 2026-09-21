// supabase/functions/commercial-stats/index.ts
// Statistiques personnelles d'un membre de l'équipe (admin ou commercial),
// pour la page "Mes stats" du panel Commercial. Toujours scopé à
// assigned_to = l'appelant lui-même (comme Leads.tsx en panel Commercial),
// jamais à l'ensemble de l'équipe — c'est une vue "mes chiffres à moi", pas
// un tableau de bord managérial. Passe par une Edge Function car
// admin_actions (utilisé pour compter les offres générées) est réservé à
// is_admin() côté RLS, un commercial ne pourrait sinon jamais lire ses
// propres offres (même contrainte que lead-offer-history).
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

export async function handleCommercialStatsRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseKey } = env;
    if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: "CONFIG_MISSING" }, 500);

    const callerId = getVerifiedUserId(req);
    const svcHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // is_staff() vérifié côté serveur, jamais une prétention du client.
    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id`,
      { headers: svcHeaders },
    );
    const staffRows = await staffRes.json();
    if (!Array.isArray(staffRows) || staffRows.length === 0) {
      return jsonResponse({ error: "Réservé aux membres de l'équipe (admin ou commercial)." }, 403);
    }

    const [leadsRes, emailsRes, offersRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/demo_requests?assigned_to=eq.${callerId}&select=id,name,status,follow_up_date`,
        { headers: svcHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/lead_email_log?commercial_id=eq.${callerId}&select=id,sent_at`,
        { headers: svcHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/admin_actions?action=eq.generate_offer&admin_id=eq.${callerId}&select=id`,
        { headers: svcHeaders },
      ),
    ]);
    const leads = await leadsRes.json();
    const emails = await emailsRes.json();
    const offers = await offersRes.json();
    if (!Array.isArray(leads) || !Array.isArray(emails) || !Array.isArray(offers)) {
      return jsonResponse({ error: "Erreur lors de la lecture des statistiques." }, 500);
    }

    const byStatus: Record<string, number> = { pending: 0, contacted: 0, converted: 0, lost: 0 };
    for (const l of leads) {
      if (l.status in byStatus) byStatus[l.status] += 1;
    }
    const total = leads.length;
    const conversionRate = total > 0 ? Math.round((byStatus.converted / total) * 100) : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const emailsThisMonth = emails.filter((e: { sent_at: string }) => new Date(e.sent_at) >= monthStart).length;

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const toFollowUpToday = leads
      .filter((l: { follow_up_date: string | null }) => l.follow_up_date && new Date(l.follow_up_date) <= endOfToday)
      .map((l: { id: string; name: string; follow_up_date: string }) => ({ id: l.id, name: l.name, follow_up_date: l.follow_up_date }));

    return jsonResponse({
      total,
      byStatus,
      conversionRate,
      emailsTotal: emails.length,
      emailsThisMonth,
      offersGenerated: offers.length,
      toFollowUpToday,
    });
  } catch (err) {
    console.error("Erreur commercial-stats:", err);
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
    handleCommercialStatsRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
