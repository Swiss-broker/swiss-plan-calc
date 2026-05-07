import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Calculator,
  TrendingUp,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Building2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · SwissBroker Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const brokerId = user?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", brokerId],
    enabled: Boolean(brokerId),
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [clientsActive, clientsArchived, companies, simsMonth, simsTotal] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", brokerId!)
            .eq("archived", false),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", brokerId!)
            .eq("archived", true),
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", brokerId!)
            .eq("archived", false),
          supabase
            .from("simulation_history")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", brokerId!)
            .gte("created_at", monthStart.toISOString()),
          supabase
            .from("simulation_history")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", brokerId!),
        ]);

      return {
        clientsActive: clientsActive.count ?? 0,
        clientsArchived: clientsArchived.count ?? 0,
        companies: companies.count ?? 0,
        simsMonth: simsMonth.count ?? 0,
        simsTotal: simsTotal.count ?? 0,
      };
    },
  });

  const { data: recentSims } = useQuery({
    queryKey: ["dashboard-recent-sims", brokerId],
    enabled: Boolean(brokerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_history")
        .select("id, kind, title, created_at")
        .eq("broker_id", brokerId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue sur votre espace courtier. Vue consolidée de votre activité.
          </p>
        </div>
        <Link to="/clients">
          <Button className="shadow-elegant">
            <PlusCircle className="h-4 w-4" />
            Nouveau client
          </Button>
        </Link>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Clients actifs"
          value={String(stats?.clientsActive ?? "…")}
          hint={stats?.clientsArchived ? `${stats.clientsArchived} archivé(s)` : undefined}
          icon={Users}
        />
        <KpiCard
          label="Sociétés"
          value={String(stats?.companies ?? "…")}
          icon={Building2}
        />
        <KpiCard
          label="Simulations ce mois"
          value={String(stats?.simsMonth ?? "…")}
          hint={stats?.simsTotal ? `${stats.simsTotal} au total` : undefined}
          icon={TrendingUp}
        />
        <KpiCard label="Calculateurs disponibles" value="11" icon={Calculator} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <ActionCard
          to="/clients"
          title="Gérer mes clients"
          desc="Créez un dossier complet : identité, situation fiscale, prévoyance, patrimoine. Lancez ensuite des simulations chiffrées."
          cta="Voir mes clients"
        />
        <ActionCard
          to="/calculators"
          title="Calculateurs"
          desc="AVS/AI, LPP & rachats, 3e pilier A&B, libre passage, frontaliers, impôts, rente vs capital, salaire/dividende, comparateur cantonal."
          cta="Ouvrir les calculateurs"
        />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Dernières simulations
          </h3>
          <Link to="/history">
            <Button variant="ghost" size="sm">
              Tout l'historique
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {recentSims === undefined ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : recentSims.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            Aucune simulation enregistrée pour le moment. Lancez un calculateur et cliquez
            sur « Sauvegarder » pour la retrouver ici.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recentSims.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.kind} · {new Date(s.created_at).toLocaleDateString("fr-CH")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ActionCard({
  to,
  title,
  desc,
  cta,
}: {
  to: "/clients" | "/calculators";
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <Link to={to} className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
