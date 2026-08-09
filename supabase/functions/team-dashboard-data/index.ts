// supabase/functions/team-dashboard-data/index.ts
// Calcule toutes les données du dashboard équipe (membres, chiffres,
// invitations en attente, historique mensuel, heatmap d'activité), en
// respectant les règles de visibilité :
// - Un directeur principal voit tous les directeurs de son cabinet et,
//   sous chacun, leurs courtiers directs.
// - Un directeur normal ne voit que ses propres courtiers directs.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sb(supabaseUrl: string, supabaseKey: string, path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
  });
  return res.json();
}

function monthStartISO(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function monthLabel(offsetMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  return d.toLocaleDateString("fr-CH", { month: "short", year: "2-digit" });
}

// Lundi de la semaine contenant la date donnée, heure remise à zéro.
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { requesterId } = await req.json();
    if (!requesterId) throw new Error("Paramètre manquant.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Variables manquantes");

    // 1. Qui demande, et avec quel rôle ?
    const requesterRows = await sb(
      supabaseUrl, supabaseKey,
      `profiles?id=eq.${requesterId}&select=id,first_name,last_name,email,cabinet_role,cabinet_root_id,brokerage_name`,
    );
    const requester = requesterRows[0];
    if (!requester || !requester.cabinet_role) {
      throw new Error("Ce compte ne fait pas partie d'un cabinet.");
    }

    // 2. Déterminer la liste des "directeurs" visibles.
    let directors: any[] = [requester];
    if (requester.cabinet_role === "root_director") {
      const others = await sb(
        supabaseUrl, supabaseKey,
        `profiles?cabinet_root_id=eq.${requester.cabinet_root_id}&cabinet_role=eq.director&select=id,first_name,last_name,email,cabinet_role`,
      );
      directors = [requester, ...others];
    }

    // 3. Pour chaque directeur visible, récupérer ses courtiers directs.
    const monthStart = monthStartISO(0);
    const lastMonthStart = monthStartISO(-1);

    async function computeStats(personId: string) {
      const [clientsCount, invoicesMonth, invoicesLastMonth, invoicesTotal] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/clients?broker_id=eq.${personId}&archived=eq.false&select=id`, {
          headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Prefer": "count=exact" },
        }).then((r) => Number(r.headers.get("content-range")?.split("/")[1] ?? 0)),
        sb(supabaseUrl, supabaseKey, `rdv_invoices?broker_id=eq.${personId}&status=eq.paid&created_at=gte.${monthStart}&select=amount_chf`),
        sb(supabaseUrl, supabaseKey, `rdv_invoices?broker_id=eq.${personId}&status=eq.paid&created_at=gte.${lastMonthStart}&created_at=lt.${monthStart}&select=amount_chf`),
        sb(supabaseUrl, supabaseKey, `rdv_invoices?broker_id=eq.${personId}&status=eq.paid&select=amount_chf`),
      ]);
      const sum = (rows: any[]) => rows.reduce((s, r) => s + (r.amount_chf ?? 0), 0) / 100;
      return {
        clientsCount,
        revenueThisMonth: sum(invoicesMonth),
        revenueLastMonth: sum(invoicesLastMonth),
        revenueTotal: sum(invoicesTotal),
      };
    }

    const teamData = [];
    const allMemberIds: string[] = [];
    for (const director of directors) {
      const courtiers = await sb(
        supabaseUrl, supabaseKey,
        `profiles?manager_id=eq.${director.id}&select=id,first_name,last_name,email,cabinet_role`,
      );
      const directorStats = await computeStats(director.id);
      const courtiersWithStats = [];
      for (const c of courtiers) {
        const stats = await computeStats(c.id);
        courtiersWithStats.push({ ...c, ...stats });
        allMemberIds.push(c.id);
      }
      allMemberIds.push(director.id);
      teamData.push({ director: { ...director, ...directorStats }, courtiers: courtiersWithStats });
    }

    // 4. Historique mensuel du nombre de clients créés par toute l'équipe,
    //    sur les 6 derniers mois, pour le graphique d'évolution.
    const monthlyHistory = [];
    if (allMemberIds.length > 0) {
      const idsFilter = allMemberIds.join(",");
      for (let offset = -5; offset <= 0; offset++) {
        const start = monthStartISO(offset);
        const end = monthStartISO(offset + 1);
        const countRes = await fetch(
          `${supabaseUrl}/rest/v1/clients?broker_id=in.(${idsFilter})&created_at=gte.${start}&created_at=lt.${end}&select=id`,
          { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Prefer": "count=exact" } },
        );
        const count = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0);
        monthlyHistory.push({ month: monthLabel(offset), clients: count });
      }
    }

    // 5. Heatmap d'activité : nombre de clients créés par l'équipe, pour
    //    chaque jour de la semaine (lundi à dimanche) sur les 12 dernières
    //    semaines complètes. Une seule requête large, puis on répartit les
    //    résultats en mémoire plutôt que 84 petites requêtes séparées.
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0));
    if (allMemberIds.length > 0) {
      const idsFilter = allMemberIds.join(",");
      const currentWeekMonday = mondayOf(new Date());
      const rangeStart = new Date(currentWeekMonday);
      rangeStart.setDate(rangeStart.getDate() - 11 * 7);

      const clientsInRange = await sb(
        supabaseUrl, supabaseKey,
        `clients?broker_id=in.(${idsFilter})&created_at=gte.${rangeStart.toISOString()}&select=broker_id,created_at`,
      );

      for (const row of clientsInRange as { broker_id: string; created_at: string }[]) {
        const created = new Date(row.created_at);
        const rowMonday = mondayOf(created);
        const weekIndex = Math.round((rowMonday.getTime() - rangeStart.getTime()) / (7 * 24 * 3600 * 1000));
        const dayIndex = (created.getDay() + 6) % 7; // 0 = lundi
        if (weekIndex >= 0 && weekIndex < 12) {
          heatmap[dayIndex][weekIndex] += 1;
        }
      }

      // Détail brut (qui, quand), pour permettre à la page de recalculer
      // la heatmap filtrée sur un seul membre de l'équipe, sans refaire
      // une requête serveur à chaque changement du menu déroulant.
      var heatmapRaw = clientsInRange;
    }

    // 6. Invitations en attente, uniquement celles envoyées par les
    //    personnes visibles.
    const visibleInviterIds = directors.map((d) => d.id);
    const pendingInvites = await sb(
      supabaseUrl, supabaseKey,
      `cabinet_invites?invited_by=in.(${visibleInviterIds.join(",")})&status=eq.pending&select=id,email,first_name,last_name,role,invited_by,created_at`,
    );

    // 7. Totaux consolidés.
    const allMembers = teamData.flatMap((d) => [d.director, ...d.courtiers]);
    const totals = {
      memberCount: allMembers.length,
      clientsTotal: allMembers.reduce((s, m) => s + m.clientsCount, 0),
      revenueThisMonth: allMembers.reduce((s, m) => s + m.revenueThisMonth, 0),
      revenueLastMonth: allMembers.reduce((s, m) => s + m.revenueLastMonth, 0),
      revenueTotal: allMembers.reduce((s, m) => s + m.revenueTotal, 0),
    };

    return new Response(
      JSON.stringify({
        requester,
        teamData,
        pendingInvites,
        totals,
        monthlyHistory,
        heatmap,
        heatmapRaw: typeof heatmapRaw !== "undefined" ? heatmapRaw : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});