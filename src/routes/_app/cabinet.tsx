// Page « Mon cabinet » (patron uniquement) : équipe, invitations, cotisations
// et paiements des rendez-vous encaissés sur le compte du cabinet.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Mail, UserPlus, Users } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCabinet, callCabinet } from "@/hooks/useCabinet";
import { computeCommissionCentimes } from "@/lib/billing/commission";
import { formatCHF } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const searchSchema = z.object({ siege: fallback(z.string().optional(), undefined) });

export const Route = createFileRoute("/_app/cabinet")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Mon cabinet · SwissBroker Pro" }] }),
  component: CabinetPage,
});

type Payer = "cabinet" | "self";

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  plan: string;
  cabinet_payer: Payer | null;
  cabinet_joined_at: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  payer: Payer;
  status: "awaiting_payment" | "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  broker_id: string;
  client_id: string | null;
  amount_chf: number;
  commission_centimes: number | null;
  status: string;
  created_at: string;
  snapshot_first_name: string | null;
  snapshot_last_name: string | null;
}

const fullName = (p: { first_name: string | null; last_name: string | null }, fallbackText = "—") =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || fallbackText;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("fr-CH", { month: "long", year: "numeric" });

function CabinetPage() {
  const { user } = useAuth();
  const cabinet = useCabinet();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { siege } = Route.useSearch();

  useEffect(() => {
    if (siege === "ok") toast.success("Paiement reçu : l'invitation part au collaborateur dans quelques instants.");
    if (siege === "annule") toast.info("Paiement annulé : l'invitation reste en attente de paiement.");
    if (siege) navigate({ to: "/cabinet", search: {}, replace: true });
  }, [siege, navigate]);

  const enabled = !!user && cabinet.role === "patron";

  const members = useQuery({
    queryKey: ["cabinet-members", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,email,plan,cabinet_payer,cabinet_joined_at")
        .eq("cabinet_root_id", user!.id)
        .eq("cabinet_role", "courtier")
        .order("last_name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const invites = useQuery({
    queryKey: ["cabinet-invites", user?.id],
    enabled,
    // Après le paiement d'un siège, le webhook bascule l'invitation : on
    // rafraîchit quelques fois pour l'afficher sans recharger la page.
    refetchInterval: (q) =>
      (q.state.data as InviteRow[] | undefined)?.some((i) => i.status === "awaiting_payment") ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cabinet_invites")
        .select("id,email,first_name,last_name,payer,status,expires_at,created_at")
        .eq("cabinet_root_id", user!.id)
        .in("status", ["awaiting_payment", "pending"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });

  const clientCounts = useQuery({
    queryKey: ["cabinet-client-counts", user?.id, (members.data ?? []).map((m) => m.id).join(",")],
    enabled: enabled && !!members.data?.length,
    queryFn: async () => {
      const ids = members.data!.map((m) => m.id);
      const { data, error } = await supabase.from("clients").select("broker_id").in("broker_id", ids).eq("archived", false);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.broker_id] = (map[r.broker_id] ?? 0) + 1;
      return map;
    },
  });

  const invoices = useQuery({
    queryKey: ["cabinet-invoices", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rdv_invoices")
        .select("id,broker_id,client_id,amount_chf,commission_centimes,status,created_at,snapshot_first_name,snapshot_last_name")
        .eq("cabinet_root_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as InvoiceRow[];
    },
  });

  const bank = useQuery({
    queryKey: ["cabinet-bank", user?.id],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("broker_connect_accounts")
        .select("onboarding_complete")
        .eq("broker_id", user!.id)
        .maybeSingle();
      return !!data?.onboarding_complete;
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["cabinet-members"] });
    qc.invalidateQueries({ queryKey: ["cabinet-invites"] });
    qc.invalidateQueries({ queryKey: ["cabinet-client-counts"] });
    qc.invalidateQueries({ queryKey: ["cabinet-invoices"] });
  };

  if (cabinet.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cabinet.role !== "patron") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Mon cabinet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page est réservée au responsable d'un cabinet. Vous pouvez créer le vôtre depuis votre profil.
        </p>
        <Button asChild className="mt-4">
          <Link to="/account" search={{ tab: "cabinet" }}>Aller à mon profil</Link>
        </Button>
      </div>
    );
  }

  const memberById = Object.fromEntries((members.data ?? []).map((m) => [m.id, m]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{cabinet.cabinetName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cabinet.cabinetAddress ? `${cabinet.cabinetAddress} · ` : ""}
          Votre équipe, ses cotisations et les paiements encaissés par le cabinet.
        </p>
      </div>

      {bank.data === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Le compte bancaire du cabinet n'est pas encore connecté : vos collaborateurs ne peuvent pas facturer leurs
              rendez-vous tant qu'il manque.
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/account" search={{ tab: "paiements" }}>Connecter le compte</Link>
          </Button>
        </div>
      )}

      <InviteForm onDone={refreshAll} />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Équipe</h2>
          <span className="text-sm text-muted-foreground">({members.data?.length ?? 0})</span>
        </div>
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !members.data?.length ? (
          <p className="text-sm text-muted-foreground">Aucun collaborateur pour l'instant. Invitez votre premier collaborateur ci-dessus.</p>
        ) : (
          <div className="divide-y divide-border">
            {members.data.map((m) => (
              <MemberRow key={m.id} member={m} clients={clientCounts.data?.[m.id] ?? 0} onChanged={refreshAll} />
            ))}
          </div>
        )}
      </section>

      {!!invites.data?.length && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Invitations en cours</h2>
          </div>
          <div className="divide-y divide-border">
            {invites.data.map((i) => (
              <InviteRowView key={i.id} invite={i} onChanged={refreshAll} />
            ))}
          </div>
        </section>
      )}

      <PaymentsSection invoices={invoices.data ?? []} loading={invoices.isLoading} memberById={memberById} patronId={user!.id} />
    </div>
  );
}

function PayerChoice({ value, onChange, name }: { value: Payer; onChange: (p: Payer) => void; name: string }) {
  const opts: Array<{ v: Payer; title: string; text: string }> = [
    { v: "cabinet", title: "Le cabinet paie", text: "Vous réglez la cotisation annuelle de ce collaborateur (paiement par carte, renouvelé chaque année)." },
    { v: "self", title: "Le collaborateur paie", text: "Il règle lui-même sa cotisation depuis son compte." },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
      {opts.map((o) => (
        <label
          key={o.v}
          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
            value === o.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
          }`}
        >
          <input type="radio" name={name} className="mt-1 accent-[var(--primary)]" checked={value === o.v} onChange={() => onChange(o.v)} />
          <span className="min-w-0">
            <span className="block font-medium">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [payer, setPayer] = useState<Payer>("cabinet");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await callCabinet<{ status: string; checkoutUrl?: string; emailSent?: boolean }>("invite", {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        payer,
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(res.emailSent === false ? "Invitation créée, mais l'e-mail n'a pas pu partir : utilisez « Renvoyer »." : `Invitation envoyée à ${email.trim()}`);
      setFirstName("");
      setLastName("");
      setEmail("");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSending(false);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">Inviter un collaborateur</h2>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv_first">Prénom</Label>
            <Input id="inv_first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_last">Nom</Label>
            <Input id="inv_last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv_email">E-mail</Label>
            <Input id="inv_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cotisation annuelle</Label>
          <PayerChoice value={payer} onChange={setPayer} name="inv_payer" />
        </div>
        <p className="text-xs text-muted-foreground">
          {payer === "cabinet"
            ? "Vous passez au paiement du siège ; l'invitation part automatiquement dès le paiement confirmé."
            : "L'invitation part tout de suite par e-mail. Le lien est valable 14 jours."}{" "}
          Le collaborateur n'aura aucun compte bancaire à fournir : ses rendez-vous sont encaissés sur le compte du cabinet.
        </p>
        <Button type="submit" disabled={sending} className="gap-2">
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {payer === "cabinet" ? "Payer le siège et inviter" : "Envoyer l'invitation"}
        </Button>
      </form>
    </section>
  );
}

function MemberRow({ member, clients, onChanged }: { member: Member; clients: number; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmPayer, setConfirmPayer] = useState<Payer | null>(null);

  const changePayer = async (payer: Payer) => {
    setBusy(true);
    try {
      const res = await callCabinet<{ checkoutUrl?: string; effective?: string }>("set_payer", { memberId: member.id, payer });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(
        res.effective === "renewal"
          ? "C'est noté : la cotisation passera à sa charge à la prochaine échéance."
          : "Cotisation désormais à sa charge.",
      );
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await callCabinet("remove", { memberId: member.id });
      toast.success(`${fullName(member)} ne fait plus partie du cabinet. Ses clients sont désormais dans votre liste.`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const otherPayer: Payer = member.cabinet_payer === "cabinet" ? "self" : "cabinet";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{fullName(member, member.email ?? "")}</span>
          {member.plan === "expired" && <Badge variant="destructive">Accès suspendu</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {member.email} · {clients} client{clients > 1 ? "s" : ""}
          {member.cabinet_joined_at ? ` · depuis le ${fmtDate(member.cabinet_joined_at)}` : ""}
        </div>
        <div className="mt-1 text-xs">
          Cotisation : <strong>{member.cabinet_payer === "cabinet" ? "payée par le cabinet" : "à sa charge"}</strong>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/clients" search={{ conseiller: member.id }}>Voir ses clients</Link>
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmPayer(otherPayer)}>
          {otherPayer === "cabinet" ? "Le cabinet paie" : "Il paie lui-même"}
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirmRemove(true)}>
          Retirer
        </Button>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {fullName(member)} du cabinet ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ses {clients} client{clients > 1 ? "s" : ""}, leurs dossiers, documents et rendez-vous restent au cabinet et
              passent dans votre liste.
              {member.cabinet_payer === "cabinet"
                ? " Son siège n'est plus payé et son accès au logiciel est suspendu jusqu'à ce qu'il règle lui-même sa cotisation."
                : " Il garde son compte et sa propre cotisation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Retirer du cabinet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmPayer} onOpenChange={(v) => !v && setConfirmPayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmPayer === "cabinet" ? "Prendre en charge sa cotisation ?" : "Lui laisser payer sa cotisation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPayer === "cabinet"
                ? "Vous passez au paiement d'un siège annuel pour ce collaborateur. Son abonnement personnel ne sera plus renouvelé."
                : "Son siège reste payé jusqu'à l'échéance, puis n'est pas renouvelé : il réglera ensuite lui-même sa cotisation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = confirmPayer;
                setConfirmPayer(null);
                if (p) void changePayer(p);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteRowView({ invite, onChanged }: { invite: InviteRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const expired = new Date(invite.expires_at).getTime() <= Date.now();

  const run = async (action: "resend" | "revoke" | "pay_seat") => {
    setBusy(true);
    try {
      const res = await callCabinet<{ checkoutUrl?: string; emailSent?: boolean }>(action, { inviteId: invite.id });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (action === "resend") toast.success(res.emailSent === false ? "L'e-mail n'a pas pu partir, réessayez." : "Invitation renvoyée (nouveau lien valable 14 jours).");
      if (action === "revoke") toast.success("Invitation annulée.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{fullName(invite, invite.email)}</span>
          {invite.status === "awaiting_payment" ? (
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">Siège à payer</Badge>
          ) : expired ? (
            <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">Lien expiré</Badge>
          ) : (
            <Badge variant="outline">En attente</Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {invite.email} · cotisation {invite.payer === "cabinet" ? "payée par le cabinet" : "à sa charge"}
          {invite.status === "pending" && !expired ? ` · lien valable jusqu'au ${fmtDate(invite.expires_at)}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {invite.status === "awaiting_payment" ? (
          <Button size="sm" disabled={busy} onClick={() => run("pay_seat")}>Payer le siège</Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run("resend")}>Renvoyer</Button>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => run("revoke")}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function PaymentsSection({
  invoices,
  loading,
  memberById,
  patronId,
}: {
  invoices: InvoiceRow[];
  loading: boolean;
  memberById: Record<string, Member>;
  patronId: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const advisorName = (id: string) => (id === patronId ? "Vous" : memberById[id] ? fullName(memberById[id]) : "Ancien collaborateur");
  const paid = invoices.filter((i) => i.status === "paid");
  const net = (i: InvoiceRow) => i.amount_chf - (i.commission_centimes ?? computeCommissionCentimes(i.amount_chf));

  const byAdvisor = useMemo(() => {
    const map = new Map<string, { gross: number; net: number; count: number }>();
    for (const i of paid) {
      const cur = map.get(i.broker_id) ?? { gross: 0, net: 0, count: 0 };
      cur.gross += i.amount_chf;
      cur.net += net(i);
      cur.count += 1;
      map.set(i.broker_id, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].net - a[1].net);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { net: number; count: number }>();
    for (const i of paid) {
      const k = monthKey(i.created_at);
      const cur = map.get(k) ?? { net: 0, count: 0 };
      cur.net += net(i);
      cur.count += 1;
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  const totalNet = paid.reduce((s, i) => s + net(i), 0);
  const list = filter === "all" ? invoices : invoices.filter((i) => i.broker_id === filter);
  const advisors = [...new Set(invoices.map((i) => i.broker_id))];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Paiements encaissés par le cabinet</h2>
          <p className="text-xs text-muted-foreground">Montants nets, après commission SwissBroker Pro, versés sur le compte du cabinet.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total encaissé</div>
          <div className="text-2xl font-bold tabular-nums text-primary">{formatCHF(totalNet / 100, 2)}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !invoices.length ? (
        <p className="text-sm text-muted-foreground">Aucune facture de rendez-vous pour l'instant.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Par conseiller</h3>
              <div className="divide-y divide-border rounded-lg border border-border">
                {byAdvisor.map(([id, v]) => (
                  <div key={id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{advisorName(id)}</span>
                    <span className="tabular-nums">
                      {formatCHF(v.net / 100, 2)} <span className="text-xs text-muted-foreground">({v.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Par mois</h3>
              <div className="divide-y divide-border rounded-lg border border-border">
                {byMonth.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="capitalize">{monthLabel(k)}</span>
                    <span className="tabular-nums">
                      {formatCHF(v.net / 100, 2)} <span className="text-xs text-muted-foreground">({v.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Toutes les factures</h3>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label="Filtrer par conseiller"
            >
              <option value="all">Tous les conseillers</option>
              {advisors.map((id) => (
                <option key={id} value={id}>{advisorName(id)}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Conseiller</th>
                  <th className="py-2 pr-3 text-right font-medium">Montant</th>
                  <th className="py-2 pr-3 text-right font-medium">Net cabinet</th>
                  <th className="py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 tabular-nums">{fmtDate(i.created_at)}</td>
                    <td className="py-2 pr-3">
                      {i.client_id ? (
                        <Link to="/clients/$clientId" params={{ clientId: i.client_id }} className="hover:underline">
                          {fullName({ first_name: i.snapshot_first_name, last_name: i.snapshot_last_name }, "Client")}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">{advisorName(i.broker_id)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCHF(i.amount_chf / 100, 2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{i.status === "paid" ? formatCHF(net(i) / 100, 2) : "—"}</td>
                    <td className="py-2">
                      {i.status === "paid" ? (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">Payée</Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
