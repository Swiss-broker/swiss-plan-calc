// supabase/functions/cabinet-remove-member/index.ts
// Retire un membre actif du cabinet (pas une invitation en attente — voir
// cabinet-cancel-invite pour ça). Si le membre a des dossiers clients, un
// destinataire de réassignation est requis : ses dossiers (fortune,
// prévoyance, notes, scénarios, simulations, documents, société liée) sont
// transférés avant que le retrait ne soit effectif, pour qu'aucun dossier
// ne devienne orphelin/inaccessible. Les factures RDV passées (rdv_invoices)
// ne sont PAS réassignées : elles restent attribuées à qui a réellement
// fait le travail, pour ne pas fausser l'historique de revenu de chacun.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extrait l'id utilisateur vérifié depuis le JWT de la requête (déjà
 *  validé par la plateforme Supabase — verify_jwt=true dans config.toml —
 *  avant même l'exécution de cette fonction). Ne JAMAIS faire confiance à
 *  un id envoyé dans le corps de la requête pour l'identité de l'appelant :
 *  n'importe qui pourrait sinon usurper n'importe quel autre compte. */
function getVerifiedUserId(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? "";
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

// Tables de dossier client (ont leur propre broker_id, dénormalisé aux
// côtés de client_id) à réassigner intégralement avec le client.
const DOSSIER_TABLES = [
  "client_assets",
  "client_pension",
  "client_notes",
  "scenarios",
  "simulations",
  "simulation_history",
  "client_documents",
  "client_document_links",
  "ai_conversations",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const callerId = getVerifiedUserId(req);
    const { memberId, reassignToId } = await req.json();
    if (!memberId) throw new Error("Paramètre manquant.");
    if (memberId === callerId) throw new Error("Vous ne pouvez pas vous retirer vous-même.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    const svcHeaders = {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };
    async function sb(path: string) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: svcHeaders });
      return res.json();
    }

    // 1. Qui demande, avec quelle autorité ?
    const callers = await sb(`profiles?id=eq.${callerId}&select=id,cabinet_role,cabinet_root_id`);
    const caller = callers[0];
    if (!caller || (caller.cabinet_role !== "root_director" && caller.cabinet_role !== "director")) {
      throw new Error("Seuls les directeurs peuvent retirer un membre.");
    }
    const callerCabinetRootId = caller.cabinet_role === "root_director" ? caller.id : caller.cabinet_root_id;

    // 2. Le membre visé fait-il partie du même cabinet, et le demandeur
    //    a-t-il autorité sur lui ? Un directeur simple ne peut retirer que
    //    ses propres courtiers directs (même règle que pour les annonces
    //    ciblées) ; le directeur racine peut retirer n'importe quel
    //    directeur ou courtier de son cabinet, mais jamais lui-même
    //    (déjà exclu ci-dessus) ni un autre root_director (il n'y en a
    //    jamais qu'un par cabinet, mais on le garde en garde-fou explicite).
    const targets = await sb(
      `profiles?id=eq.${memberId}&select=id,email,first_name,last_name,cabinet_role,cabinet_root_id,manager_id`,
    );
    const target = targets[0];
    if (!target) throw new Error("Membre introuvable.");
    const targetInSameCabinet = target.cabinet_root_id === callerCabinetRootId;
    const callerCanManageTarget =
      targetInSameCabinet &&
      target.cabinet_role !== "root_director" &&
      (caller.cabinet_role === "root_director" || target.manager_id === callerId);
    if (!callerCanManageTarget) {
      throw new Error("Vous n'avez pas l'autorité pour retirer ce membre.");
    }

    // 3. Dossiers clients du membre retiré : réassignation obligatoire s'il
    //    y en a.
    const clientsRes = await fetch(
      `${supabaseUrl}/rest/v1/clients?broker_id=eq.${memberId}&select=id,company_id`,
      { headers: { ...svcHeaders, "Prefer": "count=exact" } },
    );
    const clientsOwned: { id: string; company_id: string | null }[] = await clientsRes.json();
    const clientCount = clientsOwned.length;

    if (clientCount > 0) {
      if (!reassignToId) {
        throw new Error(
          `Ce membre a ${clientCount} dossier(s) client. Choisissez un destinataire avant de le retirer.`,
        );
      }
      if (reassignToId === memberId) {
        throw new Error("Choisissez un destinataire différent du membre retiré.");
      }
      const reassignTargets = await sb(`profiles?id=eq.${reassignToId}&select=id,cabinet_root_id`);
      const reassignTarget = reassignTargets[0];
      if (!reassignTarget || reassignTarget.cabinet_root_id !== callerCabinetRootId) {
        throw new Error("Le destinataire choisi ne fait pas partie du même cabinet.");
      }

      // Contenu du dossier (fortune, prévoyance, notes, scénarios,
      // simulations, documents, conversations IA) — tout ce qui a son
      // propre broker_id dénormalisé.
      for (const table of DOSSIER_TABLES) {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?broker_id=eq.${memberId}`, {
          method: "PATCH",
          headers: { ...svcHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({ broker_id: reassignToId }),
        });
        if (!res.ok) {
          throw new Error(`Erreur lors de la réattribution (${table}). Rien n'a été retiré, réessayez.`);
        }
      }

      // Sociétés liées aux clients réassignés (clients.company_id), le cas
      // échéant — scoping strict aux sociétés déjà possédées par le
      // membre retiré pour ne jamais toucher une société d'un tiers.
      const companyIds = [...new Set(clientsOwned.map((c) => c.company_id).filter((id): id is string => !!id))];
      if (companyIds.length > 0) {
        const idsFilter = companyIds.join(",");
        const res = await fetch(
          `${supabaseUrl}/rest/v1/companies?id=in.(${idsFilter})&broker_id=eq.${memberId}`,
          {
            method: "PATCH",
            headers: { ...svcHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify({ broker_id: reassignToId }),
          },
        );
        if (!res.ok) throw new Error("Erreur lors de la réattribution des sociétés liées. Rien n'a été retiré, réessayez.");
      }

      // Les fiches clients elles-mêmes, en dernier : si une étape
      // précédente a échoué, le client reste visible et intact chez le
      // membre retiré plutôt que déplacé avec un dossier incomplet.
      const clientsUpdateRes = await fetch(`${supabaseUrl}/rest/v1/clients?broker_id=eq.${memberId}`, {
        method: "PATCH",
        headers: { ...svcHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({ broker_id: reassignToId }),
      });
      if (!clientsUpdateRes.ok) {
        throw new Error("Erreur lors de la réattribution des fiches clients. Rien n'a été retiré, réessayez.");
      }
    }

    // 4. Meilleur effort : annuler le siège Stripe du membre, s'il en a un
    //    (retrouvé via son invitation acceptée). Ne bloque jamais le
    //    retrait du cabinet — une erreur Stripe se traite manuellement.
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey && target.email) {
        const acceptedInvites = await sb(
          `cabinet_invites?email=eq.${encodeURIComponent(target.email)}&status=eq.accepted` +
            `&stripe_subscription_item_id=not.is.null&select=stripe_subscription_item_id` +
            `&order=created_at.desc&limit=1`,
        );
        const itemId = acceptedInvites[0]?.stripe_subscription_item_id;
        if (itemId) {
          await fetch(`https://api.stripe.com/v1/subscription_items/${itemId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ proration_behavior: "always_invoice" }).toString(),
          });
        }
      }
    } catch (_stripeErr) {
      // Non bloquant, voir commentaire ci-dessus.
    }

    // 5. Détacher le membre du cabinet et le repasser sur le plan par
    //    défaut (il perd l'accès payé par le cabinet).
    const detachRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${memberId}`, {
      method: "PATCH",
      headers: { ...svcHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify({ cabinet_role: null, cabinet_root_id: null, manager_id: null, plan: "trial" }),
    });
    if (!detachRes.ok) throw new Error("Erreur lors du retrait du membre.");

    return new Response(JSON.stringify({ removed: true, reassignedClients: clientCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
