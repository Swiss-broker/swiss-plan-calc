const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrait l'id utilisateur vérifié depuis le JWT (déjà validé par la
 *  passerelle Supabase, verify_jwt=true) — jamais un id envoyé dans le body. */
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

// Exactement les 25 champs que ClientDetail.tsx (swiss-broker-admin) envoie
// aujourd'hui dans clientUpdate — whitelist stricte, jamais broker_id/id/
// created_at/archived etc., même si le body en contenait davantage.
const CLIENT_UPDATE_FIELDS = [
  "first_name", "last_name", "email", "phone", "date_of_birth", "civil_status",
  "gender", "nationality", "permit", "spouse_first_name", "spouse_last_name",
  "spouse_date_of_birth", "spouse_gross_annual_salary", "work_status",
  "activity_rate", "employer", "gross_annual_salary", "bonus", "other_income",
  "activity_sector", "tax_status", "canton", "commune", "postal_code",
  "country_of_residence",
] as const;

// Les 6 champs de pensionUpdate, identiques à ce que ClientDetail.tsx envoie.
const PENSION_FIELDS = [
  "lpp_current_balance", "lpp_insured_salary", "lpp_coordination_deduction",
  "lpp_plan", "pillar_3a_annual_contribution", "pillar_3a_opening_date",
] as const;

export type Env = { supabaseUrl: string; supabaseKey: string };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminClientsDataRequest(req: Request, env: Env): Promise<Response> {
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

    // Réservé aux administrateurs stricts, vérifié côté serveur — jamais
    // confié au client. Remplace la policy RLS admin_read_clients (retirée
    // séparément une fois cette fonction validée).
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

    if (action === "list") {
      // Équivalent de Clients.tsx : select(id, first_name, last_name, email,
      // created_at, profiles(first_name,last_name,email)) — la jointure
      // PostgREST est refaite ici en 2 requêtes (clients puis profiles par
      // broker_id), sans filtre archived, pour un comportement identique.
      const clientsRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?select=id,first_name,last_name,email,created_at,broker_id&order=created_at.desc`,
        { headers: svcHeaders },
      );
      const clients = await clientsRes.json();

      const brokerIds = [...new Set((clients as any[]).map((c) => c.broker_id).filter(Boolean))];
      const brokerMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
      if (brokerIds.length > 0) {
        const brokersRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=in.(${brokerIds.join(",")})&select=id,first_name,last_name,email`,
          { headers: svcHeaders },
        );
        const brokers = await brokersRes.json();
        (brokers as any[]).forEach((b) => { brokerMap[b.id] = b; });
      }

      const result = (clients as any[]).map((c) => ({ ...c, broker: brokerMap[c.broker_id] ?? null }));
      return jsonResponse({ clients: result });
    }

    if (action === "detail") {
      const clientId = body?.clientId;
      if (!clientId || typeof clientId !== "string") throw new Error("clientId manquant.");

      const [clientRes, simsRes, pensionRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=*`, { headers: svcHeaders }),
        fetch(
          `${supabaseUrl}/rest/v1/simulation_history?client_id=eq.${clientId}&select=id,kind,created_at&order=created_at.desc`,
          { headers: svcHeaders },
        ),
        fetch(
          `${supabaseUrl}/rest/v1/client_pension?client_id=eq.${clientId}&select=lpp_current_balance,lpp_insured_salary,lpp_coordination_deduction,lpp_plan,pillar_3a_annual_contribution,pillar_3a_opening_date`,
          { headers: svcHeaders },
        ),
      ]);

      const clientRows = await clientRes.json();
      const client = Array.isArray(clientRows) ? clientRows[0] : undefined;
      if (!client) throw new Error("Client introuvable.");

      const simulations = await simsRes.json();
      const pensionRows = await pensionRes.json();
      const pension = Array.isArray(pensionRows) ? (pensionRows[0] ?? null) : null;

      let broker = null;
      if (client.broker_id) {
        const brokerRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${client.broker_id}&select=first_name,last_name`,
          { headers: svcHeaders },
        );
        const brokerRows = await brokerRes.json();
        broker = Array.isArray(brokerRows) ? (brokerRows[0] ?? null) : null;
      }

      return jsonResponse({ client, simulations, pension, broker });
    }

    if (action === "update") {
      const clientId = body?.clientId;
      if (!clientId || typeof clientId !== "string") throw new Error("clientId manquant.");
      const clientUpdate = body?.clientUpdate ?? {};
      const pensionUpdate = body?.pensionUpdate ?? {};

      const safeClientUpdate: Record<string, unknown> = {};
      for (const f of CLIENT_UPDATE_FIELDS) {
        safeClientUpdate[f] = f in clientUpdate ? clientUpdate[f] : null;
      }
      const safePensionUpdate: Record<string, unknown> = {};
      for (const f of PENSION_FIELDS) {
        safePensionUpdate[f] = f in pensionUpdate ? pensionUpdate[f] : null;
      }

      // broker_id dérivé du client existant, jamais du body — nécessaire
      // pour l'insert client_pension si aucune ligne n'existe encore.
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=broker_id`,
        { headers: svcHeaders },
      );
      const existingRows = await existingRes.json();
      const existingClient = Array.isArray(existingRows) ? existingRows[0] : undefined;
      if (!existingClient) throw new Error("Client introuvable.");

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${clientId}`, {
        method: "PATCH",
        headers: { ...svcHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(safeClientUpdate),
      });
      if (!updateRes.ok) throw new Error("Échec de la mise à jour du client.");

      const existingPensionRes = await fetch(
        `${supabaseUrl}/rest/v1/client_pension?client_id=eq.${clientId}&select=client_id`,
        { headers: svcHeaders },
      );
      const existingPensionRows = await existingPensionRes.json();
      const hasPension = Array.isArray(existingPensionRows) && existingPensionRows.length > 0;

      const pensionRes = hasPension
        ? await fetch(`${supabaseUrl}/rest/v1/client_pension?client_id=eq.${clientId}`, {
            method: "PATCH",
            headers: { ...svcHeaders, Prefer: "return=minimal" },
            body: JSON.stringify(safePensionUpdate),
          })
        : await fetch(`${supabaseUrl}/rest/v1/client_pension`, {
            method: "POST",
            headers: { ...svcHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ client_id: clientId, broker_id: existingClient.broker_id, ...safePensionUpdate }),
          });
      if (!pensionRes.ok) throw new Error("Échec de la mise à jour de la prévoyance.");

      return jsonResponse({ ok: true });
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
  | {
      serve: (h: (req: Request) => Response | Promise<Response>) => void;
      env: { get(k: string): string | undefined };
    }
  | undefined;
if (typeof Deno !== "undefined") {
  Deno.serve((req) =>
    handleAdminClientsDataRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
