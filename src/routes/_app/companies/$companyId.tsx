import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  
  Users,
  TrendingUp,
  PiggyBank,
  Wallet,
  UserPlus,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_FORM_LABELS, type Company } from "@/lib/companies/types";
import type { Client } from "@/lib/clients/types";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { formatCHF } from "@/lib/format";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { ArchiveConfirmDialog } from "@/components/common/ArchiveConfirmDialog";
import { AttachDirectorDialog } from "@/components/companies/AttachDirectorDialog";
import { AiAnalysisCompany } from "@/components/ai/AiAnalysis";

export const Route = createFileRoute("/_app/companies/$companyId")({
  head: () => ({ meta: [{ title: "Société · SwissBroker Pro" }] }),
  component: CompanyDetailPage,
});

function CompanyDetailPage() {
  const { companyId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState("overview");
  const [attachOpen, setAttachOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as Company;
    },
  });

  const { data: directors = [] } = useQuery({
    queryKey: ["company-directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("company_id", companyId)
        .eq("archived", false)
        .order("last_name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const archiveMut = useMutation({
    mutationFn: async (archived: boolean) => {
      const { error } = await supabase
        .from("companies")
        .update({ archived })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: (_d, archived) => {
      toast.success(archived ? "Société archivée" : "Société restaurée");
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setArchiveOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Société supprimée");
      qc.invalidateQueries({ queryKey: ["companies"] });
      navigate({ to: "/companies" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ clientId, role }: { clientId: string; role: string }) => {
      const { error } = await supabase
        .from("clients")
        .update({ company_role: role.trim() || null })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-directors", companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const detachDirector = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ company_id: null, company_role: null })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dirigeant détaché");
      qc.invalidateQueries({ queryKey: ["company-directors", companyId] });
      qc.invalidateQueries({ queryKey: ["companies-directors-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ notes: notes.trim() || null })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes enregistrées");
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      setNotesDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (!company) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Société introuvable</h1>
        <Link to="/companies" className="mt-4 inline-block text-sm text-primary hover:underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const cantonInfo = company.canton ? CANTON_BY_CODE[company.canton] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/companies" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Sociétés
        </Link>
      </div>

      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{company.legal_name}</h1>
            {company.archived && <Badge variant="secondary">Archivée</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {LEGAL_FORM_LABELS[company.legal_form]}
            </Badge>
            {cantonInfo && (
              <span>
                {cantonInfo.code} · {cantonInfo.name}
              </span>
            )}
            {company.founding_year && <span>Fondée en {company.founding_year}</span>}
            {company.ide_number && <span className="font-mono text-xs">{company.ide_number}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/companies/$companyId/edit" params={{ companyId }}>
              <Pencil className="h-4 w-4" /> Modifier
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
            {company.archived ? (
              <>
                <ArchiveRestore className="h-4 w-4" /> Restaurer
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" /> Archiver
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (directors.length > 0) setBlockedOpen(true);
              else setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Chiffre d'affaires"
          value={formatCHF(Number(company.annual_revenue ?? 0))}
          icon={TrendingUp}
        />
        <Kpi
          label="Bénéfice annuel"
          value={formatCHF(Number(company.annual_profit ?? 0))}
          icon={Wallet}
        />
        <Kpi
          label="Bénéfices en réserve"
          value={formatCHF(Number(company.retained_earnings ?? 0))}
          icon={PiggyBank}
        />
        <Kpi label="Dirigeants rattachés" value={String(directors.length)} icon={Users} />
      </div>

<div className="mt-6 space-y-4">
        <AiAnalysisCompany company={company} directors={directors} />
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Comparateur rémunération dirigeant</div>
                <div className="text-xs text-muted-foreground">Salaire vs dividendes · économie fiscale chiffrée</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {directors.length === 0 ? (
                <Button size="sm" onClick={() => setAttachOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Rattacher un dirigeant
                </Button>
              ) : (
                directors.map((d) => (
                  <Button asChild size="sm" key={d.id}>
                    <Link to="/calculators/director-compensation" search={{ clientId: d.id, companyId }}>
                      <TrendingUp className="h-3.5 w-3.5" />
                      {d.last_name.toUpperCase()} {d.first_name}
                    </Link>
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="overview">Synthèse</TabsTrigger>
          <TabsTrigger value="financials">Données financières</TabsTrigger>
          <TabsTrigger value="directors">
            Dirigeants
            {directors.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                {directors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calc">Calculs</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Synthèse */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Identité">
              <Row label="Raison sociale" value={company.legal_name} />
              <Row label="Forme juridique" value={LEGAL_FORM_LABELS[company.legal_form]} />
              <Row label="IDE" value={company.ide_number ?? "—"} />
              <Row label="N° TVA" value={company.vat_number ?? "—"} />
              <Row
                label="Canton siège"
                value={cantonInfo ? `${cantonInfo.code} · ${cantonInfo.name}` : "—"}
              />
              <Row label="Année de fondation" value={company.founding_year ?? "—"} />
            </Card>
            <Card title="Dirigeants rattachés">
              {directors.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Aucun dirigeant rattaché.</p>
                  <Button size="sm" className="mt-3" onClick={() => setAttachOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Rattacher un dirigeant
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ul className="divide-y divide-border">
                    {directors.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                        <div>
                          <div className="text-sm font-medium">
                            {d.last_name.toUpperCase()} {d.first_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.company_role ?? "Rôle non renseigné"}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/clients/$clientId" params={{ clientId: d.id }}>
                            Voir fiche
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Rattacher un autre dirigeant
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Financials */}
        <TabsContent value="financials" className="mt-4">
          <Card title="Données financières">
            <Row
              label="Chiffre d'affaires annuel"
              value={formatCHF(Number(company.annual_revenue ?? 0))}
            />
            <Row
              label="Bénéfice annuel"
              value={formatCHF(Number(company.annual_profit ?? 0))}
            />
            <Row
              label="Bénéfices en réserve"
              value={formatCHF(Number(company.retained_earnings ?? 0))}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Pour ajuster ces valeurs, utilisez le bouton « Modifier » en haut.
            </p>
          </Card>
        </TabsContent>

        {/* Directors */}
        <TabsContent value="directors" className="mt-4">
          <Card title="Dirigeants et rémunérations">
            {directors.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucun dirigeant rattaché.</p>
                <Button size="sm" className="mt-3" onClick={() => setAttachOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Rattacher un dirigeant
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Rattacher
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead className="text-right">Salaire annuel</TableHead>
                      <TableHead className="text-right">Bonus</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directors.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">
                            {d.last_name.toUpperCase()} {d.first_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{d.email ?? "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Input
                            list={`role-list-${d.id}`}
                            defaultValue={d.company_role ?? ""}
                            placeholder="Gérant, Administrateur…"
                            className="h-8 text-sm"
                            onBlur={(e) => {
                              if ((e.target.value.trim() || null) !== (d.company_role ?? null)) {
                                updateRole.mutate({ clientId: d.id, role: e.target.value });
                              }
                            }}
                          />
                          <datalist id={`role-list-${d.id}`}>
                            <option value="Gérant" />
                            <option value="Administrateur" />
                            <option value="Président" />
                            <option value="Associé" />
                            <option value="Directeur" />
                          </datalist>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCHF(d.gross_annual_salary)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCHF(d.bonus)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/clients/$clientId" params={{ clientId: d.id }}>
                              Voir
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => detachDirector.mutate(d.id)}
                          >
                            Détacher
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Card>
        </TabsContent>

        {/* Calc */}
        <TabsContent value="calc" className="mt-4">
          <Card title="Comparateur rémunération dirigeant (salaire / dividendes)">
            <p className="text-sm text-muted-foreground">
              Compare la situation actuelle du dirigeant à 4 stratégies préset (100/0, 70/30,
              50/50, 30/70) en croisant les données de la société (bénéfice, réserve cible) avec
              celles du dirigeant. Économie fiscale chiffrée sur 1 an et 10 ans.
            </p>

            {directors.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Rattachez d'abord un dirigeant pour lancer le comparateur avec préfill automatique.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setAttachOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Rattacher un dirigeant
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <ul className="divide-y divide-border rounded-md border border-border">
                  {directors.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {d.last_name.toUpperCase()} {d.first_name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d.company_role ?? "Rôle non renseigné"} ·{" "}
                          {formatCHF(d.gross_annual_salary)} / an
                        </div>
                      </div>
                      <Button asChild size="sm">
                        <Link
                          to="/calculators/director-compensation"
                          search={{ clientId: d.id, companyId }}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Lancer le comparateur
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/calculators/director-compensation"
                    search={{ companyId }}
                  >
                    Ouvrir sans dirigeant pré-sélectionné
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <Card title="Notes libres">
            <Textarea
              rows={8}
              placeholder="Notes internes sur la société, l'historique, les prochaines étapes…"
              value={notesDraft ?? company.notes ?? ""}
              onChange={(e) => setNotesDraft(e.target.value)}
            />
            <div className="mt-2 flex justify-end gap-2">
              {notesDraft !== null && (
                <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>
                  Annuler
                </Button>
              )}
              <Button
                size="sm"
                disabled={notesDraft === null}
                onClick={() => notesDraft !== null && saveNotes.mutate(notesDraft)}
              >
                Enregistrer
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AttachDirectorDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        companyId={companyId}
        companyName={company.legal_name}
      />

      <ArchiveConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={company.archived ? "Restaurer cette société ?" : "Archiver cette société ?"}
        description={
          company.archived
            ? "La société redeviendra visible dans la liste principale."
            : "La société n'apparaîtra plus dans la liste principale, mais reste accessible depuis le filtre « Archivées »."
        }
        confirmLabel={company.archived ? "Restaurer" : "Archiver"}
        onConfirm={() => archiveMut.mutate(!company.archived)}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        expectedText={company.legal_name}
        title="Supprimer définitivement cette société ?"
        description={
          <span>
            Cette action est irréversible. Toutes les données financières et notes seront perdues.
          </span>
        }
        onConfirm={() => deleteMut.mutate()}
      />

      {/* Blocked deletion modal */}
      <AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Suppression impossible
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Cette société est rattachée à <strong>{directors.length}</strong> dirigeant
                  {directors.length > 1 ? "s" : ""} :
                </p>
                <ul className="list-inside list-disc text-sm">
                  {directors.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      {d.first_name} {d.last_name}
                    </li>
                  ))}
                  {directors.length > 5 && <li>…et {directors.length - 5} autres</li>}
                </ul>
                <p>
                  Détachez d'abord ces dirigeants ou supprimez-les avant de pouvoir supprimer la
                  société.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBlockedOpen(false)}>
              OK, j'ai compris
            </Button>
            <AlertDialogAction
              onClick={() => {
                setBlockedOpen(false);
                setTab("directors");
              }}
            >
              Voir les dirigeants
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
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm tabular-nums">{value}</span>
    </div>
  );
}
