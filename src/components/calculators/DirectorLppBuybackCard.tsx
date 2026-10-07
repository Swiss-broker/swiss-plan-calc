// Wave 3 · Module rachats LPP dirigeant
import { useCallback, useMemo, useState } from "react";
import { CalcCard, MoneyTile } from "@/components/calculators/CalcUI";
import { NumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCHF } from "@/lib/format";
import { simulateBuybackPlan, computeLppInsuredSalary } from "@/lib/lpp";
import { LPP_2026, LPP_2026_SOURCE_NOTE } from "@/lib/lpp/parameters-2026";
import type { CompensationResult } from "@/lib/director-compensation/types";
import { Sparkles, PiggyBank, AlertTriangle } from "lucide-react";

interface Props {
  best: CompensationResult;
  retirementAge?: number;
  initialBalance?: number;
  initialMaxBuyback?: number;
  clientGrossSalary?: number;
}

export function DirectorLppBuybackCard({
  best,
  retirementAge = 65,
  initialBalance = 0,
  initialMaxBuyback,
  clientGrossSalary,
}: Props) {
  const inputs = best.inputs;
  const initialGrossSalary = clientGrossSalary ?? best.company.grossSalary;
  const [grossSalary, setGrossSalary] = useState<number>(initialGrossSalary);
  const salaryEdited = grossSalary !== initialGrossSalary;
  const insuredCap =
    inputs.lppPlan === "executive_1e" ? LPP_2026.oneEPlanCap : LPP_2026.maxInsuredSalary;
  const insuredSalary = useMemo(
    () => computeLppInsuredSalary(grossSalary, insuredCap),
    [grossSalary, insuredCap],
  );

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
      title="Rachats LPP dirigeant · optimisation fiscale"
      description="Simule un rachat étalé (1 an / 5 ans / jusqu'à la retraite) sur la base du salaire recommandé."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Salaire brut annuel (CHF)
              {salaryEdited && (
                <Badge variant="secondary" className="bg-primary/15 text-[10px] text-primary">
                  modifié
                </Badge>
              )}
              {!salaryEdited && initialGrossSalary > 0 && (
                <Badge variant="outline" className="text-[10px]">préfill</Badge>
              )}
            </Label>
            <NumField
              value={String(grossSalary)}
              onChange={(v) => setGrossSalary(Number(v) || 0)}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Modifiable. Recalcule salaire assuré, capacité et marginal.
            </p>
          </div>
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

        {actualBuyback > 0 && yearsToRetire <= 3 && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Règle des 3 ans : retrait bloqué (art. 79b LPP)</p>
              <p className="mt-1 text-destructive/80">
                Le dirigeant part à la retraite dans {yearsToRetire} an{yearsToRetire > 1 ? "s" : ""}.
                Tout rachat effectué maintenant sera bloqué 3 ans. Si le capital est retiré avant ce délai,
                l'AFC annule la déduction fiscale et réclame le remboursement avec intérêts.
                Vérifier impérativement la date de retraite effective avant de procéder.
              </p>
            </div>
          </div>
        )}
        {actualBuyback > 0 && yearsToRetire > 3 && yearsToRetire <= 5 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Attention règle des 3 ans (art. 79b LPP)</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/80">
                Le dirigeant part à la retraite dans {yearsToRetire} ans. Les rachats effectués
                dans les 3 dernières années avant le retrait en capital seront bloqués.
                Planifier les rachats en conséquence et arrêter 3 ans avant la date de retrait prévue.
              </p>
            </div>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {LPP_2026_SOURCE_NOTE} · Le ROI fiscal dépend du taux marginal du dirigeant ({inputs.directorCanton},
          {" "}{inputs.status}). Étaler le rachat permet d'éviter la saturation de la déduction fiscale lorsque le
          marginal baisse en cours de plan. Les retraits LPP sont bloqués 3 ans après chaque rachat (art. 79b LPP).
        </p>
      </div>
    </CalcCard>
  );
}