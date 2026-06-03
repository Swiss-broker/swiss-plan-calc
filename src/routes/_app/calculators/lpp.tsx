import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line as RLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calculator, Info, RotateCcw, Pencil, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { tCanton } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { projectLPP, simulateBuybackPlan, computeLppInsuredSalary, estimateRetroactiveLppBalance } from "@/lib/lpp";
import { LPP_2026 } from "@/lib/lpp/parameters-2026";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
const fmtCHF = formatCHF;
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportLppPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { FiscalSnapshotBanner } from "@/components/calculators/FiscalSnapshotBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { SplitCompareLayout, type SplitRow } from "@/components/calculators/SplitCompareLayout";
import { useT } from "@/contexts/LanguageContext";
import { useClientDashboard } from "@/hooks/use-client-dashboard";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/lpp")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "LPP & rachats · SwissBroker Pro" }] }),
  component: LppCalc,
});

function LppCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, bundle, prefill } = usePrefillFromClient(clientId, "lpp");
  const dashboard = useClientDashboard(bundle);
  const ficheLppCapital = dashboard?.lpp?.projectedCapitalAt65 ?? 0;
  const [form, setForm] = useState({
    currentAge: 40,
    retirementAge: 65,
    currentBalance: 250_000,
    grossSalary: 120_000,
    insuredSalary: computeLppInsuredSalary(120_000, LPP_2026.maxInsuredSalary),
    expectedReturnRate: 1.25,
    feeRate: 0.6,
    insuredSalaryCap: LPP_2026.maxInsuredSalary as number,
    salaryGrowthRate: 1,
    conversionRate: 6.0,
    extraCreditRate: 0,
    yearlyBuyback: 0,
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    buybackCapacity: 0,
    actualBuyback: 0,
    buybackYears: 3,
    // Mode rétroactif (uniquement quand currentBalance = 0)
    retroactiveMode: false,
    entryAge: 25,
    // Enrichissement fiscal pour le plan de rachat
    spouseGrossSalary: 0,
    pillar3aContributions: 0,
    healthInsurancePremiums: 0,
    confession: "none" as NonNullable<IncomeTaxInput["confession"]>,
    // Rentes LPP du certificat (invalidité / orphelin / veuf-veuve)
    disabilityAmount: 0,
    disabilityPeriod: "year" as "year" | "month",
    orphanAmount: 0,
    orphanPeriod: "year" as "year" | "month",
    widowAmount: 0,
    widowPeriod: "year" as "year" | "month",
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const [insuredSalaryManual, setInsuredSalaryManual] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (insuredSalaryManual) return;
    const auto = computeLppInsuredSalary(form.grossSalary, form.insuredSalaryCap);
    if (auto !== form.insuredSalary) {
      setForm((f) => ({ ...f, insuredSalary: auto }));
    }
  }, [form.grossSalary, form.insuredSalaryCap, insuredSalaryManual, form.insuredSalary]);

  const recalcAuto = () => {
    setInsuredSalaryManual(false);
    setForm((f) => ({
      ...f,
      insuredSalary: computeLppInsuredSalary(f.grossSalary, f.insuredSalaryCap),
    }));
  };

  // Avoir LPP effectif (inclut estimation rétroactive si activée)
  const effectiveCurrentBalance = useMemo(() => {
    if (form.retroactiveMode && form.currentBalance === 0) {
      return estimateRetroactiveLppBalance({
        entryAge: form.entryAge,
        currentAge: form.currentAge,
        insuredSalary: form.insuredSalary,
      });
    }
    return form.currentBalance;
  }, [form.retroactiveMode, form.currentBalance, form.entryAge, form.currentAge, form.insuredSalary]);

  const actualBuybackCapped = Math.min(form.actualBuyback, form.buybackCapacity);
  const buybackExceedsCapacity = form.actualBuyback > form.buybackCapacity;

  const projection = useMemo(
    () =>
      projectLPP({
        ...form,
        currentBalance: effectiveCurrentBalance,
        yearlyBuyback: Math.round(actualBuybackCapped / Math.max(1, form.buybackYears)),
        buybackYears: form.buybackYears,
        insuredSalaryCap: form.insuredSalaryCap,
      }),
    [form, effectiveCurrentBalance, actualBuybackCapped],
  );

  // IncomeTaxInput enrichi : conjoint + 3a + primes maladie + confession
  const enrichedTaxInput: IncomeTaxInput = useMemo(
    () => ({
      canton: form.canton,
      status: form.status,
      grossSalary: form.grossSalary,
      spouseGrossSalary: form.status === "married" ? form.spouseGrossSalary : 0,
      children: form.children,
      age: form.currentAge,
      pillar3aContributions: form.pillar3aContributions,
      healthInsurancePremiums: form.healthInsurancePremiums || undefined,
      confession: form.confession,
    }),
    [form],
  );

  const buybackPlan = useMemo(
    () =>
      simulateBuybackPlan({
        buybackCapacity: form.buybackCapacity,
        actualBuyback: actualBuybackCapped,
        years: Math.max(1, form.buybackYears),
        taxInput: enrichedTaxInput,
      }),
    [form.buybackCapacity, form.buybackYears, actualBuybackCapped, enrichedTaxInput],
  );

  // Projection sans rachat, baseline pour la comparaison "Actuel vs Projeté".
  const projectionNoBuyback = useMemo(
    () =>
      projectLPP({
        ...form,
        currentBalance: effectiveCurrentBalance,
        yearlyBuyback: 0,
        buybackYears: 0,
        insuredSalaryCap: form.insuredSalaryCap,
      }),
    [form, effectiveCurrentBalance],
  );

  const compareRows: SplitRow[] = useMemo(
    () => [
      {
        label: "Capital LPP projeté à la retraite",
        current: projectionNoBuyback.projectedBalance,
        projected: projection.projectedBalance,
        betterWhen: "higher",
      },
      {
        label: "Rachats cumulés",
        current: 0,
        projected: projection.totalBuybacks,
        betterWhen: "higher",
      },
      {
        label: "Économie d'impôt totale (rachats)",
        current: 0,
        projected: buybackPlan.totalTaxSavings,
        betterWhen: "higher",
      },
    ],
    [projectionNoBuyback, projection, buybackPlan],
  );


  const { user } = useAuth();
  const brokerHeader = useBrokerPdfHeader();
  const handleExport = () =>
    exportLppPdf({
      header: brokerHeader,
      input: form,
      projection,
      buybackPlan,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.lpp.step.welcome.t"), body: t("calc.lpp.step.welcome.b") },
    { title: t("calc.lpp.step.personal.t"), body: t("calc.lpp.step.personal.b") },
    { title: t("calc.lpp.step.salary.t"), body: t("calc.lpp.step.salary.b") },
    { title: t("calc.lpp.step.assumptions.t"), body: t("calc.lpp.step.assumptions.b") },
    { title: t("calc.lpp.step.buyback.t"), body: t("calc.lpp.step.buyback.b") },
    { title: t("calc.lpp.step.results.t"), body: t("calc.lpp.step.results.b") },
  ];

  return (
    <div className="space-y-6">
      <CrossCalcImpactBanner calculator="lpp" clientId={clientId} />
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.lpp.guide_title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}
      <FiscalSnapshotBanner clientId={clientId} />
      {clientId && ficheLppCapital > 0 &&
        Math.abs(projection.projectedBalance - ficheLppCapital) > 1 && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div className="flex-1 text-foreground">
              <p className="font-medium">Simulation non sauvegardée</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Valeur ici : <span className="font-semibold tabular-nums text-foreground">{fmtCHF(projection.projectedBalance)}</span> · Fiche client : <span className="font-semibold tabular-nums text-foreground">{fmtCHF(ficheLppCapital)}</span>. Cliquez « Appliquer à la fiche » pour synchroniser.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!clientId) return;
                const planned = form.actualBuyback > 0 ? [{
                  year: new Date().getFullYear(),
                  amount: form.actualBuyback,
                  label: `Rachat planifié ${form.buybackYears} an(s)`,
                }] : [];
                const assumptions = {
                  expectedReturnRate: form.expectedReturnRate,
                  feeRate: form.feeRate,
                  salaryGrowthRate: form.salaryGrowthRate,
                  conversionRate: form.conversionRate,
                };
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase
                  .from("client_pension")
                  .update({
                    lpp_planned_buybacks: planned,
                    lpp_assumptions: assumptions,
                  } as never)
                  .eq("client_id", clientId);
                window.location.reload();
              }}
            >
              Appliquer à la fiche
            </Button>
          </div>
        )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title={t("calc.lpp.projection_card")} description={t("calc.lpp.projection_desc")}>
            <InsuredSalaryPanel
              grossSalary={form.grossSalary}
              insuredSalary={form.insuredSalary}
              insuredSalaryCap={form.insuredSalaryCap}
              isManual={insuredSalaryManual}
              onGrossChange={(v) => set("grossSalary", v)}
              onCapChange={(v) => set("insuredSalaryCap", v)}
              onInsuredChange={(v) => {
                setInsuredSalaryManual(true);
                set("insuredSalary", v);
              }}
              onRecalcAuto={recalcAuto}
            />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField label={t("pension.current_age")} value={form.currentAge} onChange={(v) => set("currentAge", v)} />
              <NumField label={t("pension.retirement_age")} value={form.retirementAge} onChange={(v) => set("retirementAge", v)} />
              <NumField label={t("calc.lpp.field.current_balance")} value={form.currentBalance} onChange={(v) => set("currentBalance", v)} wikiId="lpp-coordination" wikiTip={t("calc.lpp.tip.balance")} />
              <NumField label={t("calc.lpp.field.expected_return")} value={form.expectedReturnRate} onChange={(v) => set("expectedReturnRate", v)} step={0.1} wikiId="lpp-credits" wikiTip={t("calc.lpp.tip.return")} />
              <NumField label={t("calc.lpp.field.fees")} value={form.feeRate} onChange={(v) => set("feeRate", v)} step={0.05} />
              <NumField label={t("calc.lpp.field.salary_growth")} value={form.salaryGrowthRate} onChange={(v) => set("salaryGrowthRate", v)} step={0.1} />
              <NumField label={t("calc.lpp.field.conversion_rate")} value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} wikiId="lpp-conversion" wikiTip={t("calc.lpp.tip.conversion")} />
              <NumField label={t("calc.lpp.field.extra_credit")} value={form.extraCreditRate} onChange={(v) => set("extraCreditRate", v)} step={0.5} wikiId="lpp-credits" wikiTip={t("calc.lpp.tip.extra_credit")} />
            </div>

            {/* Mode rétroactif · visible uniquement si avoir LPP courant = 0 */}
            {form.currentBalance === 0 && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <Label className="text-xs font-semibold text-foreground">
                      {t("calc.lpp.retro.toggle")}
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t("calc.lpp.retro.toggle_help")}
                    </p>
                  </div>
                  <Switch
                    checked={form.retroactiveMode}
                    onCheckedChange={(v) => set("retroactiveMode", v)}
                  />
                </div>
                {form.retroactiveMode && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <NumField
                      label={t("calc.lpp.retro.entry_age")}
                      value={form.entryAge}
                      onChange={(v) => set("entryAge", v)}
                    />
                    <div className="rounded-md border border-border bg-card p-2 text-[11px]">
                      <div className="text-muted-foreground">{t("calc.lpp.retro.estimated")}</div>
                      <div className="mt-0.5 font-semibold tabular-nums text-foreground">
                        {formatCHF(effectiveCurrentBalance)}
                      </div>
                    </div>
                    <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                      {t("calc.lpp.retro.note", { from: form.entryAge })}
                    </p>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  💡 {t("calc.lpp.search_tip")}{" "}
                  <a
                    href="https://sfbvg.ch/fr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {t("calc.lpp.search_tip_cta")}
                  </a>
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("calc.lpp.net_return", { rate: projection.netReturnRate.toFixed(2) })}
            </p>
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed text-foreground/80">
              <p className="font-semibold text-foreground">{t("calc.lpp.note.title")}</p>
              <p className="mt-1">{t("calc.lpp.note.body")}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">{t("calc.lpp.note.source")}</p>
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title={t("calc.lpp.result_card")}>
            <Row>
              <MoneyTile
                label={t("calc.lpp.projected_capital")}
                value={projection.projectedBalance}
                hint={t("calc.lpp.projected_hint")}
                tip={t("calc.lpp.projected_capital.tip")}
                tone="primary"
                big
              />
              <MoneyTile
                label={t("calc.lpp.annual_pension")}
                value={projection.annualPension}
                hint={t("calc.lpp.conv_hint", { rate: form.conversionRate })}
                tone="success"
              />
            </Row>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label={t("calc.lpp.monthly_pension")} value={projection.monthlyPension} tone="default" tip={t("calc.lpp.tip.monthly")} />
              <MoneyTile
                label={t("calc.lpp.balance_no_yield")}
                value={projection.projectedBalanceNoYield}
                hint={t("calc.lpp.balance_no_yield_hint", { val: formatCHF(projection.projectedBalance - projection.projectedBalanceNoYield) })}
                tip={t("calc.lpp.balance_no_yield.tip")}
                tone="default"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label={t("calc.lpp.fees_total")} value={projection.totalFees} tone="warning" tip={t("calc.lpp.tip.fees_total")} />
              <MoneyTile label={t("calc.lpp.buybacks_total")} value={projection.totalBuybacks} tone="default" tip={t("calc.lpp.tip.buybacks_total")} />
            </div>

            {/* Décomposition pédagogique : d'où vient le capital projeté */}
            {(() => {
              const totalCredits = projection.yearly.reduce((s, y) => s + y.credit, 0);
              const totalInterest = projection.yearly.reduce((s, y) => s + y.interest, 0);
              const start = effectiveCurrentBalance;
              return (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed">
                  <p className="font-semibold text-foreground">{t("calc.lpp.breakdown.title")}</p>
                  <div className="mt-2 space-y-1 font-mono text-foreground/80">
                    <div className="flex justify-between"><span>{t("calc.lpp.breakdown.start")}</span><span className="tabular-nums">{formatCHF(start)}</span></div>
                    <div className="flex justify-between"><span>+ {t("calc.lpp.breakdown.credits")}</span><span className="tabular-nums">{formatCHF(Math.round(totalCredits))}</span></div>
                    <div className="flex justify-between"><span>+ {t("calc.lpp.breakdown.interest")}</span><span className="tabular-nums">{formatCHF(Math.round(totalInterest))}</span></div>
                    <div className="flex justify-between"><span>+ {t("calc.lpp.breakdown.buybacks")}</span><span className="tabular-nums">{formatCHF(projection.totalBuybacks)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-primary/30 pt-1 font-semibold text-foreground"><span>= {t("calc.lpp.breakdown.total")}</span><span className="tabular-nums">{formatCHF(projection.projectedBalance)}</span></div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">{t("calc.lpp.breakdown.note")}</p>
                </div>
              );
            })()}
          </CalcCard>
        </div>
      </div>

      <CalcCard title={t("calc.lpp.evolution_card")} description={t("calc.lpp.evolution_desc")}>
        <div className="h-72 w-full chart-rise">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection.yearly}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatCHF(v)}
              />
              <RLine type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2.5} dot={false} name={t("calc.lpp.chart.balance")} />
              <RLine type="monotone" dataKey="balanceNoYield" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={t("calc.lpp.chart.no_yield")} />
              <RLine type="monotone" dataKey="interest" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} name={t("calc.lpp.chart.interest")} />
              <RLine type="monotone" dataKey="fees" stroke="var(--destructive)" strokeWidth={1.5} dot={false} name={t("calc.lpp.chart.fees")} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CalcCard>

      <SplitCompareLayout
        title="Actuel (sans rachat) vs Projeté (avec rachat)"
        description="Impact du plan de rachat sur le capital final et la fiscalité, à hypothèses de salaire et rendement identiques."
        currentSubtitle="Aucun rachat planifié"
        projectedSubtitle={`Rachat de ${formatCHF(actualBuybackCapped)} sur ${form.buybackYears} an(s)`}
        rows={compareRows}
        summary={{
          retirementGain: projection.projectedBalance - projectionNoBuyback.projectedBalance,
          retirementGainLabel: "Capital LPP en plus à la retraite",
          annualSaving:
            buybackPlan.totalTaxSavings / Math.max(1, form.buybackYears),
          deltaPercent:
            projectionNoBuyback.projectedBalance > 0
              ? (projection.projectedBalance - projectionNoBuyback.projectedBalance) /
                projectionNoBuyback.projectedBalance
              : 0,
          deltaLabel: "Capital final",
        }}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">

        <div className="md:col-span-3">
          <CalcCard title={t("calc.lpp.buyback_card")} description={t("calc.lpp.buyback_desc")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              {clientId ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("calc.lpp.field.children")}
                  </Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums">
                    {form.children}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Nombre d'enfants : {form.children} (depuis fiche client)
                  </p>
                </div>
              ) : (
                <NumField label={t("calc.lpp.field.children")} value={form.children} onChange={(v) => set("children", v)} wikiTip={t("calc.lpp.tip.children")} />
              )}
              <NumField label={t("calc.lpp.field.buyback_capacity")} value={form.buybackCapacity} onChange={(v) => set("buybackCapacity", v)} wikiId="lpp-rachat" wikiTip={t("calc.lpp.tip.buyback_capacity")} />
              <NumField label={t("calc.lpp.field.actual_buyback")} value={form.actualBuyback} onChange={(v) => set("actualBuyback", v)} wikiTip={t("calc.lpp.tip.actual_buyback")} />
              <NumField label={t("calc.lpp.field.buyback_years")} value={form.buybackYears} onChange={(v) => set("buybackYears", v)} wikiId="lpp-rachat" wikiTip={t("calc.lpp.tip.buyback_years")} />
            </div>

            {buybackExceedsCapacity && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>{t("calc.lpp.actual_buyback.warning", { cap: formatCHF(form.buybackCapacity) })}</span>
              </div>
            )}

            {/* Enrichissement fiscal pour calcul précis du marginal */}
            <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("calc.lpp.fiscal.title")}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("calc.lpp.fiscal.help")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.status === "married" && (
                  <NumField
                    label={t("calc.lpp.field.spouse_salary")}
                    value={form.spouseGrossSalary}
                    onChange={(v) => set("spouseGrossSalary", v)}
                    wikiTip={t("calc.lpp.tip.spouse_salary")}
                  />
                )}
                <NumField
                  label={t("calc.lpp.field.pillar3a_year")}
                  value={form.pillar3aContributions}
                  onChange={(v) => set("pillar3aContributions", v)}
                  wikiTip={t("calc.lpp.tip.pillar3a_year")}
                />
                <NumField
                  label={t("calc.lpp.field.health_premiums")}
                  value={form.healthInsurancePremiums}
                  onChange={(v) => set("healthInsurancePremiums", v)}
                  wikiTip={t("calc.lpp.tip.health_premiums")}
                />
              </div>
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title={t("calc.lpp.savings_card")}>
            <Row>
              <MoneyTile label={t("calc.lpp.total_savings")} value={buybackPlan.totalTaxSavings} tone="success" big tip={t("calc.lpp.tip.total_savings")} />
              <MoneyTile label={t("calc.lpp.yearly_amount")} value={buybackPlan.yearlyAmount} tip={t("calc.lpp.tip.yearly_amount")} />
            </Row>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("calc.lpp.avg_return", { pct: buybackPlan.averageReturn })}
            </p>
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] leading-relaxed text-foreground/90">
              {t("calc.lpp.marginal_effective", {
                rate: buybackPlan.effectiveMarginalRate,
                status: t(`calc.status.${form.status}`),
                canton: tCanton(form.canton),
                income: formatCHF(buybackPlan.baselineTaxableIncome),
              })}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {buybackPlan.yearly.map((y) => (
                <div key={y.year} className="flex items-center justify-between border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
                  <span className="text-muted-foreground">{t("calc.lpp.year_label", { n: y.year })}</span>
                  <div className="flex gap-3 text-right">
                    <span className="tabular-nums font-semibold text-success">{formatCHF(y.taxSavings)}</span>
                    <span className="tabular-nums text-[11px] text-muted-foreground">
                      {t("calc.lpp.net_cost_label")} {formatCHF(y.effectiveCost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <BuybackPlanExplanation
              plan={buybackPlan}
              taxInput={enrichedTaxInput}
              form={form}
              actualBuybackCapped={actualBuybackCapped}
            />
          </CalcCard>
        </div>
      </div>


      <CertificatePensionsCard
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="lpp"
          inputs={form}
          summary={{
            projectedBalance: projection.projectedBalance,
            projectedBalanceNoYield: projection.projectedBalanceNoYield,
            annualPension: projection.annualPension,
            monthlyPension: projection.monthlyPension,
            totalFees: projection.totalFees,
            totalBuybacks: projection.totalBuybacks,
            totalTaxSavings: buybackPlan.totalTaxSavings,
          }}
          defaultTitle={`LPP ${form.currentAge}→${form.retirementAge} ans · ${form.canton}`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Panneau explicatif du plan de rachat LPP
// Transparence : méthode, hypothèses utilisées, avertissements.
// Aucun calcul ici, uniquement de l'affichage explicatif.
// ──────────────────────────────────────────────────────────────────────
function BuybackPlanExplanation({
  plan,
  taxInput,
  form,
  actualBuybackCapped,
}: {
  plan: ReturnType<typeof simulateBuybackPlan>;
  taxInput: IncomeTaxInput;
  form: {
    canton: string;
    status: IncomeTaxInput["status"];
    confession: NonNullable<IncomeTaxInput["confession"]>;
    children: number;
    grossSalary: number;
    spouseGrossSalary: number;
    pillar3aContributions: number;
    healthInsurancePremiums: number;
    actualBuyback: number;
    buybackCapacity: number;
    buybackYears: number;
  };
  actualBuybackCapped: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  // Détection : revenu trop bas pour absorber la déduction.
  const yearlyAmount = plan.yearlyAmount;
  const absorbable = Math.max(0, plan.baselineTaxableIncome);
  const partiallyLost = yearlyAmount > absorbable && yearlyAmount > 0;

  // Détection : écart marginal effectif vs théorique baseline.
  const rateGap = Math.abs(plan.effectiveMarginalRate - plan.baselineMarginalRate);
  const showRateExplanation = rateGap >= 1; // ≥ 1 point d'écart

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          {t("calc.lpp.explain.title")}
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 text-[11px] leading-relaxed text-foreground/90">
          {/* Méthode */}
          <section>
            <div className="mb-1 font-semibold text-foreground">
              {t("calc.lpp.explain.method.title")}
            </div>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>
                {t("calc.lpp.explain.method.yearly", {
                  total: formatCHF(actualBuybackCapped),
                  years: form.buybackYears,
                  yearly: formatCHF(yearlyAmount),
                })}
              </li>
              <li>{t("calc.lpp.explain.method.diff")}</li>
              <li>{t("calc.lpp.explain.method.sum")}</li>
              <li>
                {t("calc.lpp.explain.method.roi", {
                  roi: plan.averageReturn,
                  cents: Math.round(plan.averageReturn),
                })}
              </li>
              <li>
                {t("calc.lpp.explain.method.marginal", {
                  rate: plan.effectiveMarginalRate,
                })}
              </li>
            </ul>
          </section>

          {/* Hypothèses */}
          <section>
            <div className="mb-1 font-semibold text-foreground">
              {t("calc.lpp.explain.assumptions.title")}
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">{t("pension.canton")} :</span>{" "}
                <span className="font-medium">{tCanton(taxInput.canton)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("pension.civil_status")} :</span>{" "}
                <span className="font-medium">{t(`calc.status.${form.status}`)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("calc.lpp.explain.confession")} :</span>{" "}
                <span className="font-medium">{form.confession}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("calc.lpp.field.children")} :</span>{" "}
                <span className="font-medium tabular-nums">{form.children}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("calc.lpp.explain.gross_salary")} :</span>{" "}
                <span className="font-medium tabular-nums">{formatCHF(form.grossSalary)}</span>
              </div>
              {form.status === "married" && (
                <div>
                  <span className="text-muted-foreground">{t("calc.lpp.field.spouse_salary")} :</span>{" "}
                  <span className="font-medium tabular-nums">
                    {formatCHF(form.spouseGrossSalary)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("calc.lpp.field.pillar3a_year")} :</span>{" "}
                <span className="font-medium tabular-nums">
                  {formatCHF(form.pillar3aContributions)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("calc.lpp.field.health_premiums")} :</span>{" "}
                <span className="font-medium tabular-nums">
                  {formatCHF(form.healthInsurancePremiums)}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">{t("calc.lpp.explain.baseline_income")} :</span>{" "}
                <span className="font-medium tabular-nums">
                  {formatCHF(plan.baselineTaxableIncome)}
                </span>{" "}
                <span className="text-[10px] text-muted-foreground">
                  ({t("calc.lpp.explain.baseline_income.hint")})
                </span>
              </div>
            </div>
          </section>

          {/* Avertissements */}
          <section className="space-y-1.5">
            <div className="font-semibold text-foreground">
              {t("calc.lpp.explain.warnings.title")}
            </div>
            <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
              <span>{t("calc.lpp.explain.warn.lockup")}</span>
            </div>
            {partiallyLost && (
              <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <span>
                  {t("calc.lpp.explain.warn.partial_lost", {
                    yearly: formatCHF(yearlyAmount),
                    absorbable: formatCHF(absorbable),
                  })}
                </span>
              </div>
            )}
            {showRateExplanation && (
              <div className="flex items-start gap-2 rounded border border-primary/30 bg-primary/5 p-2">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>
                  {t("calc.lpp.explain.warn.rate_shift", {
                    baseline: plan.baselineMarginalRate,
                    effective: plan.effectiveMarginalRate,
                  })}
                </span>
              </div>
            )}
          </section>
        </div>
      )}
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

function InsuredSalaryPanel({
  grossSalary,
  insuredSalary,
  insuredSalaryCap,
  isManual,
  onGrossChange,
  onCapChange,
  onInsuredChange,
  onRecalcAuto,
}: {
  grossSalary: number;
  insuredSalary: number;
  insuredSalaryCap: number;
  isManual: boolean;
  onGrossChange: (v: number) => void;
  onCapChange: (v: number) => void;
  onInsuredChange: (v: number) => void;
  onRecalcAuto: () => void;
}) {
  const t = useT();
  const COORD = LPP_2026.coordinationDeduction;
  const MIN_COORD = 3_780;
  const ENTRY = LPP_2026.minAnnualSalary;

  const belowEntry = grossSalary > 0 && grossSalary < ENTRY;
  const rawDiff = grossSalary - COORD;
  const capped = rawDiff > insuredSalaryCap;

  let recap: React.ReactNode;
  if (belowEntry) {
    recap = (
      <span className="text-warning">
        {t("calc.lpp.below_entry", { val: fmtCHF(ENTRY) })}
      </span>
    );
  } else if (capped) {
    const cappedResult = Math.max(0, insuredSalaryCap - COORD);
    recap = t("calc.lpp.recap_capped", {
      gross: fmtCHF(grossSalary),
      coord: fmtCHF(COORD),
      raw: fmtCHF(rawDiff),
      cap: fmtCHF(insuredSalaryCap),
      result: fmtCHF(cappedResult),
    });
  } else {
    recap = t("calc.lpp.recap_under", {
      gross: fmtCHF(grossSalary),
      coord: fmtCHF(COORD),
      val: fmtCHF(Math.max(MIN_COORD, rawDiff)),
      cap: fmtCHF(insuredSalaryCap),
    });
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("calc.lpp.insured_panel_title")}
        </div>

        <NumField
          label={t("pension.gross_salary_total")}
          value={grossSalary}
          onChange={onGrossChange}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              {t("calc.lpp.const.coord_2026")}
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent>{t("calc.lpp.const.coord_tip")}</TooltipContent>
              </UiTooltip>
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">{fmtCHF(COORD)}</div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              {t("calc.lpp.const.cap")}
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t("calc.lpp.const.cap_tip")}
                </TooltipContent>
              </UiTooltip>
            </div>
            <BaseNumField
              value={String(insuredSalaryCap)}
              onChange={(v) => onCapChange(Number(v) || 0)}
              className="mt-0.5 h-7 text-sm font-semibold"
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              {t("calc.lpp.const.min_coord")}
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent>{t("calc.lpp.const.min_coord_tip")}</TooltipContent>
              </UiTooltip>
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">{fmtCHF(MIN_COORD)}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("pension.insured_salary")}
            </Label>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  isManual
                    ? "bg-warning/15 text-warning-foreground border border-warning/30"
                    : "bg-primary/15 text-primary border border-primary/30"
                }`}
              >
                {isManual ? <Pencil className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                {isManual ? t("calc.lpp.manual_label") : t("calc.lpp.auto_label")}
              </span>
              {isManual && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={onRecalcAuto}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> {t("calc.lpp.recalc_auto")}
                </Button>
              )}
            </div>
          </div>
          <BaseNumField
            value={String(insuredSalary)}
            onChange={(v) => onInsuredChange(Number(v) || 0)}
            suffix="CHF"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t("calc.lpp.insured_salary_help")}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-foreground/80">{recap}</p>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Rentes LPP du certificat (invalidité / orphelin / veuf-veuve)
// Plafond enfants pris en compte = 3 (réglementaire LPP).
// ─────────────────────────────────────────────────────────────────────────
const MAX_ORPHAN_CHILDREN = 3;

type CertForm = {
  children: number;
  disabilityAmount: number;
  disabilityPeriod: "year" | "month";
  orphanAmount: number;
  orphanPeriod: "year" | "month";
  widowAmount: number;
  widowPeriod: "year" | "month";
};

function CertificatePensionsCard({
  form,
  onChange,
}: {
  form: CertForm;
  onChange: (patch: Partial<CertForm>) => void;
}) {
  const set = <K extends keyof CertForm>(k: K, v: CertForm[K]) =>
    onChange({ [k]: v } as Partial<CertForm>);
  const t = useT();

  const toAnnual = (a: number, p: "year" | "month") => (p === "month" ? a * 12 : a);
  const toMonthly = (a: number, p: "year" | "month") =>
    p === "month" ? a : Math.round(a / 12);

  const disabilityAnnual = toAnnual(form.disabilityAmount, form.disabilityPeriod);
  const disabilityMonthly = toMonthly(form.disabilityAmount, form.disabilityPeriod);

  const orphanCount = Math.min(MAX_ORPHAN_CHILDREN, Math.max(0, form.children));
  const orphanCapped = form.children > MAX_ORPHAN_CHILDREN;
  const orphanPerAnnual = toAnnual(form.orphanAmount, form.orphanPeriod);
  const orphanPerMonthly = toMonthly(form.orphanAmount, form.orphanPeriod);
  const orphanTotalAnnual = orphanPerAnnual * orphanCount;
  const orphanTotalMonthly = orphanPerMonthly * orphanCount;

  const widowAnnual = toAnnual(form.widowAmount, form.widowPeriod);
  const widowMonthly = toMonthly(form.widowAmount, form.widowPeriod);

  return (
    <CalcCard
      title={t("calc.lpp.cert.card_title")}
      description={t("calc.lpp.cert.card_desc")}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CertBlock
          title={t("calc.lpp.cert.disability_title")}
          amount={form.disabilityAmount}
          period={form.disabilityPeriod}
          onAmount={(v) => set("disabilityAmount", v)}
          onPeriod={(p) => set("disabilityPeriod", p)}
          monthly={disabilityMonthly}
          annual={disabilityAnnual}
        />
        <CertBlock
          title={t("calc.lpp.cert.orphan_title")}
          amountLabel={t("calc.lpp.cert.orphan_amount_label")}
          amount={form.orphanAmount}
          period={form.orphanPeriod}
          onAmount={(v) => set("orphanAmount", v)}
          onPeriod={(p) => set("orphanPeriod", p)}
          monthly={orphanPerMonthly}
          annual={orphanPerAnnual}
          extra={
            <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
              <div>
                {t("calc.lpp.cert.orphan_children_used", { n: orphanCount })}
                {orphanCapped && (
                  <span className="ml-1 text-warning">
                    {" "}
                    {t("calc.lpp.cert.orphan_cap_note")}
                  </span>
                )}
              </div>
              <div className="flex justify-between font-medium tabular-nums">
                <span>{t("calc.lpp.cert.orphan_total_month")}</span>
                <span>{formatCHF(orphanTotalMonthly)}</span>
              </div>
              <div className="flex justify-between font-medium tabular-nums">
                <span>{t("calc.lpp.cert.orphan_total_year")}</span>
                <span>{formatCHF(orphanTotalAnnual)}</span>
              </div>
            </div>
          }
        />
        <CertBlock
          title={t("calc.lpp.cert.widow_title")}
          amount={form.widowAmount}
          period={form.widowPeriod}
          onAmount={(v) => set("widowAmount", v)}
          onPeriod={(p) => set("widowPeriod", p)}
          monthly={widowMonthly}
          annual={widowAnnual}
        />
      </div>

      <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("calc.lpp.cert.summary_title")}
        </div>
        <div className="mt-2 space-y-1.5 text-sm">
          <SummaryRow
            label={t("calc.lpp.cert.summary_disability")}
            monthly={disabilityMonthly}
            annual={disabilityAnnual}
          />
          <SummaryRow
            label={t("calc.lpp.cert.summary_orphan", { n: orphanCount })}
            monthly={orphanTotalMonthly}
            annual={orphanTotalAnnual}
          />
          <SummaryRow
            label={t("calc.lpp.cert.summary_widow")}
            monthly={widowMonthly}
            annual={widowAnnual}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t("calc.lpp.cert.summary_note")}
        </p>
      </div>
    </CalcCard>
  );
}

function CertBlock({
  title,
  amountLabel,
  amount,
  period,
  onAmount,
  onPeriod,
  monthly,
  annual,
  extra,
}: {
  title: string;
  amountLabel?: string;
  amount: number;
  period: "year" | "month";
  onAmount: (v: number) => void;
  onPeriod: (p: "year" | "month") => void;
  monthly: number;
  annual: number;
  extra?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <NumField
        label={amountLabel ?? t("calc.lpp.cert.amount_label")}
        value={amount}
        onChange={onAmount}
        suffix="CHF"
      />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("calc.lpp.cert.period_label")}
        </Label>
        <Select value={period} onValueChange={(v) => onPeriod(v as "year" | "month")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">{t("calc.lpp.cert.period_month")}</SelectItem>
            <SelectItem value="year">{t("calc.lpp.cert.period_year")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 rounded-md bg-muted/40 p-2 text-xs">
        <div className="flex justify-between tabular-nums">
          <span className="text-muted-foreground">{t("calc.lpp.cert.computed_month")}</span>
          <span className="font-semibold">{formatCHF(monthly)}</span>
        </div>
        <div className="flex justify-between tabular-nums">
          <span className="text-muted-foreground">{t("calc.lpp.cert.computed_year")}</span>
          <span className="font-semibold">{formatCHF(annual)}</span>
        </div>
      </div>
      {extra}
    </div>
  );
}

function SummaryRow({
  label,
  monthly,
  annual,
}: {
  label: string;
  monthly: number;
  annual: number;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
      <span className="text-foreground">{label}</span>
      <span className="tabular-nums text-foreground/90">
        <span className="font-semibold">{formatCHF(monthly)}</span>
        <span className="text-muted-foreground">
          {" "}
          {t("calc.lpp.cert.per_month_short")} ·{" "}
        </span>
        <span className="font-semibold">{formatCHF(annual)}</span>
        <span className="text-muted-foreground"> {t("calc.lpp.cert.per_year_short")}</span>
      </span>
    </div>
  );
}
