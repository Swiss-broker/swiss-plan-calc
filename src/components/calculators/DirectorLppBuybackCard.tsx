// Wave 3 — Module rachats LPP dirigeant
// Pour la stratégie recommandée du comparateur dividende/salaire,
// simule un plan de rachat LPP étalé sur 1 an, 5 ans et jusqu'à la retraite.
// Affiche économie d'impôt, coût net et ROI fiscal.
import { useCallback, useMemo, useState } from "react";
import { CalcCard, MoneyTile } from "@/components/calculators/CalcUI";
import { NumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCHF } from "@/lib/format";
import { simulateBuybackPlan, computeLppInsuredSalary } from "@/lib/lpp";
import { LPP_2026, LPP_2026_SOURCE_NOTE } from "@/lib/lpp/parameters-2026";
import type { CompensationResult } from "@/lib/director-compensation/types";
import { Sparkles, PiggyBank } from "lucide-react";

interface Props {
  best: CompensationResult;
  retirementAge?: number;
  /** Solde LPP actuel pré-rempli depuis la fiche client si disponible */
  initialBalance?: number;
  /** Capacité de rachat communiquée par la caisse (sinon estimée) */
  initialMaxBuyback?: number;
}

export function DirectorLppBuybackCard({
  best,
  retirementAge = 65,
  initialBalance = 0,
  initialMaxBuyback,
}: Props) {
  const inputs = best.inputs;
  const grossSalary = best.company.grossSalary;
  const insuredCap =
    inputs.lppPlan === "executive_1e" ? LPP_2026.oneEPlanCap : LPP_2026.maxInsuredSalary;
  const insuredSalary = useMemo(
    () => computeLppInsuredSalary(grossSalary, insuredCap),
    [grossSalary, insuredCap],
  );

  // Estimation simple : capacité = 6 × salaire assuré − solde actuel (proxy)
  const estimatedCapacity = useMemo(
    () => Math.max(0, Math.round(insuredSalary * 6 - initialBalance)),
    [insuredSalary, initialBalance],
  );
  const [maxBuyback, setMaxBuyback] = useState(initialMaxBuyback ?? estimatedCapacity);
  const [actualBuyback, setActualBuyback] = useState(initialMaxBuyback ?? estimatedCapacity);

  const yearsToRetire = Math.max(1, retirementAge - inputs.age);

  const taxInput = useMemo(
    () => ({
      canton: inputs.directorCanton,
      communalMultiplier: inputs.directorCommunalMultiplier,
      status: inputs.status,
      confession: inputs.confession,
      children: inputs.children ?? 0,
      age: inputs.age,
      lppPlan: inputs.lppPlan === "executive_1e" ? ("cadres" as const) : ("mandatory" as const),
      grossSalary,
    }),
    [inputs, grossSalary],
  );

  const horizons = useMemo(
    () => [
      { key: "1y", label: "1 an", years: 1 },
      { key: "5y", label: "5 ans", years: Math.min(5, yearsToRetire) },
      { key: "ret", label: `Jusqu'à ${retirementAge} ans`, years: yearsToRetire },
    ],
    [yearsToRetire, retirementAge],
  );

  // Mémoïsation par horizon : évite de recalculer les 3 plans quand seul
  // un paramètre indépendant change. simulateBuybackPlan ne dépend que de
  // actualBuyback (pas de maxBuyback), donc on l'exclut des dépendances.
  const sim1y = useMemo(
    () => simulateBuybackPlan({ buybackCapacity: actualBuyback, actualBuyback, years: horizons[0].years, taxInput }),
    [actualBuyback, horizons[0].years, taxInput],
  );
  const sim5y = useMemo(
    () => simulateBuybackPlan({ buybackCapacity: actualBuyback, actualBuyback, years: horizons[1].years, taxInput }),
    [actualBuyback, horizons[1].years, taxInput],
  );
  const simRet = useMemo(
    () => simulateBuybackPlan({ buybackCapacity: actualBuyback, actualBuyback, years: horizons[2].years, taxInput }),
    [actualBuyback, horizons[2].years, taxInput],
  );

  const sims = useMemo(
    () => [
      { ...horizons[0], result: sim1y },
      { ...horizons[1], result: sim5y },
      { ...horizons[2], result: simRet },
    ],
    [horizons, sim1y, sim5y, simRet],
  );

  // Recommandation : ROI fiscal le plus élevé
  const best1 = useMemo(
    () => sims.reduce((a, b) => (b.result.averageReturn > a.result.averageReturn ? b : a), sims[0]),
    [sims],
  );

  const handleMaxChange = useCallback((v: string) => {
    const n = Number(v) || 0;
    setMaxBuyback(n);
    setActualBuyback((prev) => Math.min(prev, n));
  }, []);
  const handleActualChange = useCallback(
    (v: string) => setActualBuyback(Math.min(Number(v) || 0, maxBuyback)),
    [maxBuyback],
  );

  return (
    <CalcCard
      title="Rachats LPP dirigeant — optimisation fiscale"
      description="Simule un rachat étalé (1 an / 5 ans / jusqu'à la retraite) sur la base du salaire recommandé."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Salaire assuré LPP</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums">
              {formatCHF(insuredSalary)}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Plafond {inputs.lppPlan === "executive_1e" ? "plan 1e cadres" : "obligatoire"} appliqué.
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Capacité de rachat (CHF)</Label>
            <NumField value={String(maxBuyback)} onChange={handleMaxChange} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Estimée. Saisir le montant exact communiqué par la caisse.
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Montant à racheter (CHF)</Label>
            <NumField value={String(actualBuyback)} onChange={handleActualChange} />
            <p className="mt-1 text-[10px] text-muted-foreground">≤ capacité de rachat.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {sims.map((s) => {
            const isBest = s.key === best1.key;
            return (
              <div
                key={s.key}
                className={`rounded-xl border p-4 ${
                  isBest
                    ? "border-success/40 bg-gradient-to-br from-success/10 to-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                  {isBest && (
                    <Badge variant="secondary" className="bg-success/15 text-[10px] text-success-foreground">
                      <Sparkles className="mr-1 h-3 w-3" />
                      ROI max
                    </Badge>
                  )}
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Versement annuel</span>
                    <strong className="tabular-nums">{formatCHF(s.result.yearlyAmount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Économie d'impôt totale</span>
                    <strong className="tabular-nums text-success-foreground">
                      {formatCHF(s.result.totalTaxSavings)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coût net (après impôt)</span>
                    <strong className="tabular-nums">
                      {formatCHF(s.result.totalBought - s.result.totalTaxSavings)}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">ROI fiscal moyen</span>
                    <strong className="tabular-nums text-primary">{s.result.averageReturn.toFixed(1)} %</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marginal effectif (an 1)</span>
                    <span className="tabular-nums">{s.result.effectiveMarginalRate.toFixed(1)} %</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MoneyTile
            label="Économie totale (recommandé)"
            value={best1.result.totalTaxSavings}
            tone="success"
            tip="Cumul des économies d'impôt sur le plan recommandé."
          />
          <MoneyTile
            label="Coût net du rachat"
            value={best1.result.totalBought - best1.result.totalTaxSavings}
            tone="default"
          />
          <MoneyTile
            label="Capital LPP renforcé"
            value={best1.result.totalBought}
            tone="primary"
            tip="Montant total reversé sur le 2e pilier (avant rendement futur)."
          />
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {LPP_2026_SOURCE_NOTE} · Le ROI fiscal dépend du taux marginal du dirigeant ({inputs.directorCanton},
          {" "}{inputs.status}). Étaler le rachat permet d'éviter la saturation de la déduction fiscale lorsque le
          marginal baisse en cours de plan. Les retraits LPP sont bloqués 3 ans après chaque rachat (art. 79b LPP).
        </p>
      </div>
    </CalcCard>
  );
}
