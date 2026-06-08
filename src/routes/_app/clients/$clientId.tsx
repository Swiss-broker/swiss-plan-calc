import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useT } from "@/contexts/LanguageContext";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  Plus,
  GitCompare,
  StickyNote,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Users as UsersIcon,
  Wallet,
  Landmark,
  FolderOpen,
} from "lucide-react";
import { DocumentsTab } from "@/components/clients/DocumentsTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import {
  CIVIL_STATUS_LABELS,
  GENDER_LABELS,
  CONFESSION_LABELS,
  PERMIT_LABELS,
  TAX_STATUS_LABELS,
  WORK_STATUS_LABELS,
  LPP_PLAN_LABELS,
  SOURCE_TAX_SCALE_LABELS,
  type SourceTaxScale,
} from "@/lib/swiss/enums";
import { ageFromDob, parseChildren, type Client, type ClientPension, type ClientAssets, type ClientNote } from "@/lib/clients/types";
import { formatCHF, formatPct } from "@/lib/format";
import { OptimizationsPanel } from "@/components/optimizer/OptimizationsPanel";
import { ClientCalculatorBar } from "@/components/clients/ClientCalculatorBar";
import { useClientDashboard } from "@/hooks/use-client-dashboard";
import {
  DashboardOverview,
  DashboardFiscal,
  DashboardPension,
  DashboardWealthSummary,
} from "@/components/clients/ClientDashboardSections";
import { ConsolidatedBenefitsCard } from "@/components/clients/ConsolidatedBenefitsCard";
import { ClientCompanyCard } from "@/components/clients/ClientCompanyCard";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { ArchiveConfirmDialog } from "@/components/common/ArchiveConfirmDialog";
import { LEGAL_FORM_LABELS, type Company } from "@/lib/companies/types";
import { AlertTriangle, Building2, ClipboardList, MessageSquare } from "lucide-react";
import { AiAnalysis } from "@/components/ai/AiAnalysis";
import { AiConversationsTab } from "@/components/ai/AiConversationsTab";
import { SessionSummaryTab } from "@/components/clients/SessionSummaryTab";
export const Route = createFileRoute("/_app/clients/$clientId")({
  head: () => ({ meta: [{ title: "Fiche client · SwissBroker Pro" }] }),
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const t = useT();
  const { setActiveClient, setActiveBundle } = useActiveClient();
  const { clientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const [clientRes, pensionRes, assetsRes, notesRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
        supabase
          .from("client_notes")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
      ]);
      if (clientRes.error) throw clientRes.error;
      return {
        client: clientRes.data as Client,
        pension: pensionRes.data as ClientPension | null,
        assets: assetsRes.data as ClientAssets | null,
        notes: (notesRes.data ?? []) as ClientNote[],
      };
    },
  });

  const archive = useMutation({
    mutationFn: async (archived: boolean) => {
      const { error } = await supabase.from("clients").update({ archived }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: (_d, archived) => {
      toast.success(archived ? t("clients.toast.archived") : t("clients.toast.restored"));
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-bundle", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const confirmMigratedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({ tax_status_migrated: false })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("clients.toast.status_verified"));
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-bundle", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await supabase.from("client_notes").delete().eq("client_id", clientId);
      await supabase.from("client_assets").delete().eq("client_id", clientId);
      await supabase.from("client_pension").delete().eq("client_id", clientId);
      await supabase.from("simulations").delete().eq("client_id", clientId);
      await supabase.from("scenarios").delete().eq("client_id", clientId);
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("clients.toast.deleted"));
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    },
  });

  const [noteBody, setNoteBody] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [oldClientOpen, setOldClientOpen] = useState(false);
  const addNote = useMutation({
    mutationFn: async () => {
      if (!user || !noteBody.trim()) return;
      const { error } = await supabase.from("client_notes").insert({
        client_id: clientId,
        broker_id: user.id,
        body: noteBody.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-bundle", clientId] });
      toast.success(t("clients.toast.note_added"));
    },
  });
  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId] }),
  });

  // IMPORTANT : tous les hooks doivent être appelés avant tout return conditionnel.
  useEffect(() => {
    if (data?.client) {
      setActiveClient(data.client);
      setActiveBundle({
        client: data.client,
        pension: data.pension ?? null,
        assets: data.assets ?? null,
      });
    }
    return () => {
      setActiveClient(null);
      setActiveBundle(null);
    };
  }, [data?.client, data?.pension, data?.assets, setActiveClient, setActiveBundle]);
  const bundle = data
    ? { client: data.client, pension: data.pension, assets: data.assets }
    : null;
  const dashboard = useClientDashboard(bundle);

  const companyId = data?.client.company_id ?? null;
  const { data: linkedCompany } = useQuery({
    queryKey: ["client-linked-company", clientId, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return c as Company | null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Client introuvable</h1>
        <Link to="/clients" className="mt-4 inline-block text-sm text-primary hover:underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const { client, pension, assets, notes } = data;
  const age = ageFromDob(client.date_of_birth);
  const cantonInfo = client.canton ? CANTON_BY_CODE[client.canton] : null;
  const totalIncome =
    (client.gross_annual_salary ?? 0) +
    (client.bonus ?? 0) +
    (client.other_income ?? 0) +
    (client.spouse_gross_annual_salary ?? 0);
  const fortune =
    (Number(assets?.bank_accounts ?? 0)) +
    (Number(assets?.securities ?? 0)) +
    (Number(assets?.real_estate_value ?? 0)) -
    (Number(assets?.mortgage_debt ?? 0));
  const children = parseChildren(client.children);
  const optimizations = dashboard?.suggestions ?? [];
  const clientAgeDays = Math.floor(
    (Date.now() - new Date(client.created_at).getTime()) / 86400000,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/clients" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {client.last_name.toUpperCase()} {client.first_name}
            </h1>
            {client.archived && <Badge variant="secondary">Archivé</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {age !== null && <span>{age} ans</span>}
            <span>{CIVIL_STATUS_LABELS[client.civil_status]}</span>
            {client.gender && <span>{GENDER_LABELS[client.gender]}</span>}
            <Badge variant="outline" className="font-normal">
              {TAX_STATUS_LABELS[client.tax_status]}
            </Badge>
            {cantonInfo && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {cantonInfo.code} · {cantonInfo.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="shine">
            <Link to="/clients/$clientId/scenarios" params={{ clientId }}>
              <GitCompare className="h-4 w-4" /> Comparer scénarios
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/clients/$clientId/edit" params={{ clientId }}>
              <Pencil className="h-4 w-4" /> Modifier
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-4 w-4" />
            {client.archived ? "Restaurer" : "Archiver"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (clientAgeDays > 30) setOldClientOpen(true);
              else setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {client.tax_status_migrated && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Statut fiscal migré automatiquement vers « Frontalier français – accord 1983 ».</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-100/80">
              Si ce client est frontalier Genève (régime spécifique), veuillez ajuster manuellement via Modifier.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 bg-white/60 hover:bg-white dark:bg-transparent"
            disabled={confirmMigratedMutation.isPending}
            onClick={() => confirmMigratedMutation.mutate()}
          >
            Marquer comme vérifié
          </Button>
        </div>
      )}
      {client.spouse_salary_is_fictif &&
        (client.tax_status === "cross_border_ge" || client.tax_status === "cross_border_fr_1983" || client.tax_status === "source_taxed") &&
        client.civil_status === "married" && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-700/60 dark:bg-orange-950/40 dark:text-orange-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Salaire conjoint provisoire (revenu fictif AFC)</p>
            <p className="mt-1 text-orange-800/90 dark:text-orange-100/80">
              L'impôt à la source est calculé sur un revenu fictif du conjoint de CHF {Math.min(Number(client.gross_annual_salary ?? 0), 70_500).toLocaleString("fr-CH")}.
              Déposer la DRIS auprès de l'AFC avant le <strong>31 mars {new Date().getFullYear() + 1}</strong> pour rectifier sur la base du salaire réel.
            </p>
          </div>
        </div>
      )}

      {/* KPI summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenu brut total" value={formatCHF(totalIncome)} icon={Briefcase} />
        <Kpi
          label="Avoir LPP"
          value={formatCHF(Number(pension?.lpp_current_balance ?? 0))}
          icon={Landmark}
        />
        <Kpi
          label="Versement 3a / an"
          value={formatCHF(Number(pension?.pillar_3a_annual_contribution ?? 0))}
          icon={Wallet}
        />
        <Kpi label="Fortune nette" value={formatCHF(fortune)} icon={Wallet} />
      </div>

      <div className="mt-6">
        <AiAnalysis client={client} pension={pension} assets={assets} />
      </div>
      <div className="mt-4">
        <ClientCalculatorBar client={client} />
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="overview">Synthèse</TabsTrigger>
          <TabsTrigger value="session" className="gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            Synthèse RDV
          </TabsTrigger>
          <TabsTrigger value="optimizations">
            Optimisations
            {optimizations.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                {optimizations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="fiscal">Fiscalité</TabsTrigger>
          <TabsTrigger value="pension">Prévoyance</TabsTrigger>
          <TabsTrigger value="patrimoine">Patrimoine</TabsTrigger>
          <TabsTrigger value="family">Famille</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Conversations IA
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
        </TabsList>


        <TabsContent value="session" className="mt-4">
          <SessionSummaryTab
            clientId={clientId}
            clientName={`${client.first_name} ${client.last_name}`.trim()}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiConversationsTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="optimizations" className="mt-4">
          <OptimizationsPanel
            optimizations={optimizations}
            title={`Optimisations pour ${client.first_name}`}
            emptyHint="Complétez la fiche (canton, salaire, LPP, 3a, fortune) pour générer des recommandations chiffrées."
            canton={client.canton}
            civilStatus={client.civil_status}
            taxStatus={client.tax_status as never}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {dashboard?.hasEnoughData && (
            <DashboardOverview dashboard={dashboard} clientId={clientId} />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Identité">
              <Row label="Date de naissance" value={client.date_of_birth ?? "—"} />
              <Row label="Nationalité" value={client.nationality ?? "—"} />
              <Row label="Permis" value={PERMIT_LABELS[client.permit]} />
              <Row label="Email" value={client.email ?? "—"} icon={Mail} />
              <Row label="Téléphone" value={client.phone ?? "—"} icon={Phone} />
            </Card>
            <Card title="Domicile">
              <Row label="Pays" value={client.country_of_residence ?? "—"} />
              <Row
                label="Canton"
                value={cantonInfo ? `${cantonInfo.code} · ${cantonInfo.name}` : "—"}
              />
              <Row label="Commune" value={client.commune ?? "—"} />
              <Row label="NPA" value={client.postal_code ?? "—"} />
            </Card>
          </div>
          {client.work_status === "director" && (
            <ClientCompanyCard
              clientId={clientId}
              companyId={client.company_id}
              companyRole={client.company_role}
            />
          )}
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4 space-y-6">
          {dashboard?.hasEnoughData && (
            <DashboardFiscal dashboard={dashboard} clientId={clientId} />
          )}
          <Card title="Situation fiscale">
  <Row label="Statut fiscal" value={TAX_STATUS_LABELS[client.tax_status]} />
  {client.source_tax_scale && (
    <Row
      label="Barème impôt à la source"
      value={SOURCE_TAX_SCALE_LABELS[client.source_tax_scale as SourceTaxScale] ?? client.source_tax_scale}
    />
  )}
  <Row label="Confession" value={CONFESSION_LABELS[client.confession]} />
  <Row label="Paroisse" value={client.parish ?? "—"} />
</Card>
<Card title="Activité professionnelle">
  <Row
    label="Statut professionnel"
    value={WORK_STATUS_LABELS[client.work_status]}
  />
  <Row
    label="Taux d'activité"
    value={client.activity_rate !== null ? formatPct(Number(client.activity_rate), 0) : "—"}
  />
  <Row label="Employeur" value={client.employer ?? "—"} />
  <Row label="Salaire annuel brut" value={formatCHF(client.gross_annual_salary)} />
  <Row label="Bonus / 13e" value={formatCHF(client.bonus)} />
  <Row label="Autres revenus" value={formatCHF(client.other_income)} />
</Card>
        </TabsContent>

        <TabsContent value="pension" className="mt-4 space-y-6">
          {dashboard?.hasEnoughData && (
            <DashboardPension dashboard={dashboard} clientId={clientId} />
          )}
          {bundle && <ConsolidatedBenefitsCard bundle={bundle} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="2e pilier (LPP)">
              <Row label="Plan" value={pension ? LPP_PLAN_LABELS[pension.lpp_plan] : "—"} />
              <Row
                label="Avoir actuel"
                value={formatCHF(Number(pension?.lpp_current_balance ?? 0))}
              />
              <Row
                label="Salaire assuré"
                value={formatCHF(Number(pension?.lpp_insured_salary ?? 0))}
              />
              <Row
                label="Capacité de rachat"
                value={formatCHF(Number(pension?.lpp_max_buyback ?? 0))}
              />
            </Card>
            <Card title="3e pilier (3a)">
              <Row
                label="Versement annuel"
                value={formatCHF(Number(pension?.pillar_3a_annual_contribution ?? 0))}
              />
              <Row
                label="Solde conjoint LPP"
                value={formatCHF(Number(pension?.spouse_lpp_balance ?? 0))}
              />
              <Row
                label="Solde conjoint 3a"
                value={formatCHF(Number(pension?.spouse_pillar_3a_balance ?? 0))}
              />
            </Card>
          </div>
          {client.work_status === "director" && linkedCompany && (
            <Card title={`Rémunération via ${linkedCompany.legal_name}`}>
              <Row
                label="Forme juridique"
                value={LEGAL_FORM_LABELS[linkedCompany.legal_form]}
              />
              <Row label="Salaire annuel reçu" value={formatCHF(client.gross_annual_salary)} />
              <Row label="Bonus / 13e" value={formatCHF(client.bonus)} />
              <Row label="Autres revenus" value={formatCHF(client.other_income)} />
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: linkedCompany.id }}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Voir la fiche société
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patrimoine" className="mt-4 space-y-6">
          {dashboard?.hasEnoughData && <DashboardWealthSummary dashboard={dashboard} />}
          <Card title="Actifs et passifs">
            <Row label="Comptes bancaires" value={formatCHF(Number(assets?.bank_accounts ?? 0))} />
            <Row label="Titres / portefeuille" value={formatCHF(Number(assets?.securities ?? 0))} />
            <Row label="Bien immobilier (valeur)" value={formatCHF(Number(assets?.real_estate_value ?? 0))} />
            <Row label="Véhicules" value={formatCHF(Number(assets?.vehicles ?? 0))} />
            <Row label="Autres actifs" value={formatCHF(Number(assets?.other_assets ?? 0))} />
            <Separator className="my-2" />
            <Row label="Dette hypothécaire" value={formatCHF(Number(assets?.mortgage_debt ?? 0))} />
            <Row label="Intérêts hypothécaires" value={formatCHF(Number(assets?.mortgage_interest ?? 0))} />
            <Row label="Autres dettes" value={formatCHF(Number(assets?.other_debts ?? 0))} />
            <Separator className="my-2" />
            <Row label="Fortune nette" value={formatCHF(fortune)} bold />
          </Card>
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          <Card title="Conjoint">
            {client.civil_status === "married" || client.civil_status === "registered_partnership" ? (
              <>
                <Row
                  label="Nom"
                  value={
                    client.spouse_first_name || client.spouse_last_name
                      ? `${client.spouse_first_name ?? ""} ${client.spouse_last_name ?? ""}`.trim()
                      : "—"
                  }
                />
                <Row label="Date de naissance" value={client.spouse_date_of_birth ?? "—"} />
                <Row
                  label="Salaire annuel brut"
                  value={formatCHF(client.spouse_gross_annual_salary)}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Pas de conjoint enregistré.</p>
            )}
          </Card>
          <div className="mt-4">
            <Card title={`Enfants (${children.length})`}>
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun enfant à charge.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {children.map((c, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        <UsersIcon className="mr-2 inline h-4 w-4 text-muted-foreground" />
                        {c.first_name || "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {c.date_of_birth ? `Né(e) le ${c.date_of_birth}` : ""}
                        {c.in_household ? " · au foyer" : " · hors foyer"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card title="Notes internes">
            <div className="space-y-3">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Ajouter une note pour ce dossier…"
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => addNote.mutate()}
                  disabled={!noteBody.trim() || addNote.isPending}
                >
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
            </div>
            <Separator className="my-4" />
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <StickyNote className="mr-2 inline h-4 w-4" />
                Aucune note pour l'instant.
              </p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <button
                        type="button"
                        onClick={() => deleteNote.mutate(n.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Supprimer
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("fr-CH")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            clientId={clientId}
            clientFirstName={client.first_name}
          />
        </TabsContent>



      </Tabs>

      <ArchiveConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={client.archived ? "Restaurer ce client ?" : "Archiver ce client ?"}
        description={
          client.archived
            ? "Le client redeviendra visible dans la liste principale."
            : "Le client n'apparaîtra plus dans la liste principale, mais reste accessible depuis le filtre « Archivés »."
        }
        confirmLabel={client.archived ? "Restaurer" : "Archiver"}
        onConfirm={() => archive.mutate(!client.archived)}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expectedText={`${client.first_name} ${client.last_name}`}
        title="Supprimer définitivement ce client ?"
        description={
          <span>
            Toutes les données du dossier seront perdues : informations personnelles,
            calculs, scénarios, simulations.
          </span>
        }
        onConfirm={() => remove.mutate()}
      />

      <AlertDialog open={oldClientOpen} onOpenChange={setOldClientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Action sécurisée requise
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Ce client existe depuis plus de 30 jours et peut contenir des informations
                  importantes (calculs, scénarios, historique). Pour protéger l'intégrité du
                  dossier, la suppression directe n'est pas disponible.
                </p>
                <p>Vous pouvez à la place :</p>
                <ul className="list-inside list-disc text-sm">
                  <li>
                    <strong>Archiver</strong> le client : il n'apparaîtra plus dans la liste
                    mais reste accessible si besoin.
                  </li>
                  <li>
                    Le contacter et le faire passer par un effacement RGPD (à venir dans une
                    prochaine version).
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOldClientOpen(false);
                setArchiveOpen(true);
              }}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              Archiver le client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  bold,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground inline-flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
