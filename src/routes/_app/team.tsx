// src/routes/_app/team.tsx
// Dashboard équipe : cartes chiffrées, liste des membres groupée par
// directeur, invitations en attente, formulaire d'invitation.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, UserPlus, TrendingUp, Loader2, X, Mail, Crown } from "lucide-react";
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
  requester: { id: string; cabinet_role: string };
  teamData: TeamGroup[];
  pendingInvites: PendingInvite[];
  totals: {
    memberCount: number;
    clientsTotal: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueTotal: number;
  };
}

function fullName(m: { first_name: string | null; last_name: string | null; email: string }) {
  const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
  return name || m.email;
}

function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading, error } = useQuery<TeamDashboardData>({
    queryKey: ["team-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("team-dashboard-data", {
        body: { requesterId: user!.id },
      });
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
  const growth =
    totals.revenueLastMonth > 0
      ? ((totals.revenueThisMonth - totals.revenueLastMonth) / totals.revenueLastMonth) * 100
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mon équipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {requester.cabinet_role === "root_director"
              ? "Vue d'ensemble de tout votre cabinet."
              : "Vue de votre propre équipe."}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-elegant">
          <UserPlus className="h-4 w-4" /> Inviter quelqu'un
        </Button>
      </div>

      {/* Cartes chiffrées */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          inviterId={requester.id}
          inviterEmail={user?.email ?? ""}
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            setInviteOpen(false);
            refresh();
          }}
        />
      )}

      {/* Invitations en attente */}
      {pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invitations en attente ({pendingInvites.length})
          </h2>
          <div className="mt-3 space-y-2">
            {pendingInvites.map((inv) => (
              <PendingInviteRow key={inv.id} invite={inv} requesterId={requester.id} onCancelled={refresh} />
            ))}
          </div>
        </div>
      )}

      {/* Liste des membres, groupée par directeur */}
      <div className="space-y-4">
        {teamData.map((group) => (
          <DirectorGroup key={group.director.id} group={group} />
        ))}
      </div>
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

function DirectorGroup({ group }: { group: TeamGroup }) {
  const { director, courtiers } = group;
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
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{director.clientsCount} clients</span>
          <span>{formatCHF(director.revenueThisMonth)} ce mois</span>
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
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{c.clientsCount} clients</span>
                <span>{formatCHF(c.revenueThisMonth)} ce mois</span>
                <span className="hidden sm:inline">{formatCHF(c.revenueTotal)} au total</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
        body: { inviteId: invite.id, requesterId },
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
          — invité en tant que {invite.role === "director" ? "directeur" : "courtier"}
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
  inviterId,
  inviterEmail,
  onClose,
  onSuccess,
}: {
  cabinetRootId: string;
  inviterId: string;
  inviterEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"courtier" | "director">("courtier");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      toast.error("L'email est requis.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cabinet-add-seat", {
        body: {
          inviterId,
          inviterEmail,
          cabinetRootId,
          inviteeEmail: email.trim(),
          inviteeFirstName: firstName.trim() || undefined,
          inviteeLastName: lastName.trim() || undefined,
          role,
        },
      });
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
    }
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Inviter un nouveau membre</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        290 CHF/mois seront ajoutés à votre abonnement dès l'envoi de l'invitation. L'accès de la personne
        sera débloqué automatiquement à la création de son compte.
      </p>
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
              <SelectItem value="courtier">Courtier — accès standard</SelectItem>
              <SelectItem value="director">Directeur — peut gérer sa propre équipe</SelectItem>
            </SelectContent>
          </Select>
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
    </div>
  );
}