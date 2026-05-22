import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import {
  pillar3aMaxContribution,
  pillar3aTaxSavings,
  projectPillar3a,
  staggeredWithdrawal,
} from "@/lib/pillar3";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportPillar3aPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { FiscalSnapshotBanner } from "@/components/calculators/FiscalSnapshotBanner";
import { SplitCompareLayout, type SplitRow } from "@/components/calculators/SplitCompareLayout";
import { useT } from "@/contexts/LanguageContext";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/pillar3a")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "3e pilier A & B · SwissBroker Pro" }] }),
  component: Pillar3aCalc,
});

function Pillar3aCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "pillar3a");
  const [form, setForm] = useState({
    hasLPP: true,
    netSelfEmploymentIncome: 0,
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    grossSalary: 100_000,
    contribution: 7258,
    currentBalance: 50_000,
    yearsToRetirement: 25,
    expectedReturn: 2.5,
    withdrawalCapital: 250_000,
    withdrawalAccounts: 3,
    pillar3bYearly: 3_000,
    pillar3bCurrent: 0,
    pillar3bYears: 25,
    pillar3bReturn: 2.0,
  });
  useHydrateFormFromPrefill(prefill, setForm);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const max = pillar3aMaxContribution({
    hasLPP: form.hasLPP,
    netSelfEmploymentIncome: form.netSelfEmploymentIncome,
  });

  const savings = useMemo(
    () =>
      pillar3aTaxSavings({
        contribution: form.contribution,
        taxInput: { canton: form.canton, status: form.status, grossSalary: form.grossSalary },
      }),
    [form],
  );

  const projection = useMemo(
    () =>
      projectPillar3a({
        currentBalance: form.currentBalance,
        yearlyContribution: form.contribution,
        years: form.yearsToRetirement,
        expectedReturnRate: form.expectedReturn,
      }),
    [form],
  );

  const stag = useMemo(
    () =>
      staggeredWithdrawal({
        totalCapital: form.withdrawalCapital,
        numberOfAccounts: form.withdrawalAccounts,
        canton: form.canton,
        status: form.status === "single_with_children" ? "single_with_children" : form.status,
      }),
    [form],
  );

  // Scénario optimisé : cotisation au plafond légal + 3b cible + retrait
  // fractionné. Permet d'afficher un vrai gain même quand le 3a est déjà au max.
  const isMaxed = form.contribution >= max;
  // 3b cible, règle auto : si < 3'000 CHF/an → 6'000 ; sinon versement × 1,5
  // (plafond 10'000). L'utilisateur peut surcharger via le champ ci-dessous.
  const auto3bTarget = useMemo(() => {
    if (form.pillar3bYearly < 3_000) return 6_000;
    return Math.min(10_000, Math.round(form.pillar3bYearly * 1.5));
  }, [form.pillar3bYearly]);
  const [target3bOverride, setTarget3bOverride] = useState<number | null>(null);
  const target3bYearly = target3bOverride ?? auto3bTarget;

  const optimizedSavings = useMemo(
    () =>
      pillar3aTaxSavings({
        contribution: max,
        taxInput: { canton: form.canton, status: form.status, grossSalary: form.grossSalary },
      }),
    [max, form.canton, form.status, form.grossSalary],
  );
  const optimizedProjection = useMemo(
    () =>
      projectPillar3a({
        currentBalance: form.currentBalance,
        yearlyContribution: max,
        years: form.yearsToRetirement,
        expectedReturnRate: form.expectedReturn,
      }),
    [max, form.currentBalance, form.yearsToRetirement, form.expectedReturn],
  );

  // Projection 3b (actuelle et optimisée), capitalisation simple.
  const project3b = (yearly: number) => {
    const r = form.pillar3bReturn / 100;
    let balance = form.pillar3bCurrent;
    for (let i = 0; i < form.pillar3bYears; i++) {
      balance = balance * (1 + r) + yearly;
    }
    return Math.round(balance);
  };
  const current3bFinal = useMemo(
    () => project3b(form.pillar3bYearly),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.pillar3bCurrent, form.pillar3bReturn, form.pillar3bYears, form.pillar3bYearly],
  );
  const optimized3bFinal = useMemo(
    () => project3b(target3bYearly),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.pillar3bCurrent, form.pillar3bReturn, form.pillar3bYears, target3bYearly],
  );

  // Impôt de sortie : actuel = retrait unique sur 3a projeté ; projeté =
  // fractionné sur N comptes (utilise le stag déjà calculé sur withdrawalCapital,
  // mais on recalcule ici sur le capital 3a projeté pour cohérence).
  const taxLumpCurrent = useMemo(
    () =>
      staggeredWithdrawal({
        totalCapital: projection.finalBalance,
        numberOfAccounts: 1,
        canton: form.canton,
        status: form.status === "single_with_children" ? "single_with_children" : form.status,
      }),
    [projection.finalBalance, form.canton, form.status],
  );
  const taxStaggeredProjected = useMemo(
    () =>
      staggeredWithdrawal({
        totalCapital: optimizedProjection.finalBalance,
        numberOfAccounts: Math.max(2, form.withdrawalAccounts),
        canton: form.canton,
        status: form.status === "single_with_children" ? "single_with_children" : form.status,
      }),
    [optimizedProjection.finalBalance, form.withdrawalAccounts, form.canton, form.status],
  );

  const currentTotalPrivate = projection.finalBalance + current3bFinal;
  const projectedTotalPrivate = optimizedProjection.finalBalance + optimized3bFinal;
  const currentNetAfterTax = currentTotalPrivate - taxLumpCurrent.totalTaxSingle;
  const projectedNetAfterTax =
    projectedTotalPrivate - taxStaggeredProjected.totalTaxSeparated;

  const compareRows: SplitRow[] = useMemo(
    () => [
      { label: "Cotisation annuelle 3a", current: form.contribution, projected: max, betterWhen: "higher" },
      { label: "Cotisation annuelle 3b", current: form.pillar3bYearly, projected: target3bYearly, betterWhen: "higher" },
      {
        label: "Économie d'impôt annuelle (3a)",
        current: savings.taxSavings,
        projected: optimizedSavings.taxSavings,
        betterWhen: "higher",
        hint: "Le 3B n'est pas déductible du revenu.",
      },
      {
        label: `Capital 3a à la retraite (${form.yearsToRetirement} ans)`,
        current: projection.finalBalance,
        projected: optimizedProjection.finalBalance,
        betterWhen: "higher",
      },
      {
        label: `Capital 3b à la retraite (${form.pillar3bYears} ans)`,
        current: current3bFinal,
        projected: optimized3bFinal,
        betterWhen: "higher",
      },
      {
        label: "Capital total prévoyance privée (3a + 3b)",
        current: currentTotalPrivate,
        projected: projectedTotalPrivate,
        betterWhen: "higher",
      },
      {
        label: "Impôt sur le retrait (unique vs fractionné)",
        current: taxLumpCurrent.totalTaxSingle,
        projected: taxStaggeredProjected.totalTaxSeparated,
        betterWhen: "lower",
        hint: `Projeté = retrait étalé sur ${Math.max(2, form.withdrawalAccounts)} comptes.`,
      },
      {
        label: "Capital net après impôt de sortie",
        current: currentNetAfterTax,
        projected: projectedNetAfterTax,
        betterWhen: "higher",
      },
    ],
    [
      form.contribution, form.pillar3bYearly, form.yearsToRetirement, form.pillar3bYears, form.withdrawalAccounts,
      max, target3bYearly, savings, optimizedSavings, projection, optimizedProjection,
      current3bFinal, optimized3bFinal, currentTotalPrivate, projectedTotalPrivate,
      taxLumpCurrent, taxStaggeredProjected, currentNetAfterTax, projectedNetAfterTax,
    ],
  );

  const { user } = useAuth();
  const brokerHeader = useBrokerPdfHeader();
  const handleExport = () =>
    exportPillar3aPdf({
      header: brokerHeader,
      input: form,
      taxSavings: savings,
      projection,
      staggered: stag,
    });

  const projection3b = useMemo(() => {
    const r = form.pillar3bReturn / 100;
    let balance = form.pillar3bCurrent;
    for (let i = 0; i < form.pillar3bYears; i++) {
      balance = balance * (1 + r) + form.pillar3bYearly;
    }
    const totalContrib = form.pillar3bYearly * form.pillar3bYears;
    return {
      finalBalance: Math.round(balance),
      totalContributions: totalContrib,
      totalReturns: Math.round(balance - form.pillar3bCurrent - totalContrib),
    };
  }, [form.pillar3bCurrent, form.pillar3bReturn, form.pillar3bYears, form.pillar3bYearly]);

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.p3a.step.welcome.t"), body: t("calc.p3a.step.welcome.b") },
    { title: t("calc.p3a.step.cap.t"), body: t("calc.p3a.step.cap.b") },
    { title: t("calc.p3a.step.assumptions.t"), body: t("calc.p3a.step.assumptions.b") },
    { title: t("calc.p3a.step.p3b.t"), body: t("calc.p3a.step.p3b.b") },
  ];

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.p3a.guide_title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}
      <FiscalSnapshotBanner clientId={clientId} />

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="font-semibold">{t("calc.p3a.intro_title")}</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">{t("calc.p3a.intro_3a_title")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("calc.p3a.intro_3a_body")}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">{t("calc.p3a.intro_3b_title")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("calc.p3a.intro_3b_body")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title={t("calc.p3a.contribution_card")} description={t("calc.p3a.contribution_desc")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.hasLPP} onCheckedChange={(v) => set("hasLPP", Boolean(v))} />
                {t("calc.p3a.has_lpp")}
              </label>
              {!form.hasLPP && (
                <NumField
                  label={t("calc.p3a.field.self_income")}
                  value={form.netSelfEmploymentIncome}
                  onChange={(v) => set("netSelfEmploymentIncome", v)}
                />
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("pension.canton")}</Label>
                <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getSelectableCantons().map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("pension.civil_status")}</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as IncomeTaxInput["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">{t("calc.status.single")}</SelectItem>
                    <SelectItem value="married">{t("calc.status.married")}</SelectItem>
                    <SelectItem value="single_with_children">{t("calc.status.single_with_children")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label={t("pension.gross_salary_annual")} value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
              <NumField label={t("calc.p3a.field.contribution_max", { max })} value={form.contribution} onChange={(v) => set("contribution", Math.min(v, max))} wikiId="p3a-base" wikiTip={t("calc.p3a.tip.contribution_max")} />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title={t("calc.p3a.savings_card")}>
            <Row>
              <MoneyTile label={t("calc.p3a.tax_savings_label")} value={savings.taxSavings} tone="success" big tip={t("calc.p3a.tip.tax_savings")} />
              <MoneyTile label={t("calc.p3a.effective_cost")} value={savings.effectiveCost} tone="primary" tip={t("calc.p3a.tip.effective_cost")} />
            </Row>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("calc.p3a.marginal_rate", { rate: savings.marginalRate.toFixed(1) })}
            </p>
          </CalcCard>
        </div>
      </div>

      {isMaxed && (
        <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm">
          <div className="font-semibold text-success">✅ Cotisation 3a déjà au maximum légal ({max.toLocaleString("fr-CH")} CHF)</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Leviers d'optimisation restants : <strong>cotiser à un 3B</strong> (assurance-vie / épargne libre, cible {target3bYearly.toLocaleString("fr-CH")} CHF/an) et <strong>fractionner les retraits</strong> sur {Math.max(2, form.withdrawalAccounts)} comptes 3a pour réduire l'impôt de sortie.
          </p>
        </div>
      )}

      {/* Champ « 3b cible » éditable, juste au-dessus du comparateur. */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/50 p-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs font-medium text-muted-foreground">
            🎯 3b cible (CHF/an), colonne projetée
          </Label>
          <BaseNumField
            value={String(target3bYearly)}
            onChange={(v) => setTarget3bOverride(Number(v) || 0)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Suggéré automatiquement : <strong>{auto3bTarget.toLocaleString("fr-CH")} CHF/an</strong>
            {form.pillar3bYearly < 3_000
              ? " (3b actuel < 3 000 → cible de départ 6 000)"
              : " (versement actuel × 1,5, plafonné à 10 000)"}
            . Modifiez pour ajuster la projection.
          </p>
        </div>
        {target3bOverride !== null && target3bOverride !== auto3bTarget && (
          <button
            type="button"
            onClick={() => setTarget3bOverride(null)}
            className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            ↺ Auto
          </button>
        )}
      </div>

      <SplitCompareLayout
        title="Actuel vs Projeté, Prévoyance privée totale (3a + 3b)"
        description={
          isMaxed
            ? `3a déjà au max (${max.toLocaleString("fr-CH")} CHF). Projection = 3b cible (${target3bYearly.toLocaleString("fr-CH")} CHF/an) + retrait fractionné.`
            : `3a au plafond (${max.toLocaleString("fr-CH")} CHF), 3b cible ${target3bYearly.toLocaleString("fr-CH")} CHF/an et retrait fractionné sur ${Math.max(2, form.withdrawalAccounts)} comptes.`
        }
        legend={
          <>
            💡 Les <strong className="text-success">petites pastilles vertes</strong> à droite de chaque ligne montrent l'écart projeté – actuel (ex.{" "}
            <span className="font-mono">+1 500 CHF</span> = vous cotiseriez 1 500 de plus). Le 3b n'étant pas déductible du revenu, il n'apparaît pas dans l'économie d'impôt annuelle.
          </>
        }
        currentSubtitle={client ? "Données fiche client" : "Valeurs saisies"}
        projectedSubtitle="3a max + 3b cible + retrait fractionné"
        rows={compareRows}
        summary={{
          annualSaving: isMaxed
            ? taxStaggeredProjected.totalTaxSingle - taxStaggeredProjected.totalTaxSeparated
            : optimizedSavings.taxSavings - savings.taxSavings,
          annualSavingLabel: isMaxed
            ? "Économie d'impôt au retrait (fractionnement)"
            : "Économie d'impôt annuelle (3a)",
          retirementGain: projectedNetAfterTax - currentNetAfterTax,
          retirementGainLabel: "Capital net supplémentaire (après impôt de sortie)",
          deltaPercent:
            currentNetAfterTax > 0
              ? (projectedNetAfterTax - currentNetAfterTax) / currentNetAfterTax
              : 0,
          deltaLabel: "Capital net total",
          footnote: (
            <>
              <strong>D'où vient le gain ?</strong> Capital 3a supplémentaire :{" "}
              {(optimizedProjection.finalBalance - projection.finalBalance).toLocaleString("fr-CH")} CHF · Capital 3b supplémentaire :{" "}
              {(optimized3bFinal - current3bFinal).toLocaleString("fr-CH")} CHF · Impôt en moins au retrait (fractionnement) :{" "}
              {(taxLumpCurrent.totalTaxSingle - taxStaggeredProjected.totalTaxSeparated).toLocaleString("fr-CH")} CHF.
              {isMaxed && " Votre 3a est déjà au maximum légal → le gain provient uniquement du 3b + du fractionnement des retraits."}
            </>
          ),
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <CalcCard title={t("calc.p3a.projection_card")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label={t("calc.p3a.field.current_balance")} value={form.currentBalance} onChange={(v) => set("currentBalance", v)} />
            <NumField label={t("pension.years_to_retirement")} value={form.yearsToRetirement} onChange={(v) => set("yearsToRetirement", v)} />
            <NumField label={t("pension.expected_return")} value={form.expectedReturn} onChange={(v) => set("expectedReturn", v)} step={0.1} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyTile label={t("calc.p3a.final_balance")} value={projection.finalBalance} tone="primary" big tip={t("calc.p3a.tip.final_balance")} />
            <MoneyTile label={t("calc.p3a.total_contrib")} value={projection.totalContributions} tip={t("calc.p3a.tip.total_contrib")} />
            <MoneyTile label={t("calc.p3a.total_returns")} value={projection.totalReturns} tone="success" tip={t("calc.p3a.tip.total_returns")} />
          </div>
        </CalcCard>
        <CalcCard title={t("calc.p3a.staggered_card")} description={t("calc.p3a.staggered_desc")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label={t("calc.p3a.field.withdrawal_capital")} value={form.withdrawalCapital} onChange={(v) => set("withdrawalCapital", v)} wikiId="p3a-base" wikiTip={t("calc.p3a.tip.withdrawal_capital")} />
            <NumField label={t("calc.p3a.field.withdrawal_accounts")} value={form.withdrawalAccounts} onChange={(v) => set("withdrawalAccounts", v)} wikiId="p3a-base" wikiTip={t("calc.p3a.tip.withdrawal_accounts")} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyTile label={t("calc.p3a.tax_single")} value={stag.totalTaxSingle} tone="warning" tip={t("calc.p3a.tip.tax_single")} />
            <MoneyTile label={t("calc.p3a.tax_separated")} value={stag.totalTaxSeparated} tone="primary" tip={t("calc.p3a.tip.tax_separated")} />
            <MoneyTile label={t("calc.p3a.savings_label")} value={stag.savings} tone="success" big tip={t("calc.p3a.tip.savings_label")} />
            <MoneyTile label={t("calc.p3a.per_account")} value={stag.perAccount} tip={t("calc.p3a.tip.per_account")} />
          </div>
        </CalcCard>
      </div>

      <CalcCard
        title={t("calc.p3a.p3b_card")}
        description={t("calc.p3a.p3b_desc")}
        tip={t("calc.p3a.p3b_tip")}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumField label={t("calc.p3a.field.3b_current")} value={form.pillar3bCurrent} onChange={(v) => set("pillar3bCurrent", v)} />
              <NumField label={t("calc.p3a.field.3b_yearly")} value={form.pillar3bYearly} onChange={(v) => set("pillar3bYearly", v)} />
              <NumField label={t("calc.p3a.field.3b_years")} value={form.pillar3bYears} onChange={(v) => set("pillar3bYears", v)} />
              <NumField label={t("calc.p3a.field.3b_return")} value={form.pillar3bReturn} onChange={(v) => set("pillar3bReturn", v)} step={0.1} />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("calc.p3a.p3b_help")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyTile label={t("calc.p3a.p3b_final")} value={projection3b.finalBalance} tone="primary" big tip={t("calc.p3a.tip.p3b_final")} />
            <MoneyTile label={t("calc.p3a.p3b_contrib")} value={projection3b.totalContributions} tip={t("calc.p3a.tip.p3b_contrib")} />
            <MoneyTile label={t("calc.p3a.total_returns")} value={projection3b.totalReturns} tone="success" tip={t("calc.p3a.tip.p3b_returns")} />
            <MoneyTile label={t("calc.p3a.total_3a_3b")} value={projection.finalBalance + projection3b.finalBalance} tone="success" tip={t("calc.p3a.tip.total_3a_3b")} />
          </div>
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="pillar3a"
          inputs={form}
          summary={{
            taxSavings: savings.taxSavings,
            effectiveCost: savings.effectiveCost,
            marginalRate: savings.marginalRate,
            finalBalance: projection.finalBalance,
            totalContributions: projection.totalContributions,
            totalReturns: projection.totalReturns,
            staggeredSavings: stag.savings,
          }}
          defaultTitle={`3a ${form.canton} · ${form.contribution} CHF/an`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step: _step = 1,
  suffix,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId ? <WikiTip articleId={wikiId} tip={wikiTip ?? label} /> : null}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}
