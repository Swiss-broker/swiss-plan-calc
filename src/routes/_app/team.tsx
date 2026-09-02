// src/routes/_app/team.tsx
// Dashboard équipe : cartes chiffrées, liste des membres groupée par
// directeur, invitations en attente, formulaire d'invitation.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, UserPlus, TrendingUp, Loader2, X, Mail, Crown, MessageSquare, Send, ChevronDown, UserMinus } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCHF } from "@/lib/format";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Équipe · SwissBroker Pro" }] }),
  component: TeamPage,
});

interface MemberStats {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  cabinet_role: string;
  clientsCount: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTotal: number;
}

interface TeamGroup {
  director: MemberStats;
  courtiers: MemberStats[];
}

interface PendingInvite {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "director" | "courtier";
  invited_by: string;
  created_at: string;
}

interface TeamDashboardData {
  requester: { id: string; cabinet_role: string; cabinet_root_id: string; brokerage_name: string | null };
  teamData: TeamGroup[];
  pendingInvites: PendingInvite[];
  totals: {
    memberCount: number;
    clientsTotal: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueTotal: number;
  };
  monthlyHistory: { month: string; clients: number }[];
  heatmapRaw: { broker_id: string; created_at: string }[];
}

function fullName(m: { first_name: string | null; last_name: string | null; email: string }) {
  const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
  return name || m.email;
}

function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"team" | "invites">("team");
  const [guideOpen, setGuideOpen] = useState(false);
  

  const { data, isLoading, error } = useQuery<TeamDashboardData>({
    queryKey: ["team-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("team-dashboard-data");
      if (error || data?.error) throw new Error(data?.error ?? "Erreur de chargement.");
      return data as TeamDashboardData;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-dashboard", user?.id] });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Impossible de charger les données d'équipe."}
        </p>
      </div>
    );
  }

  const { totals, teamData, pendingInvites, requester } = data;

  const guideSteps: GuideStep[] = [
    { title: "Bienvenue sur votre page Équipe", body: "Retrouvez ici toute la gestion de votre cabinet : membres, invitations, activité et communication." },
    { target: "team-invite-btn", title: "Inviter quelqu'un", body: "Ajoutez un directeur ou un courtier à votre équipe. Choisissez qui règle le siège (290 CHF/mois) : le cabinet ou la personne elle-même." },
    { target: "team-announcements", title: "Annonces", body: "Postez un message à toute l'équipe, ou ciblez une personne précise." },
    { target: "team-stats", title: "Chiffres clés", body: "Nombre de membres, clients traités, chiffre d'affaires du mois et évolution en un coup d'œil." },
    { target: "team-podium", title: "Classement du mois", body: "Les 3 membres qui ont traité le plus de clients ce mois-ci." },
    { target: "team-chart", title: "Évolution des clients", body: "Le nombre de clients traités par toute l'équipe, mois par mois, sur les 6 derniers mois." },
    { target: "team-heatmap", title: "Activité de l'équipe", body: "Une case par jour sur les 12 dernières semaines, plus foncée quand l'équipe traite plus de clients. Filtrez par courtier avec le menu déroulant." },
    { target: "team-tabs", title: "Mon équipe et invitations", body: "Basculez entre la liste de vos membres actifs et vos invitations en attente." },
  ];
  const growth =
    totals.revenueLastMonth > 0
      ? ((totals.revenueThisMonth - totals.revenueLastMonth) / totals.revenueLastMonth) * 100
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Mon équipe
            {requester.cabinet_role === "root_director" && requester.brokerage_name && (
              <span className="text-muted-foreground"> · {requester.brokerage_name}</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {requester.cabinet_role === "root_director"
              ? "Vue d'ensemble de tout votre cabinet."
              : "Vue de votre propre équipe."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuideToggleButton onClick={() => setGuideOpen(true)} />
          <Button id="team-invite-btn" onClick={() => setInviteOpen(true)} className="gap-2 shadow-elegant">
            <UserPlus className="h-4 w-4" /> Inviter quelqu'un
          </Button>
        </div>
      </div>

      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide de la page Équipe"
        guideId="team-page-intro"
      />

        <div id="team-announcements">
        <TeamAnnouncements
          requesterId={requester.id}
          canPost={requester.cabinet_role === "root_director" || requester.cabinet_role === "director"}
          cabinetRootId={requester.cabinet_role === "root_director" ? requester.id : requester.cabinet_root_id}
          teamData={teamData}
        />
      </div>

      {/* Cartes chiffrées */}
      <div id="team-stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Membres" value={String(totals.memberCount)} />
        <StatCard icon={Users} label="Clients traités" value={String(totals.clientsTotal)} />
        <StatCard icon={TrendingUp} label="CA ce mois" value={formatCHF(totals.revenueThisMonth)} />
        <StatCard
          icon={TrendingUp}
          label="Évolution"
          value={growth === null ? "—" : `${growth >= 0 ? "+" : ""}${growth.toFixed(0)} %`}
          tone={growth === null ? "default" : growth >= 0 ? "success" : "warning"}
        />
      </div>

      {inviteOpen && (
        <InviteForm
          cabinetRootId={
            requester.cabinet_role === "root_director" ? requester.id : (data.teamData[0]?.director.id ?? requester.id)
          }
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            setInviteOpen(false);
            refresh();
          }}
        />
      )}

      {/* Onglets Mon équipe / Invitations */}
      <div id="team-tabs" className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "team"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mon équipe
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("invites")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "invites"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Invitations{pendingInvites.length > 0 ? ` (${pendingInvites.length})` : ""}
        </button>
      </div>

      {activeTab === "team" && (
        <div className="space-y-4">
          <div id="team-podium"><TeamPodium teamData={teamData} /></div>
          <div id="team-chart"><ClientsChart data={data.monthlyHistory} /></div>
          <div id="team-heatmap"><TeamActivityHeatmap teamData={teamData} rawData={data.heatmapRaw} /></div>
          {requester.cabinet_role === "root_director" && <OrgChart teamData={teamData} />}
          {teamData.map((group) => (
            <DirectorGroup
              key={group.director.id}
              group={group}
              requesterId={requester.id}
              requesterRole={requester.cabinet_role}
              allMembers={teamData.flatMap((d) => [d.director, ...d.courtiers])}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {activeTab === "invites" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune invitation en attente pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <PendingInviteRow key={inv.id} invite={inv} requesterId={requester.id} onCancelled={refresh} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

const HEATMAP_WEEKS = 12;
const HEATMAP_DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const HEATMAP_MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
// Paliers d'intensité en % de mélange avec --primary : calculés relativement
// au maximum observé (et non des seuils fixes), pour rester lisible que
// l'équipe traite 3 ou 30 clients par jour.
const HEATMAP_LEVEL_MIX = [0, 20, 42, 66, 92];

function mondayOf(d: Date) {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - day);
  c.setHours(0, 0, 0, 0);
  return c;
}

function TeamActivityHeatmap({
  teamData,
  rawData,
}: {
  teamData: TeamGroup[];
  rawData: { broker_id: string; created_at: string }[];
}) {
  const allMembers = teamData.flatMap((d) => [d.director, ...d.courtiers]);
  const [memberId, setMemberId] = useState<string>("all");

  const gridStart = new Date(mondayOf(new Date()));
  gridStart.setDate(gridStart.getDate() - (HEATMAP_WEEKS - 1) * 7);

  const filtered = memberId === "all" ? rawData : rawData.filter((r) => r.broker_id === memberId);

  const dayCounts = new Map<string, number>();
  for (const row of filtered) {
    const d = new Date(row.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const days: { date: Date; key: string; count: number }[] = [];
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    days.push({ date, key, count: dayCounts.get(key) ?? 0 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxCount = Math.max(0, ...days.map((d) => d.count));
  const levelOf = (count: number) => {
    if (count === 0 || maxCount === 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
  };

  const total = days.reduce((s, d) => s + d.count, 0);

  // Une étiquette de mois par colonne où le mois change, pour situer la grille
  // sans surcharger l'en-tête d'une graduation par semaine.
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < HEATMAP_WEEKS; col++) {
    const colDate = days[col * 7].date;
    if (colDate.getMonth() !== lastMonth) {
      monthLabels.push({ col, label: HEATMAP_MONTH_LABELS[colDate.getMonth()] });
      lastMonth = colDate.getMonth();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Activité de l'équipe
          </h2>
          <p className="mt-1 text-2xl font-bold">
            {total} clients <span className="text-sm font-normal text-muted-foreground">traités sur 12 semaines</span>
          </p>
        </div>
        {allMembers.length > 1 && (
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'équipe</SelectItem>
              {allMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {fullName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="flex pl-6">
            {Array.from({ length: HEATMAP_WEEKS }).map((_, col) => {
              const label = monthLabels.find((m) => m.col === col)?.label;
              return (
                <span key={col} className="w-4 text-[11px] whitespace-nowrap text-muted-foreground">
                  {label ?? ""}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex flex-col justify-between gap-[3px]">
              {HEATMAP_DAY_LABELS.map((label, i) => (
                <span
                  key={i}
                  className="flex h-[13px] w-4 items-center text-[10px] leading-none text-muted-foreground"
                >
                  {i % 2 === 1 ? label : ""}
                </span>
              ))}
            </div>
            {Array.from({ length: HEATMAP_WEEKS }).map((_, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, row) => {
                  const day = days[col * 7 + row];
                  const level = levelOf(day.count);
                  const isFuture = day.date > today;
                  const label = day.date.toLocaleDateString("fr-CH", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                  if (isFuture) {
                    return <div key={row} aria-hidden="true" className="h-[13px] w-[13px]" />;
                  }
                  return (
                    <div
                      key={row}
                      role="img"
                      aria-label={`${label} : ${day.count} client${day.count !== 1 ? "s" : ""} traité${day.count !== 1 ? "s" : ""}`}
                      title={`${label} — ${day.count} client${day.count !== 1 ? "s" : ""} traité${day.count !== 1 ? "s" : ""}`}
                      className="h-[13px] w-[13px] rounded-[3px] border border-border/60 transition-transform hover:scale-125"
                      style={{
                        background:
                          level === 0
                            ? "var(--muted)"
                            : `color-mix(in oklab, var(--primary) ${HEATMAP_LEVEL_MIX[level]}%, var(--card))`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>Moins</span>
        {HEATMAP_LEVEL_MIX.map((mix, i) => (
          <span
            key={i}
            className="h-[11px] w-[11px] rounded-[3px] border border-border/60"
            style={{
              background: i === 0 ? "var(--muted)" : `color-mix(in oklab, var(--primary) ${mix}%, var(--card))`,
            }}
          />
        ))}
        <span>Plus</span>
      </div>
    </div>
  );
}

function ClientsChart({ data }: { data: { month: string; clients: number }[] }) {
  if (data.every((d) => d.clients === 0)) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Évolution des clients traités sur 6 mois
      </h2>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="teamClientsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(v: number) => `${v} client${v > 1 ? "s" : ""}`}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="clients"
              name="Clients traités"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#teamClientsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface Announcement {
  id: string;
  message: string;
  posted_by: string;
  target_id: string | null;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

function TeamAnnouncements({
  requesterId,
  canPost,
  cabinetRootId,
  teamData,
}: {
  requesterId: string;
  canPost: boolean;
  cabinetRootId: string;
  teamData: TeamGroup[];
}) {
  const [message, setMessage] = useState("");
  const [targetId, setTargetId] = useState<string>("all");
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ announcements: Announcement[] }>({
    queryKey: ["team-announcements", requesterId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("team-get-announcements");
      if (error || data?.error) throw new Error(data?.error ?? "Erreur de chargement.");
      return data;
    },
  });

  const possibleTargets = teamData.flatMap((g) =>
    g.director.id === requesterId ? g.courtiers : [g.director, ...g.courtiers],
  );

  const onPost = async () => {
    if (!message.trim()) return;
    setPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke("team-post-announcement", {
        body: {
          cabinetRootId,
          message: message.trim(),
          targetId: targetId === "all" ? undefined : targetId,
        },
      });
      if (error || !data?.posted) throw new Error(data?.error ?? "Erreur lors de la publication.");
      setMessage("");
      setTargetId("all");
      toast.success("Annonce publiée.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la publication.");
    } finally {
      setPosting(false);
    }
  };

  const announcements = data?.announcements ?? [];
  const visible = expanded ? announcements : announcements.slice(0, 1);

  if (isLoading) return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Annonces de l'équipe
        </h2>
      </div>

      {canPost && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Écrire une annonce..."
              maxLength={500}
              onKeyDown={(e) => e.key === "Enter" && onPost()}
            />
            <Button onClick={onPost} disabled={posting || !message.trim()} size="icon">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {possibleTargets.length > 0 && (
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-8 w-fit text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute l'équipe</SelectItem>
                {possibleTargets.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {fullName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune annonce pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <div key={a.id} className="rounded-lg bg-card p-3 text-sm">
              <p>{a.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {fullName({
                  first_name: a.profiles?.first_name ?? null,
                  last_name: a.profiles?.last_name ?? null,
                  email: "",
                })}
                {" · "}
                {new Date(a.created_at).toLocaleDateString("fr-CH")}
                {a.target_id && <span className="ml-1 text-primary">(message ciblé)</span>}
              </p>
            </div>
          ))}
          {announcements.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {expanded ? "Voir moins" : `Voir ${announcements.length - 1} de plus`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TeamPodium({ teamData }: { teamData: TeamGroup[] }) {
  const allMembers = teamData.flatMap((d) => [d.director, ...d.courtiers]);
  const sorted = [...allMembers].sort((a, b) => b.clientsCount - a.clientsCount);
  const top3 = sorted.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  if (top3.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Classement du mois, clients traités
      </h2>
      <div className="mt-4 space-y-2">
        {top3.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{medals[i]}</span>
              <span className="text-sm font-medium">{fullName(m)}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{m.clientsCount} clients</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgChart({ teamData }: { teamData: TeamGroup[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Organigramme
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {teamData.map((group) => {
          const isOpen = openId === group.director.id;
          return (
            <div key={group.director.id} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : group.director.id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                  isOpen ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/60"
                }`}
              >
                <Crown className="h-4 w-4 text-primary" />
                <span>{fullName(group.director)}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {group.courtiers.length}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="mt-2 flex flex-wrap justify-center gap-2 rounded-xl bg-muted/20 p-3">
                  {group.courtiers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun courtier</p>
                  ) : (
                    group.courtiers.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium"
                      >
                        {fullName(c)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DirectorGroup({
  group,
  requesterId,
  requesterRole,
  allMembers,
  onChanged,
}: {
  group: TeamGroup;
  requesterId: string;
  requesterRole: string;
  allMembers: MemberStats[];
  onChanged: () => void;
}) {
  const { director, courtiers } = group;
  // Le directeur racine peut retirer n'importe quel autre directeur ou
  // courtier de son cabinet ; un directeur simple ne peut retirer que ses
  // propres courtiers directs (même règle côté serveur, voir
  // cabinet-remove-member).
  const canRemoveDirector = requesterRole === "root_director" && director.id !== requesterId;
  const canRemoveCourtiers = requesterRole === "root_director" || director.id === requesterId;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span className="font-semibold">{fullName(director)}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
            {director.cabinet_role === "root_director" ? "Directeur principal" : "Directeur"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>{director.clientsCount} clients</span>
          <span>{formatCHF(director.revenueThisMonth)} ce mois</span>
          {canRemoveDirector && (
            <RemoveMemberControl member={director} allMembers={allMembers} onRemoved={onChanged} />
          )}
        </div>
      </div>
      {courtiers.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Aucun courtier dans cette équipe pour le moment.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {courtiers.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium">{fullName(c)}</div>
                <div className="text-xs text-muted-foreground">Courtier</div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{c.clientsCount} clients</span>
                <span>{formatCHF(c.revenueThisMonth)} ce mois</span>
                <span className="hidden sm:inline">{formatCHF(c.revenueTotal)} au total</span>
                {canRemoveCourtiers && (
                  <RemoveMemberControl member={c} allMembers={allMembers} onRemoved={onChanged} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoveMemberControl({
  member,
  allMembers,
  onRemoved,
}: {
  member: MemberStats;
  allMembers: MemberStats[];
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reassignToId, setReassignToId] = useState("");
  const [loading, setLoading] = useState(false);
  const candidates = allMembers.filter((m) => m.id !== member.id);

  const onConfirm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cabinet-remove-member", {
        body: { memberId: member.id, reassignToId: reassignToId || undefined },
      });
      if (error || data?.error) {
        let msg = data?.error ?? error?.message ?? "Erreur lors du retrait.";
        const ctx = (error as unknown as { context?: Response })?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) msg = String(body.error);
          } catch {
            // corps non exploitable
          }
        }
        throw new Error(msg);
      }
      toast.success(`${fullName(member)} a été retiré du cabinet.`);
      setOpen(false);
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du retrait.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
      >
        <UserMinus className="h-3 w-3" /> Retirer
      </button>
    );
  }

  return (
    <div className="w-full basis-full rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2">
      <p className="text-foreground">
        Retirer <strong>{fullName(member)}</strong> du cabinet ?{" "}
        {member.clientsCount > 0
          ? `Cette personne a ${member.clientsCount} dossier(s) client, à réattribuer avant le retrait.`
          : "Cette personne n'a aucun dossier client."}
      </p>
      {member.clientsCount > 0 && (
        <div className="space-y-1">
          <Label className="text-[11px]">Réattribuer ses dossiers à</Label>
          <Select value={reassignToId} onValueChange={setReassignToId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choisir un destinataire" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {fullName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={onConfirm}
          disabled={loading || (member.clientsCount > 0 && !reassignToId)}
          className="gap-1"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmer le retrait
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function PendingInviteRow({
  invite,
  requesterId,
  onCancelled,
}: {
  invite: PendingInvite;
  requesterId: string;
  onCancelled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const canCancel = invite.invited_by === requesterId;

  const onCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cabinet-cancel-invite", {
        body: { inviteId: invite.id },
      });
      if (error || data?.error) throw new Error(data?.error ?? "Erreur lors de l'annulation.");
      toast.success("Invitation annulée.");
      onCancelled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'annulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Mail className="h-3.5 w-3.5 text-amber-700" />
        <span className="font-medium">{fullName(invite)}</span>
        <span className="text-xs text-amber-700">
          , invité en tant que {invite.role === "director" ? "directeur" : "courtier"}
        </span>
      </div>
      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Annuler
        </button>
      )}
    </div>
  );
}

function InviteForm({
  cabinetRootId,
  onClose,
  onSuccess,
}: {
  cabinetRootId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"courtier" | "director">("courtier");
  const [payer, setPayer] = useState<"cabinet" | "self">("cabinet");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendInvite = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cabinet-add-seat", {
        body: {
          cabinetRootId,
          inviteeEmail: email.trim(),
          inviteeFirstName: firstName.trim() || undefined,
          inviteeLastName: lastName.trim() || undefined,
          role,
          payer,
        },
      });
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (error || !data?.sent) {
        let msg = error?.message ?? "Erreur lors de l'envoi de l'invitation.";
        const ctx = (error as unknown as { context?: Response })?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) msg = String(body.error);
          } catch {
            // corps non exploitable
          }
        }
        throw new Error(msg);
      }
      toast.success(`Invitation envoyée à ${email.trim()}.`);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi de l'invitation.");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const onSubmit = () => {
    if (!email.trim()) {
      toast.error("L'email est requis.");
      return;
    }
    if (payer === "cabinet") {
      // Un vrai débit va se produire, on demande confirmation avant.
      setConfirmOpen(true);
      return;
    }
    // Le courtier paiera lui-même, aucun débit ici, on envoie directement.
    sendInvite();
  };

  if (confirmOpen) {
    return (
      <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5 shadow-card space-y-4">
        <h3 className="text-base font-semibold">Confirmer la facturation</h3>
        <p className="text-sm text-foreground">
          Ce siège sera facturé <strong>290 CHF/mois</strong>, débités immédiatement sur la carte enregistrée
          du cabinet. Confirmer l'envoi de l'invitation à <strong>{email.trim()}</strong> ?
        </p>
        <div className="flex gap-2">
          <Button onClick={sendInvite} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer et débiter 290 CHF
          </Button>
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Inviter un nouveau membre</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Prénom</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nom</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Rôle</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "courtier" | "director")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="courtier">Courtier, accès standard</SelectItem>
              <SelectItem value="director">Directeur, peut gérer sa propre équipe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Qui règle ce siège ? (290 CHF/mois)</Label>
          <Select value={payer} onValueChange={(v) => setPayer(v as "cabinet" | "self")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cabinet">Le cabinet, accès débloqué immédiatement</SelectItem>
              <SelectItem value="self">La personne elle-même, elle paie à son inscription</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {payer === "cabinet"
              ? "290 CHF/mois seront débités de votre carte dès l'envoi de l'invitation."
              : "Aucun débit pour vous. La personne devra régler son propre abonnement pour créer son compte."}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Envoyer l'invitation
        </Button>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Conseil : si la personne invitée ne reçoit rien après quelques minutes, demandez-lui de vérifier son
        dossier spam / courrier indésirable.
      </p>
    </div>
  );
}