// Modale "Préparer dossier de synthèse PDF" · V1 française uniquement.
import { useEffect, useMemo, useState } from "react";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { type Client, type ClientPension, type ClientAssets } from "@/lib/clients/types";
import type { Company } from "@/lib/companies/types";
import type { HistoryEntry } from "@/lib/history/types";
import { KIND_LABELS } from "@/lib/history/types";
import { extractGain } from "@/lib/simulations/extract-gain";
import { exportSynthesisReportPdf } from "@/lib/pdf/synthesis-report";
import { checkSynthesisConsistency } from "@/lib/pdf/consistency-check";
import { formatCHF } from "@/lib/format";
import { useClientCases } from "@/hooks/useClientCases";

/** Sentinel pour le dossier virtuel "Historique" (simulations sans case_id). */
const NO_CASE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  entries: HistoryEntry[];
}

export function SynthesisReportModal({ open, onOpenChange, clientId, entries }: Props) {
  const header = useBrokerPdfHeader();
  const { cases } = useClientCases(clientId);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeCharts, setIncludeCharts] = useState(true);
  const [customNote, setCustomNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [pension, setPension] = useState<ClientPension | null>(null);
  const [assets, setAssets] = useState<ClientAssets | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Charge les données client à l'ouverture. Ne pré-coche rien : un client
  // suivi depuis longtemps accumule des simulations de calculateurs très
  // différents (LPP, fiscal, comparateurs...), et générer un dossier avec
  // "tout" coché par défaut produit un PDF qui mélange des sujets sans
  // rapport entre eux au lieu de la synthèse ciblée attendue. Le courtier
  // choisit explicitement ce qui entre dans ce dossier-ci.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSelectedCaseIds(new Set());
    setLoadingClient(true);
    (async () => {
      try {
        const [c, p, a] = await Promise.all([
          supabase.from("clients").select("*").eq("id", clientId).single(),
          supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
          supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
        ]);
        if (c.error) throw c.error;
        setClient(c.data as Client);
        setPension((p.data as ClientPension) ?? null);
        setAssets((a.data as ClientAssets) ?? null);
        const cid = (c.data as Client).company_id;
        if (cid) {
          const co = await supabase.from("companies").select("*").eq("id", cid).maybeSingle();
          setCompany((co.data as Company) ?? null);
        } else {
          setCompany(null);
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingClient(false);
      }
    })();
  }, [open, clientId, entries]);

  // Historique (avant dossiers) : simulations sans case_id, groupées sous un
  // dossier virtuel plutôt que jamais perdues — voir ClientCasesTab.
  const historyEntries = useMemo(() => entries.filter((e) => !e.case_id), [entries]);
  const hasCaseFilter = cases.length > 0 || historyEntries.length > 0;

  // Présélection : pour les dossiers cochés, la simulation la plus récente
  // de chaque calculateur (plus celles marquées « Situation actuelle »).
  // Le conseiller n'a plus à cocher une à une, et les anciennes versions
  // d'un même calcul ne se retrouvent pas en double dans le PDF.
  const latestPerKindIds = (caseIds: Set<string>): Set<string> => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    const pool = entries
      .filter((e) => caseIds.has(e.case_id ?? NO_CASE))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const e of pool) {
      const key = `${e.case_id ?? NO_CASE}:${e.kind}`;
      if (e.is_baseline) ids.add(e.id);
      if (seen.has(key)) continue;
      seen.add(key);
      ids.add(e.id);
    }
    return ids;
  };

  const toggleCase = (id: string) => {
    const next = new Set(selectedCaseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCaseIds(next);
    setSelected(latestPerKindIds(next));
  };

  // Un seul dossier possible : il est coché d'office à l'ouverture.
  useEffect(() => {
    if (!open) return;
    const choices = [...cases.map((c) => c.id), ...(historyEntries.length > 0 ? [NO_CASE] : [])];
    if (choices.length !== 1) return;
    const only = new Set(choices);
    setSelectedCaseIds(only);
    setSelected(latestPerKindIds(only));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cases, historyEntries.length, entries]);

  // Simulations couvertes par les dossiers cochés ci-dessus. Sans filtre de
  // dossier applicable (client sans dossier ni historique), on retombe sur
  // le comportement d'avant cette fonctionnalité : toutes les simulations.
  const visibleEntries = useMemo(() => {
    if (!hasCaseFilter) return entries;
    return entries.filter((e) => selectedCaseIds.has(e.case_id ?? NO_CASE));
  }, [entries, selectedCaseIds, hasCaseFilter]);

  const allChecked = visibleEntries.length > 0 && selected.size === visibleEntries.length;
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(visibleEntries.map((e) => e.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected],
  );

  // Contrôle de cohérence avant génération (audit point 9) : signale les cas
  // où le PDF pourrait afficher un chiffre différent de celui attendu par le
  // courtier (sélection ambiguë, simulation sauvegardée avant une mise à
  // jour de l'outil). N'empêche pas de générer — c'est un point de
  // vérification, la décision finale reste au courtier.
  const consistencyWarnings = useMemo(
    () => checkSynthesisConsistency(selectedEntries),
    [selectedEntries],
  );
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  useEffect(() => {
    setWarningsAcknowledged(false);
  }, [consistencyWarnings]);

  const handleGenerate = async () => {
    if (!client) {
      toast.error("Données client non chargées");
      return;
    }
    setGenerating(true);
    try {
      // Laisse le temps au loader de s'afficher
      await new Promise((r) => setTimeout(r, 50));
      exportSynthesisReportPdf({
        header,
        client,
        pension,
        assets,
        company,
        entries: selectedEntries,
        options: { includeCharts, customNote: customNote.trim() || undefined },
      });
      toast.success("Dossier de synthèse généré");
      onOpenChange(false);
    } catch (e) {
      toast.error("Erreur lors de la génération du PDF");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : "…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dossier de synthèse pour {clientName}</DialogTitle>
          <DialogDescription>
            Sélectionnez les contenus à inclure dans le PDF de synthèse multi-pages.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-5 py-2">
            {/* Section 1 · toujours inclus */}
            <section className="rounded-lg border bg-muted/30 p-3">
              <h4 className="mb-2 text-sm font-semibold">Informations générales</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Page de garde (nom client, date, courtier, cabinet)</li>
                <li>✓ Profil client (identité, situation fiscale, prévoyance)</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Ces sections sont systématiquement incluses.
              </p>
            </section>

            {/* Section 1bis · dossiers */}
            {hasCaseFilter && (
              <section>
                <h4 className="mb-2 text-sm font-semibold">Dossiers à inclure</h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Choisissez un ou plusieurs dossiers : seules leurs simulations seront proposées
                  ci-dessous.
                </p>
                <ul className="space-y-2">
                  {cases.map((c) => {
                    const count = entries.filter((e) => e.case_id === c.id).length;
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3"
                      >
                        <Checkbox
                          checked={selectedCaseIds.has(c.id)}
                          onCheckedChange={() => toggleCase(c.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{c.title}</span>
                            <Badge
                              variant={c.status === "open" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {c.status === "open" ? "Ouvert" : "Terminé"}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {count} simulation{count > 1 ? "s" : ""}
                        </span>
                      </li>
                    );
                  })}
                  {historyEntries.length > 0 && (
                    <li className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-3">
                      <Checkbox
                        checked={selectedCaseIds.has(NO_CASE)}
                        onCheckedChange={() => toggleCase(NO_CASE)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground/80">
                            Historique (avant dossiers)
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            Automatique
                          </Badge>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {historyEntries.length} simulation{historyEntries.length > 1 ? "s" : ""}
                      </span>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* Section 2 · simulations */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Simulations à inclure</h4>
                {visibleEntries.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                    {allChecked ? "Tout décocher" : "Tout sélectionner"}
                  </Button>
                )}
              </div>
              {visibleEntries.length > 0 && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Chaque simulation reprend les chiffres de sa <strong>dernière sauvegarde</strong>{" "}
                  (date affichée ci-dessous), pas ce qui est actuellement affiché à l'écran dans le
                  calculateur. Si vous avez modifié une simulation depuis, ouvrez-la et cliquez sur
                  « Sauvegarder » avant de générer ce dossier.
                </p>
              )}
              {visibleEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                  {hasCaseFilter && selectedCaseIds.size === 0
                    ? "Sélectionnez au moins un dossier ci-dessus pour voir ses simulations."
                    : "Aucune simulation à inclure · lancez d'abord un calculateur depuis cette fiche."}
                </div>
              ) : (
                <ul className="space-y-2">
                  {visibleEntries.map((e) => {
                    const g = extractGain(e);
                    const checked = selected.has(e.id);
                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-3 rounded-lg border bg-card p-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(e.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{KIND_LABELS[e.kind]}</Badge>
                            <span className="text-sm font-medium">{e.title}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Sauvegardé le{" "}
                            {new Date(e.created_at).toLocaleString("fr-CH", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {g.type !== "none" && (
                            <div className="mt-1 text-xs text-primary">
                              Gain : {formatCHF(g.amount)}
                              {g.type === "annual" ? " / an" : " (ponctuel)"}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Section 3 · toujours inclus */}
            <section className="rounded-lg border bg-muted/30 p-3">
              <h4 className="mb-2 text-sm font-semibold">Pages de synthèse</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Tableau de synthèse "Avant / Après optimisation"</li>
                <li>✓ Conclusion et recommandations</li>
              </ul>
            </section>

            <Separator />

            {/* Section 4 · options */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Personnalisation</h4>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Note personnalisée (page de garde)
                </label>
                <Textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Ex : Compte-rendu du rendez-vous du 12/05/2026"
                  rows={2}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeCharts}
                  onCheckedChange={(v) => setIncludeCharts(v === true)}
                />
                Inclure les graphiques comparatifs (rente vs capital, dirigeant, etc.)
              </label>
            </section>
          </div>
        </ScrollArea>

        {consistencyWarnings.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle className="h-4 w-4" />
              Incohérence détectée avant génération du PDF
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
              {consistencyWarnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-xs font-medium">
              <Checkbox
                checked={warningsAcknowledged}
                onCheckedChange={(v) => setWarningsAcknowledged(v === true)}
              />
              J'ai vérifié ces points et je souhaite générer le PDF malgré tout
            </label>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={
              generating ||
              loadingClient ||
              selectedEntries.length === 0 ||
              !client ||
              (consistencyWarnings.length > 0 && !warningsAcknowledged)
            }
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Générer le PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
