// Panneau de transparence : explique d'où viennent les chiffres "Actuel" et
// "Projeté" de la carte Prestations consolidées — même esprit que
// TaxGlobalExplanation (Fiscal Global), remplace le <details> "Détail des
// prestations" trop facile à manquer par un bloc visible et explicite.
//
// Lecture seule : ne modifie aucun input, ne recalcule rien — se contente de
// rendre visibles les choix déjà faits par pension-consolidation.ts (priorité
// des sources pour "actuel", hypothèses appliquées pour "optimisé").

import { FileSearch, ListChecks, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { CalcCard } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import type { ClientBundle } from "@/lib/client-dashboard";
import {
  getOptimizationAssumptions,
  type ConsolidationReferenceSimulations,
} from "@/lib/pension-consolidation";
import type { HistoryEntry } from "@/lib/history/types";

interface Props {
  bundle: ClientBundle;
  refs: ConsolidationReferenceSimulations | undefined;
}

function sourceFor(ref: HistoryEntry | null | undefined): string {
  if (!ref) return "⚠️ estimation (aucune simulation enregistrée dans ce dossier)";
  const date = new Date(ref.created_at).toLocaleDateString("fr-CH");
  return `✅ simulation « ${ref.title} » du ${date}`;
}

export function ConsolidatedBenefitsExplanation({ bundle, refs }: Props) {
  const assumptions = getOptimizationAssumptions(bundle);

  return (
    <CalcCard className="mb-4">
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-bold">
                D'où viennent les chiffres "Actuel" et "Optimisé"
              </h3>
              <p className="text-xs text-muted-foreground">
                Sources utilisées pour la colonne actuelle, hypothèses appliquées pour la colonne
                optimisée
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            Transparence
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-5">
          <Section
            icon={<Info className="h-4 w-4" />}
            title="1. Situation actuelle : origine par pilier"
          >
            <p className="mb-2 text-xs text-muted-foreground">
              Priorité des sources, du plus fiable au moins fiable : certificat de prévoyance saisi
              dans la fiche, sinon dernière simulation sauvegardée dans ce dossier, sinon une
              estimation à partir des données brutes du client (toujours signalée comme telle).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left font-medium">Pilier</th>
                    <th className="py-2 text-right font-medium">Source utilisée</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-1.5 text-foreground">1er pilier (AVS / AI)</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {sourceFor(refs?.avsAi)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-foreground">2e pilier (LPP)</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {sourceFor(refs?.lpp)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-foreground">3e pilier A</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {sourceFor(refs?.pillar3a)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            icon={<ListChecks className="h-4 w-4" />}
            title="2. Situation optimisée : hypothèses appliquées"
          >
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <Row
                label="Rachat LPP"
                value={
                  assumptions.lppBuybackAmount > 0
                    ? `Capacité de rachat restante entièrement utilisée : ${formatCHF(assumptions.lppBuybackAmount)}`
                    : "Aucune capacité de rachat restante disponible"
                }
              />
              <Row
                label="3e pilier A"
                value={
                  assumptions.pillar3aIncreased
                    ? `Cotisation portée au plafond légal : ${formatCHF(assumptions.pillar3aCurrent)} → ${formatCHF(assumptions.pillar3aOptimized)}/an`
                    : `Déjà au plafond légal (${formatCHF(assumptions.pillar3aCurrent)}/an), aucun ajustement`
                }
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Le capital optimisé n'est pas recalculé indépendamment : un facteur de croissance
              (optimisé / actuel, calculé par le même moteur de projection que les calculateurs LPP
              et 3e pilier) est appliqué au capital réellement enregistré ci-dessus, pour ne jamais
              afficher un chiffre différent de celui des calculateurs dédiés.
            </p>
          </Section>
        </CollapsibleContent>
      </Collapsible>
    </CalcCard>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-foreground/80">{label}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}
