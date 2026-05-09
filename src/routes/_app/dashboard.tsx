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
  BookOpen,
  Sun,
  Moon,
  Coffee,
  Trophy,
  Target,
  Zap,
  PiggyBank,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useLanguage } from "@/contexts/LanguageContext";
import { formatDateShort } from "@/lib/i18n/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: translate("dash.head.title") }] }),
  component: Dashboard,
});

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 6) return { key: "dash.greet.night", icon: Moon };
  if (h < 12) return { key: "dash.greet.morning", icon: Sun };
  if (h < 18) return { key: "dash.greet.afternoon", icon: Sun };
  return { key: "dash.greet.evening", icon: Coffee };
}

function Dashboard() {
  const t = useT();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const brokerId = user?.id;
  const greeting = getGreetingKey();
  const GreetIcon = greeting.icon;
  const tipKey = `dash.tip.${(new Date().getDate() % 6) + 1}`;
  const tip = t(tipKey);

  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile", brokerId],
    enabled: Boolean(brokerId),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, brokerage_name")
        .eq("id", brokerId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", brokerId],
    enabled: Boolean(brokerId),
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [clientsActive, clientsArchived, companies, simsMonth, simsTotal] =
        await Promise.all([
          supabase.from("clients").select("id", { count: "exact", head: true }).eq("broker_id", brokerId!).eq("archived", false),
          supabase.from("clients").select("id", { count: "exact", head: true }).eq("broker_id", brokerId!).eq("archived", true),
          supabase.from("companies").select("id", { count: "exact", head: true }).eq("broker_id", brokerId!).eq("archived", false),
          supabase.from("simulation_history").select("id", { count: "exact", head: true }).eq("broker_id", brokerId!).gte("created_at", monthStart.toISOString()),
          supabase.from("simulation_history").select("id", { count: "exact", head: true }).eq("broker_id", brokerId!),
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

  const firstName = profile?.first_name || user?.email?.split("@")[0] || t("dash.fallback.broker");

  const totalActivity = (stats?.clientsActive ?? 0) + (stats?.simsTotal ?? 0);
  const level = Math.max(1, Math.floor(Math.sqrt(totalActivity)) + 1);
  const nextLevelAt = level * level;
  const progressPct = Math.min(100, Math.round((totalActivity / Math.max(1, nextLevelAt)) * 100));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 shadow-card">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-elegant">
              <GreetIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t(greeting.key)}, <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{firstName}</span> {t("dash.hello.suffix")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.brokerage_name ? `${profile.brokerage_name} · ` : ""}
                {t("dash.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/clients">
              <Button className="shadow-elegant"><PlusCircle className="h-4 w-4" /> {t("dash.cta.new_client")}</Button>
            </Link>
            <Link to="/calculators">
              <Button variant="outline"><Calculator className="h-4 w-4" /> {t("dash.cta.calculate")}</Button>
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Trophy className="h-3.5 w-3.5" /> {t("dash.level.title")}
            </div>
            <div className="mt-1 text-2xl font-bold">{t("dash.level.value", { n: level })}</div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {t("dash.level.progress", { current: totalActivity, target: nextLevelAt, next: level + 1 })}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Target className="h-3.5 w-3.5" /> {t("dash.goal.title")}
            </div>
            <div className="mt-1 text-2xl font-bold">{stats?.simsMonth ?? 0} / 20</div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${Math.min(100, ((stats?.simsMonth ?? 0) / 20) * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{t("dash.goal.hint")}</div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Zap className="h-3.5 w-3.5" /> {t("dash.tip.title")}
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{tip}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("dash.kpi.clients_active")}
          value={stats?.clientsActive}
          hint={stats?.clientsArchived ? t("dash.kpi.clients_active.archived", { n: stats.clientsArchived }) : t("dash.kpi.clients_active.empty")}
          icon={Users} accent="from-blue-500/15 to-blue-500/0" iconColor="text-blue-500"
        />
        <KpiCard
          label={t("dash.kpi.companies")}
          value={stats?.companies}
          hint={t("dash.kpi.companies.hint")}
          icon={Building2} accent="from-purple-500/15 to-purple-500/0" iconColor="text-purple-500"
        />
        <KpiCard
          label={t("dash.kpi.sims_month")}
          value={stats?.simsMonth}
          hint={stats?.simsTotal ? t("dash.kpi.sims_month.total", { n: stats.simsTotal }) : undefined}
          icon={TrendingUp} accent="from-emerald-500/15 to-emerald-500/0" iconColor="text-emerald-500"
        />
        <KpiCard
          label={t("dash.kpi.calculators")}
          value={11}
          hint={t("dash.kpi.calculators.hint")}
          icon={Calculator} accent="from-amber-500/15 to-amber-500/0" iconColor="text-amber-500"
        />
      </div>

      {/* RACCOURCIS CALCULATEURS */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("dash.shortcuts.title")}</h2>
          <Link to="/calculators"><Button variant="ghost" size="sm">{t("dash.shortcuts.all")} <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard to="/calculators/avs-ai" icon={Shield} title={t("dash.shortcut.avs")} color="text-rose-500" bg="bg-rose-500/10" />
          <ShortcutCard to="/calculators/lpp" icon={PiggyBank} title={t("dash.shortcut.lpp")} color="text-blue-500" bg="bg-blue-500/10" />
          <ShortcutCard to="/calculators/pillar3a" icon={Sparkles} title={t("dash.shortcut.p3")} color="text-emerald-500" bg="bg-emerald-500/10" />
          <ShortcutCard to="/calculators/cross-border" icon={Globe} title={t("dash.shortcut.cb")} color="text-amber-500" bg="bg-amber-500/10" />
        </div>
      </div>

      {/* HISTORIQUE + WIKI */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {t("dash.recent.title")}
            </h3>
            <Link to="/history"><Button variant="ghost" size="sm">{t("dash.recent.all")} <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
          {recentSims === undefined ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : recentSims.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="font-medium text-foreground">{t("dash.recent.empty.title")}</p>
              <p className="mt-1">{t("dash.recent.empty.desc")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentSims.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateShort(s.created_at, lang)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-[10px]">{s.kind}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/wiki" className="group rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elegant">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t("dash.wiki.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("dash.wiki.desc")}</p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            {t("dash.wiki.cta")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  iconColor,
}: {
  label: string;
  value: number | undefined;
  hint?: string;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${accent} bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">
        {value === undefined ? <span className="text-muted-foreground/40">···</span> : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  color,
  bg,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  color: string;
  bg: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {/* arrow icon visual cue only */}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
