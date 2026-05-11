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
import { useT } from "@/contexts/LanguageContext";

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
  const { client, prefill } = usePrefillFromClient(clientId, "lpp");
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
    buybackCapacity: 60_000,
    actualBuyback: 60_000,
    buybackYears: 3,
    // Mode rétroactif (uniquement quand currentBalance = 0)
    retroactiveMode: false,
    entryAge: 25,
    // Enrichissement fiscal pour le plan de rachat
    spouseGrossSalary: 0,
    pillar3aContributions: 0,
    healthInsurancePremiums: 0,
    confession: "none" as NonNullable<IncomeTaxInput["confession"]>,
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
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.lpp.guide_title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}
      <FiscalSnapshotBanner clientId={clientId} />
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

            {/* Mode rétroactif — visible uniquement si avoir LPP courant = 0 */}
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
              <NumField label={t("calc.lpp.field.children")} value={form.children} onChange={(v) => set("children", v)} wikiTip={t("calc.lpp.tip.children")} />
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
                  <span className="tabular-nums text-success-foreground">{formatCHF(y.taxSavings)}</span>
                </div>
              ))}
            </div>
          </CalcCard>
        </div>
      </div>

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
    recap = t("calc.lpp.recap_capped", {
      gross: fmtCHF(grossSalary),
      coord: fmtCHF(COORD),
      raw: fmtCHF(rawDiff),
      cap: fmtCHF(insuredSalaryCap),
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
