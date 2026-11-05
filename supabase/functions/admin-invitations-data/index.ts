// supabase/functions/admin-invitations-data/index.ts
// Statut d'inscription de TOUS les courtiers en cours de recrutement, quel
// que soit le chemin d'arrivée : réservation démo (cal.com) ou invitation
// manuelle ("Inviter un courtier"). Un seul courtier peut en effet venir
// des deux (ex. démo cal.com, puis offre renvoyée manuellement) — cette
// fonction ne distingue donc la source QUE pour l'affichage (colonne
// "origine"), jamais pour exclure une ligne. Pour l'onglet "Statut
// d'inscription" du panel admin (swiss-broker-admin), sous "Inviter un
// courtier". Réservé à is_staff() (admin OU commercial, un commercial ne
// voit que ses propres leads assignés), même règle d'autorité que
// generate-offer / lead-offer-history.
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
 *  verify_jwt=true). Ne jamais faire confiance à un id envoyé dans le body. */
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

export async function handleAdminInvitationsDataRequest(req: Request, env: Env): Promise<Response> {
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

    const staffRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_users?user_id=eq.${callerId}&select=user_id,role`,
      { headers: svcHeaders },
    );
    const staffRows = await staffRes.json();
    if (!Array.isArray(staffRows) || staffRows.length === 0) {
      return jsonResponse({ error: "Réservé aux membres de l'équipe (admin ou commercial)." }, 403);
    }
    const callerRole = staffRows[0].role as string;

    // Tous les leads courtier non archivés, quelle que soit leur origine
    // (source='manual' = "Inviter un courtier", tout le reste = réservation
    // cal.com classique) : la vue doit les montrer tous, pas seulement ceux
    // qui ont déjà reçu une offre.
    const leadsRes = await fetch(
      `${supabaseUrl}/rest/v1/demo_requests?archived=eq.false` +
        `&select=id,name,email,status,source,assigned_to,created_at&order=created_at.desc`,
      { headers: svcHeaders },
    );
    const leads = await leadsRes.json();
    if (!Array.isArray(leads)) return jsonResponse({ error: "Erreur lors de la lecture des leads." }, 500);

    // Un commercial ne voit que ses propres leads assignés (même règle que
    // generate-offer) ; un admin voit tout.
    const visibleLeads = callerRole === "admin"
      ? leads
      : (leads as any[]).filter((l) => l.assigned_to === callerId);
    if (visibleLeads.length === 0) return jsonResponse({ invitations: [] });

    // Une offre par lead peut être générée plusieurs fois (relances) : on ne
    // garde que la plus récente par target_id, via le tri + un Map (dernier
    // écrit l'emporte, donc on itère du plus ancien au plus récent).
    const actionsRes = await fetch(
      `${supabaseUrl}/rest/v1/admin_actions?action=eq.generate_offer&target_type=eq.demo_request` +
        `&order=created_at.asc&select=target_id,admin_id,details,created_at`,
      { headers: svcHeaders },
    );
    const actions = await actionsRes.json();
    if (!Array.isArray(actions)) return jsonResponse({ error: "Erreur lors de la lecture des offres." }, 500);

    const latestOfferByLead = new Map<string, { created_at: string; checkout_url: string | null; admin_id: string }>();
    for (const a of actions as any[]) {
      latestOfferByLead.set(a.target_id, {
        created_at: a.created_at,
        checkout_url: a.details?.checkout_url ?? null,
        admin_id: a.admin_id,
      });
    }

    const emails = [...new Set((visibleLeads as any[]).map((l) => l.email).filter(Boolean))];
    const invitesRes = emails.length > 0
      ? await fetch(
          `${supabaseUrl}/rest/v1/client_invites?email=in.(${emails.map((e) => `"${e}"`).join(",")})` +
            `&select=email,created_at,used_at,revoked`,
          { headers: svcHeaders },
        )
      : null;
    const invites = invitesRes ? await invitesRes.json() : [];
    const inviteByEmail = new Map<string, any>();
    if (Array.isArray(invites)) {
      for (const inv of invites) inviteByEmail.set(inv.email, inv);
    }

    const invitations = (visibleLeads as any[]).map((l) => {
      const offer = latestOfferByLead.get(l.id);
      const invite = inviteByEmail.get(l.email);
      let stage: "sans_offre" | "envoye" | "paye" | "compte_cree" = "sans_offre";
      if (invite?.used_at) stage = "compte_cree";
      else if (invite) stage = "paye";
      else if (offer) stage = "envoye";
      return {
        demo_request_id: l.id,
        name: l.name,
        email: l.email,
        lead_status: l.status,
        origin: l.source === "manual" ? "invitation" : "reservation",
        created_at: l.created_at,
        sent_at: offer?.created_at ?? null,
        checkout_url: offer?.checkout_url ?? null,
        paid_at: invite?.created_at ?? null,
        account_created_at: invite?.used_at ?? null,
        stage,
      };
    });

    // Plus récent en premier, selon le dernier évènement connu de chaque
    // ligne (compte créé > payé > envoyé > créé) plutôt que toujours
    // created_at — pour que le courtier qui vient de bouger remonte en haut.
    invitations.sort((a, b) => {
      const latest = (x: typeof a) => x.account_created_at ?? x.paid_at ?? x.sent_at ?? x.created_at;
      return (latest(b) ?? "").localeCompare(latest(a) ?? "");
    });

    return jsonResponse({ invitations });
  } catch (err) {
    console.error("Erreur admin-invitations-data:", err);
    return jsonResponse({ error: String(err instanceof Error ? err.message : err) }, 400);
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
    handleAdminInvitationsDataRequest(req, {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    }),
  );
}
