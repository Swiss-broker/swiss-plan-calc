// Carte « Prestations consolidées », Actuel vs Projeté
// (vieillesse / invalidité / décès) à partir de la fiche client.

import { useMemo, useState } from "react";
import { HeartHandshake, ShieldAlert, Cross } from "lucide-react";
import { DashboardCard } from "./DashboardCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCHF } from "@/lib/format";
import {
  consolidatePensionBenefits,
  consolidateOptimizedBenefits,
  getConsolidatedCapitals,
  getOptimizedConsolidatedCapitals,
  PENSION_EVENT_LABELS,
  type ConsolidatedBenefits,
  type ConsolidatedCapitals,
  type ConsolidatedItem,
  type ConsolidatedScenario,
  type PensionEvent,
} from "@/lib/pension-consolidation";
import {
  SplitCompareLayout,
  type SplitRow,
} from "@/components/calculators/SplitCompareLayout";
import type { ClientBundle } from "@/lib/client-dashboard";
import { useConsolidationReferences } from "@/hooks/useConsolidationReferences";

interface Props {
  bundle: ClientBundle;
  caseId?: string;
}

const EVENT_ICONS: Record<PensionEvent, typeof HeartHandshake> = {
  retirement: HeartHandshake,
  disability: ShieldAlert,
  death: Cross,
};

export function ConsolidatedBenefitsCard({ bundle, caseId }: Props) {
  // "Actuel" reprend les résultats des dernières simulations AVS/AI, LPP et
  // 3a réellement sauvegardées pour ce client DANS CE DOSSIER (même
  // sélection que le PDF de synthèse) — jamais un recalcul indépendant qui
  // pourrait afficher un chiffre différent de celui du calculateur dédié,
  // et jamais une simulation d'un autre dossier du même client.
  const { data: refs } = useConsolidationReferences(bundle.client.id, caseId);
  const current = useMemo(() => consolidatePensionBenefits(bundle, refs), [bundle, refs]);
  const optimized = useMemo(() => consolidateOptimizedBenefits(bundle, refs), [bundle, refs]);
  const capitals = useMemo(() => getConsolidatedCapitals(bundle, refs), [bundle, refs]);
  const optimizedCapitals = useMemo(
    () => getOptimizedConsolidatedCapitals(bundle, refs),
    [bundle, refs],
  );
  const [tab, setTab] = useState<PensionEvent>("retirement");

  return (
    <DashboardCard
      title="Prestations consolidées · Actuel vs Projeté"
      icon={HeartHandshake}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CapitalTile
          label="Capital LPP projeté"
          value={capitals.lppProjectedCapital}
          isEstimate={capitals.lppProjectedIsEstimate}
          sub={`Avoir actuel : ${formatCHF(capitals.lppCurrentBalance)}`}
        />
        <CapitalTile
          label="Rachats LPP (simulation)"
          value={capitals.lppBuybacksTotal}
          isEstimate={false}
        />
        <CapitalTile
          label="Capital 3e pilier projeté"
          value={capitals.pillar3aProjectedCapital}
          isEstimate={capitals.pillar3aProjectedIsEstimate}
        />
      </div>

      <CapitalTaxCompare current={capitals} optimized={optimizedCapitals} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as PensionEvent)}>
        <TabsList className="grid w-full grid-cols-3">
          {(Object.keys(PENSION_EVENT_LABELS) as PensionEvent[]).map((ev) => {
            const Icon = EVENT_ICONS[ev];
            return (
              <TabsTrigger key={ev} value={ev} className="text-xs">
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {PENSION_EVENT_LABELS[ev]}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {(Object.keys(PENSION_EVENT_LABELS) as PensionEvent[]).map((ev) => (
          <TabsContent key={ev} value={ev} className="mt-3">
            <SplitPanel event={ev} current={current} optimized={optimized} />
          </TabsContent>
        ))}
      </Tabs>
    </DashboardCard>
  );
}

function sumByPillar(items: ConsolidatedItem[], pillar: "LPP" | "3A"): number {
  return items.filter((i) => i.pillar === pillar).reduce((s, i) => s + i.annual, 0);
}

function SplitPanel({
  event,
  current,
  optimized,
}: {
  event: PensionEvent;
  current: ConsolidatedBenefits;
  optimized: ConsolidatedBenefits;
}) {
  const cur = current[event];
  const opt = optimized[event];
  if (!cur || !opt) {
    return (
      <p className="text-xs text-muted-foreground">
        Données insuffisantes (date de naissance, salaire ou avoirs manquants).
      </p>
    );
  }
  const rows: SplitRow[] = [
    {
      label: "Total mensuel consolidé",
      current: cur.combinedMonthly,
      projected: opt.combinedMonthly,
      format: "chf_per_month",
    },
    {
      label: "Total annuel consolidé",
      current: cur.combinedAnnual,
      projected: opt.combinedAnnual,
    },
    {
      label: "1er pilier (AVS / AI)",
      current: cur.pillar1.totalAnnual,
      projected: opt.pillar1.totalAnnual,
    },
    {
      label: "2e pilier (LPP)",
      current: sumByPillar(cur.pillar2.items, "LPP"),
      projected: sumByPillar(opt.pillar2.items, "LPP"),
    },
    {
      label: "3e pilier A",
      current: sumByPillar(cur.pillar2.items, "3A"),
      projected: sumByPillar(opt.pillar2.items, "3A"),
    },
  ];

  const annualGain = opt.combinedAnnual - cur.combinedAnnual;
  const deltaPct =
    cur.combinedAnnual > 0 ? annualGain / cur.combinedAnnual : 0;

  return (
    <SplitCompareLayout
      currentSubtitle="Sans optimisation"
      projectedSubtitle="Rachats LPP + 3a au plafond"
      rows={rows}
      summary={{
        retirementGain: annualGain,
        retirementGainLabel:
          event === "retirement"
            ? "Rente annuelle supplémentaire"
            : event === "disability"
              ? "Couverture AI annuelle en plus"
              : "Couverture survivants en plus",
        deltaPercent: deltaPct,
        deltaLabel: "Amélioration prestations",
      }}
      currentExtra={<PillarDetails scenario={cur} tone="current" />}
      projectedExtra={<PillarDetails scenario={opt} tone="projected" />}
    />
  );
}

/** Comparaison brut / net d'impôt des capitaux 2e + 3e pilier, actuel vs
 *  optimisé — le vrai chiffre à montrer au client, pas juste le capital
 *  brut (voir capitalWithdrawalTax dans pension-consolidation). */
function CapitalTaxCompare({
  current,
  optimized,
}: {
  current: ConsolidatedCapitals;
  optimized: ConsolidatedCapitals;
}) {
  if (current.totalCapitalGross <= 0 && optimized.totalCapitalGross <= 0) return null;

  const rows: SplitRow[] = [
    {
      label: "Capital LPP (brut)",
      current: current.lppProjectedCapital,
      projected: optimized.lppProjectedCapital,
    },
    {
      label: "Capital LPP (net d'impôt)",
      current: current.lppProjectedCapitalNet,
      projected: optimized.lppProjectedCapitalNet,
    },
    {
      label: "Capital 3e pilier A (brut)",
      current: current.pillar3aProjectedCapital,
      projected: optimized.pillar3aProjectedCapital,
    },
    {
      label: "Capital 3e pilier A (net d'impôt)",
      current: current.pillar3aProjectedCapitalNet,
      projected: optimized.pillar3aProjectedCapitalNet,
    },
    {
      label: "Total consolidé (brut)",
      current: current.totalCapitalGross,
      projected: optimized.totalCapitalGross,
    },
    {
      label: "Total consolidé (net d'impôt)",
      current: current.totalCapitalNet,
      projected: optimized.totalCapitalNet,
    },
  ];

  const netGain = optimized.totalCapitalNet - current.totalCapitalNet;

  return (
    <div className="mb-4">
      <SplitCompareLayout
        title="Capitaux 2e + 3e pilier · brut vs net d'impôt"
        description="Impôt sur les prestations en capital (retrait LPP/3a), même moteur que le comparateur rente vs capital."
        currentSubtitle="Sans optimisation"
        projectedSubtitle="Rachats LPP + 3a au plafond"
        rows={rows}
        summary={{
          retirementGain: netGain,
          retirementGainLabel: "Capital net supplémentaire après impôt",
        }}
        legend={
          <>
            Le 3e pilier B n'est pas inclus : son régime fiscal n'est pas celui d'un capital de
            prévoyance (3a/LPP) et dépend du contrat : non modélisé ici.
          </>
        }
      />
    </div>
  );
}

function CapitalTile({
  label,
  value,
  isEstimate,
  sub,
}: {
  label: string;
  value: number;
  isEstimate: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{formatCHF(value)}</div>
      {sub && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sub}</div>}
      {isEstimate && value > 0 && (
        <div className="mt-0.5 text-[10.5px] italic text-warning">
          Estimation : aucune simulation enregistrée
        </div>
      )}
    </div>
  );
}

function PillarDetails({
  scenario,
  tone,
}: {
  scenario: ConsolidatedScenario;
  tone: "current" | "projected";
}) {
  const all = [...scenario.pillar1.items, ...scenario.pillar2.items];
  if (all.length === 0) return null;
  return (
    <details className="group rounded-md bg-background/60 p-2">
      <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
        Détail des prestations ({all.length})
      </summary>
      <ul className="mt-2 space-y-0.5">
        {all.map((it, i) => (
          <li
            key={`${tone}-${i}`}
            className="flex items-baseline justify-between gap-2 text-[11px]"
          >
            <span className="text-foreground/80">
              <span className="mr-1 inline-flex h-3.5 items-center justify-center rounded bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
                {it.pillar}
              </span>
              {it.label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatCHF(it.annual)} ({formatCHF(it.monthly)}/mois)
            </span>
          </li>
        ))}
      </ul>
      {scenario.notes.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
          {scenario.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
