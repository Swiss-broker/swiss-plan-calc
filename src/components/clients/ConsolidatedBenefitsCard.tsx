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
  PENSION_EVENT_LABELS,
  type ConsolidatedBenefits,
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
}

const EVENT_ICONS: Record<PensionEvent, typeof HeartHandshake> = {
  retirement: HeartHandshake,
  disability: ShieldAlert,
  death: Cross,
};

export function ConsolidatedBenefitsCard({ bundle }: Props) {
  // "Actuel" reprend les résultats des dernières simulations AVS/AI, LPP et
  // 3a réellement sauvegardées pour ce client (même sélection que le PDF de
  // synthèse) — jamais un recalcul indépendant qui pourrait afficher un
  // chiffre différent de celui du calculateur dédié.
  const { data: refs } = useConsolidationReferences(bundle.client.id);
  const current = useMemo(() => consolidatePensionBenefits(bundle, refs), [bundle, refs]);
  const optimized = useMemo(() => consolidateOptimizedBenefits(bundle, refs), [bundle, refs]);
  const capitals = useMemo(() => getConsolidatedCapitals(bundle, refs), [bundle, refs]);
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
      label: "2e pilier + 3a",
      current: cur.pillar2.totalAnnual,
      projected: opt.pillar2.totalAnnual,
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
        <div className="mt-0.5 text-[10.5px] italic text-warning">Estimation — aucune simulation enregistrée</div>
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
