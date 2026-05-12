// Modale "Préparer dossier de synthèse PDF" — V1 française uniquement.
import { useEffect, useMemo, useState } from "react";
import { Loader2, FileText } from "lucide-react";
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
import {
  type Client,
  type ClientPension,
  type ClientAssets,
} from "@/lib/clients/types";
import type { Company } from "@/lib/companies/types";
import type { HistoryEntry } from "@/lib/history/types";
import { KIND_LABELS } from "@/lib/history/types";
import { extractGain } from "@/lib/simulations/extract-gain";
import { exportSynthesisReportPdf } from "@/lib/pdf/synthesis-report";
import { formatCHF } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  entries: HistoryEntry[];
}

export function SynthesisReportModal({ open, onOpenChange, clientId, entries }: Props) {
  const header = useBrokerPdfHeader();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeCharts, setIncludeCharts] = useState(true);
  const [customNote, setCustomNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [pension, setPension] = useState<ClientPension | null>(null);
  const [assets, setAssets] = useState<ClientAssets | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Charge les données client à l'ouverture
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(entries.map((e) => e.id)));
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

  const allChecked = entries.length > 0 && selected.size === entries.length;
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(entries.map((e) => e.id)));
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
            {/* Section 1 — toujours inclus */}
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

            {/* Section 2 — simulations */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Simulations à inclure</h4>
                {entries.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                    {allChecked ? "Tout décocher" : "Tout sélectionner"}
                  </Button>
                )}
              </div>
              {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                  Aucune simulation à inclure — lancez d'abord un calculateur depuis cette fiche.
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map((e) => {
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

            {/* Section 3 — toujours inclus */}
            <section className="rounded-lg border bg-muted/30 p-3">
              <h4 className="mb-2 text-sm font-semibold">Pages de synthèse</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Tableau de synthèse "Avant / Après optimisation"</li>
                <li>✓ Conclusion et recommandations</li>
              </ul>
            </section>

            <Separator />

            {/* Section 4 — options */}
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

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || loadingClient || selectedEntries.length === 0 || !client}
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
