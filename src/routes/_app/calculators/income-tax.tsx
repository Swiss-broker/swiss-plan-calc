import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import { runOptimizer } from "@/lib/optimizer";
import { OptimizationsPanel } from "@/components/optimizer/OptimizationsPanel";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportIncomeTaxPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { useT } from "@/contexts/LanguageContext";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { getClientTaxContext } from "@/lib/clients/to-calculator-input";
import { TAX_STATUS_LABELS, type TaxStatus } from "@/lib/swiss/enums";
import { computeSourceTax, inferSourceScale } from "@/lib/tax/source";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/income-tax")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Impôt revenu & fortune · SwissBroker Pro" }] }),
  component: IncomeTaxCalculator,
});

function IncomeTaxCalculator() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "income-tax");

  const [form, setForm] = useState({
    canton: "VD",
    taxStatus: "resident" as TaxStatus,
    status: "single" as IncomeTaxInput["status"],
    confession: "none" as NonNullable<IncomeTaxInput["confession"]>,
    children: 0,
    age: 40,
    lppPlan: "mandatory" as NonNullable<IncomeTaxInput["lppPlan"]>,
    grossSalary: 100_000,
    spouseGrossSalary: 0,
    bonus: 0,
    otherIncome: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    healthInsurancePremiums: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    netWealth: 0,
    lppBuybackCapacity: 0,
    pillar3aBalance: 0,
  });

  useHydrateFormFromPrefill(prefill, setForm);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { user } = useAuth();
  const brokerHeader = useBrokerPdfHeader();
  const result = useMemo(() => computeIncomeTax(form), [form]);
  const optimizations = useMemo(
    () =>
      runOptimizer({
        taxInput: form,
        lppBuybackCapacity: form.lppBuybackCapacity,
        pillar3aCurrent: form.pillar3aContributions,
        pillar3aBalance: form.pillar3aBalance,
        hasLPP: true,
        ...(client ? getClientTaxContext(client) : {}),
      }),
    [form, client],
  );

  const handleExport = () =>
    exportIncomeTaxPdf({
      header: brokerHeader,
      input: form,
      result,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.income_tax.guide.s1.title"), body: t("calc.income_tax.guide.s1.body") },
    { title: t("calc.income_tax.guide.s2.title"), body: t("calc.income_tax.guide.s2.body") },
    { title: t("calc.income_tax.guide.s3.title"), body: t("calc.income_tax.guide.s3.body") },
  ];

  // Mode d'imposition : ordinaire (résident + TOU) ou source / frontalier.
  const isOrdinary = form.taxStatus === "resident" || form.taxStatus === "tou";
  const isFrCrossBorder = form.taxStatus === "cross_border_fr_1983";
  const isSourceLike =
    form.taxStatus === "source_taxed" ||
    form.taxStatus === "cross_border_ge";

  const monthlyGross = form.grossSalary / 12;
  const sourceTax = useMemo(
    () =>
      isSourceLike
        ? computeSourceTax({
            monthlyGross,
            canton: form.canton,
            scale: inferSourceScale(form.status, (form.spouseGrossSalary ?? 0) > 0),
            children: form.children,
            church: form.confession === "catholic" || form.confession === "protestant",
          })
        : null,
    [isSourceLike, monthlyGross, form.canton, form.status, form.spouseGrossSalary, form.children, form.confession],
  );
  const frCrossBorderRetention = isFrCrossBorder ? Math.round(form.grossSalary * 0.045) : 0;

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.income_tax.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <CalcCard title={t("calc.income_tax.section.situation")} description={t("calc.income_tax.section.situation.desc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("calc.income_tax.field.canton")} wikiId="ifd-icc" wikiTip={t("calc.income_tax.tip.canton")}>
              <Select value={form.canton} onValueChange={(v) => setField("canton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getSelectableCantons().map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={t("calc.income_tax.field.tax_status")}
              wikiId="ifd-icc"
              wikiTip={t("calc.income_tax.tip.tax_status")}
            >
              <Select
                value={form.taxStatus}
                onValueChange={(v) => setField("taxStatus", v as TaxStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAX_STATUS_LABELS) as TaxStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{TAX_STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("calc.income_tax.field.civil_status")} wikiId="ifd-icc" wikiTip={t("calc.income_tax.tip.civil_status")}>
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as IncomeTaxInput["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t("calc.status.single")}</SelectItem>
                  <SelectItem value="married">{t("calc.status.married")}</SelectItem>
                  <SelectItem value="single_with_children">{t("calc.status.single_with_children")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("calc.income_tax.field.confession")} wikiId="ifd-icc" wikiTip={t("calc.income_tax.tip.confession")}>
              <Select
                value={form.confession}
                onValueChange={(v) =>
                  setField("confession", v as NonNullable<IncomeTaxInput["confession"]>)
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("calc.confession.none")}</SelectItem>
                  <SelectItem value="catholic">{t("calc.confession.catholic")}</SelectItem>
                  <SelectItem value="protestant">{t("calc.confession.protestant")}</SelectItem>
                  <SelectItem value="other">{t("calc.confession.other")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField label={t("calc.income_tax.field.children")} value={form.children} onChange={(v) => setField("children", v)} />
            <NumField label={t("calc.income_tax.field.age")} value={form.age} onChange={(v) => setField("age", v)} wikiId="lpp-credits" wikiTip={t("calc.income_tax.tip.age")} />
            <Field label={t("calc.income_tax.field.lpp_plan")} wikiId="lpp-base" wikiTip={t("calc.income_tax.tip.lpp_plan")}>
              <Select value={form.lppPlan} onValueChange={(v) => setField("lppPlan", v as typeof form.lppPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory">{t("calc.lpp_plan.mandatory")}</SelectItem>
                  <SelectItem value="cadres">{t("calc.lpp_plan.cadres")}</SelectItem>
                  <SelectItem value="1e">{t("calc.lpp_plan.1e")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label={t("calc.income_tax.field.health_premiums")}
              value={form.healthInsurancePremiums}
              onChange={(v) => setField("healthInsurancePremiums", v)}
              wikiId="ifd-icc"
              wikiTip={t("calc.income_tax.tip.health_premiums")}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField label={t("calc.income_tax.field.gross_salary")} value={form.grossSalary} onChange={(v) => setField("grossSalary", v)} />
            {form.status === "married" && (
              <NumField
                label={t("calc.income_tax.field.spouse_salary")}
                value={form.spouseGrossSalary}
                onChange={(v) => setField("spouseGrossSalary", v)}
              />
            )}
            <NumField label={t("calc.income_tax.field.bonus")} value={form.bonus} onChange={(v) => setField("bonus", v)} />
            <NumField
              label={t("calc.income_tax.field.other_income")}
              value={form.otherIncome}
              onChange={(v) => setField("otherIncome", v)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label={t("calc.income_tax.field.p3a")}
              value={form.pillar3aContributions}
              onChange={(v) => setField("pillar3aContributions", v)}
              wikiId="p3a-base"
              wikiTip={t("calc.income_tax.tip.p3a")}
            />
            <NumField
              label={t("calc.income_tax.field.lpp_buyback")}
              value={form.lppBuyback}
              onChange={(v) => setField("lppBuyback", v)}
              wikiId="lpp-rachat"
              wikiTip={t("calc.income_tax.tip.lpp_buyback")}
            />
            <NumField
              label={t("calc.income_tax.field.mortgage")}
              value={form.mortgageInterest}
              onChange={(v) => setField("mortgageInterest", v)}
              wikiId="valeur-locative"
              wikiTip={t("calc.income_tax.tip.mortgage")}
            />
            <NumField
              label={t("calc.income_tax.field.maintenance")}
              value={form.realEstateMaintenance}
              onChange={(v) => setField("realEstateMaintenance", v)}
              wikiId="valeur-locative"
              wikiTip={t("calc.income_tax.tip.maintenance")}
            />
            <NumField
              label={t("calc.income_tax.field.wealth")}
              value={form.netWealth}
              onChange={(v) => setField("netWealth", v)}
              wikiId="fortune"
              wikiTip={t("calc.income_tax.tip.wealth")}
            />
            <NumField
              label={t("calc.income_tax.field.lpp_buyback_capacity")}
              value={form.lppBuybackCapacity}
              onChange={(v) => setField("lppBuybackCapacity", v)}
              wikiId="lpp-rachat"
              wikiTip={t("calc.income_tax.tip.lpp_buyback_capacity")}
            />
            <NumField
              label={t("calc.income_tax.field.p3a_balance")}
              value={form.pillar3aBalance}
              onChange={(v) => setField("pillar3aBalance", v)}
              wikiId="p3a-base"
              wikiTip={t("calc.income_tax.tip.p3a_balance")}
            />
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 lg:col-span-5">
        {isFrCrossBorder && (
          <CalcCard title={t("calc.income_tax.fr_cb.title")} description={t("calc.income_tax.fr_cb.desc")}>
            <dl className="space-y-2 text-sm">
              <Line label={t("calc.income_tax.fr_cb.gross")} value={formatCHF(form.grossSalary)} />
              <Line label={t("calc.income_tax.fr_cb.retention")} value={formatCHF(-frCrossBorderRetention)} />
              <div className="my-2 border-t border-border" />
              <Line label={t("calc.income_tax.fr_cb.fr_main")} value="—" bold />
            </dl>
            <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              {t("calc.income_tax.fr_cb.note")}
            </p>
          </CalcCard>
        )}

        {isSourceLike && sourceTax && (
          <CalcCard
            title={
              form.taxStatus === "cross_border_ge"
                ? t("calc.income_tax.source.title_ge")
                : t("calc.income_tax.source.title")
            }
            description={t("calc.income_tax.source.desc", { canton: form.canton })}
          >
            <Row>
              <MoneyTile label={t("calc.income_tax.source.annual")} value={sourceTax.annualTax} tone="primary" big />
              <PctTile label={t("calc.income_tax.source.rate")} value={sourceTax.rate} tone="primary" />
            </Row>
            <dl className="mt-3 space-y-2 text-sm">
              <Line label={t("calc.income_tax.source.gross_year")} value={formatCHF(form.grossSalary)} />
              <Line label={t("calc.income_tax.source.gross_month")} value={formatCHF(monthlyGross)} />
              <Line label={t("calc.income_tax.source.tax_month")} value={formatCHF(sourceTax.monthlyTax)} />
            </dl>
            <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              {t("calc.income_tax.source.note")}
            </p>
          </CalcCard>
        )}

        {isOrdinary && (
          <>
            <CalcCard title={t("calc.income_tax.result.title")} description={t("calc.income_tax.result.desc")}>
              <Row>
                <MoneyTile label={t("calc.income_tax.tile.total")} value={result.totalTax} tone="primary" big tip={t("calc.income_tax.tip.total")} />
                <PctTile label={t("calc.income_tax.tile.effective")} value={result.effectiveRate} tone="primary" tip={t("calc.income_tax.tip.effective")} />
              </Row>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MoneyTile label={t("calc.income_tax.tile.ifd")} value={result.ifd} tip={t("calc.income_tax.tip.ifd")} />
                <MoneyTile label={t("calc.income_tax.tile.cantonal")} value={result.cantonal} tip={t("calc.income_tax.tip.cantonal")} />
                <MoneyTile label={t("calc.income_tax.tile.communal")} value={result.communal} tip={t("calc.income_tax.tip.communal")} />
                <MoneyTile label={t("calc.income_tax.tile.church")} value={result.church} tip={t("calc.income_tax.tip.church")} />
                <MoneyTile label={t("calc.income_tax.tile.wealth")} value={result.wealthTax} tip={t("calc.income_tax.tip.wealth_tile")} />
                <PctTile label={t("calc.income_tax.tile.marginal")} value={result.marginalRate} tone="warning" tip={t("calc.income_tax.tip.marginal")} />
              </div>
              {form.taxStatus === "tou" && (
                <p className="mt-3 rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
                  {t("calc.income_tax.tou.note")}
                </p>
              )}
            </CalcCard>

            <CalcCard title={t("calc.income_tax.detail.title")}>
              <dl className="space-y-2 text-sm">
                <Line label={t("calc.income_tax.detail.gross")} value={formatCHF(result.grossIncome)} />
                <Line label={t("calc.income_tax.detail.avs")} value={formatCHF(-result.deductions.avs)} />
                <Line label={t("calc.income_tax.detail.ac")} value={formatCHF(-result.deductions.ac)} />
                <Line label={t("calc.income_tax.detail.lpp")} value={formatCHF(-result.deductions.lpp)} />
                <Line label={t("calc.income_tax.detail.p3a")} value={formatCHF(-result.deductions.pillar3a)} />
                <Line label={t("calc.income_tax.detail.lpp_buyback")} value={formatCHF(-result.deductions.lppBuyback)} />
                <Line label={t("calc.income_tax.detail.professional")} value={formatCHF(-result.deductions.professional)} />
                <Line label={t("calc.income_tax.detail.health")} value={formatCHF(-result.deductions.healthInsurance)} />
                <Line label={t("calc.income_tax.detail.mortgage")} value={formatCHF(-(result.deductions.mortgage + result.deductions.realEstate))} />
                <div className="my-2 border-t border-border" />
                <Line label={t("calc.income_tax.detail.taxable")} value={formatCHF(result.taxableIncomeCC)} bold />
              </dl>
            </CalcCard>
          </>
        )}
      </div>
      </div>

      <OptimizationsPanel optimizations={optimizations} />

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="income_tax"
          inputs={form}
          summary={{
            totalTax: result.totalTax,
            effectiveRate: result.effectiveRate,
            marginalRate: result.marginalRate,
            taxableIncomeCC: result.taxableIncomeCC,
            ifd: result.ifd,
            cantonal: result.cantonal,
            communal: result.communal,
          }}
          defaultTitle={`Impôt ${form.canton} · ${formatCHF(form.grossSalary)}`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wikiId,
  wikiTip,
}: {
  label: string;
  children: React.ReactNode;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <Field label={label} wikiId={wikiId} wikiTip={wikiTip}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </Field>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
