// supabase/functions/team-dashboard-data/index.ts
// Calcule toutes les données du dashboard équipe (membres, chiffres,
// invitations en attente), en respectant les règles de visibilité :
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
      `profiles?id=eq.${requesterId}&select=id,first_name,last_name,email,cabinet_role,cabinet_root_id`,
    );
    const requester = requesterRows[0];
    if (!requester || !requester.cabinet_role) {
      throw new Error("Ce compte ne fait pas partie d'un cabinet.");
    }

    // 2. Déterminer la liste des "directeurs" visibles (au sens : la
    //    personne elle-même, et si elle est directeur racine, tous les
    //    autres directeurs de son cabinet).
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
      }
      teamData.push({ director: { ...director, ...directorStats }, courtiers: courtiersWithStats });
    }

    // 4. Invitations en attente, uniquement celles envoyées par les
    //    personnes visibles (le demandeur, et les directeurs sous lui
    //    s'il est directeur racine).
    const visibleInviterIds = directors.map((d) => d.id);
    const pendingInvites = await sb(
      supabaseUrl, supabaseKey,
      `cabinet_invites?invited_by=in.(${visibleInviterIds.join(",")})&status=eq.pending&select=id,email,first_name,last_name,role,invited_by,created_at`,
    );

    // 5. Totaux consolidés.
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