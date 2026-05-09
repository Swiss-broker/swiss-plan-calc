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
import { Switch } from "@/components/ui/switch";
import { Info, CheckCircle2, AlertCircle, Scale } from "lucide-react";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { checkQuasiResident, compareTOUvsSource } from "@/lib/tax/tou";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { exportTouPdf } from "@/lib/pdf/reports";
import { useT } from "@/contexts/LanguageContext";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/tou")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "TOU / quasi-résident · SwissBroker Pro" }] }),
  component: TOUCalc,
});

function TOUCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "tou");
  const [form, setForm] = useState({
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    grossSalary: 90_000,
    spouseGrossSalary: 0,
    bonus: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    healthInsurancePremiums: 0,
    sourceTaxAnnual: 13_500,
    worldwideIncome: 92_000,
    isEUEFTAResident: true,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const eligibility = useMemo(
    () =>
      checkQuasiResident({
        worldwideIncome: form.worldwideIncome,
        swissIncome: form.grossSalary + form.bonus,
        isEUEFTAResident: form.isEUEFTAResident,
      }),
    [form.worldwideIncome, form.grossSalary, form.bonus, form.isEUEFTAResident],
  );

  const comparison = useMemo(() => {
    const taxInput: IncomeTaxInput = {
      canton: form.canton,
      status: form.status,
      children: form.children,
      grossSalary: form.grossSalary,
      spouseGrossSalary: form.spouseGrossSalary,
      bonus: form.bonus,
      pillar3aContributions: form.pillar3aContributions,
      lppBuyback: form.lppBuyback,
      mortgageInterest: form.mortgageInterest,
      realEstateMaintenance: form.realEstateMaintenance,
      healthInsurancePremiums: form.healthInsurancePremiums,
    };
    return compareTOUvsSource({
      sourceTaxAnnual: form.sourceTaxAnnual,
      taxInput,
      eligible: eligibility.eligibleForTOU,
    });
  }, [form, eligibility.eligibleForTOU]);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.tou.guide.s1.title"), body: t("calc.tou.guide.s1.body") },
    { title: t("calc.tou.guide.s2.title"), body: t("calc.tou.guide.s2.body") },
    { title: t("calc.tou.guide.s3.title"), body: t("calc.tou.guide.s3.body") },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.tou.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <div className="md:col-span-5"><ClientLinkBanner client={client} /></div>}
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title={t("calc.tou.eligibility.title")}
          description={t("calc.tou.eligibility.desc")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label={t("calc.tou.field.world_income")}
              value={form.worldwideIncome}
              onChange={(v) => set("worldwideIncome", v)}
              wikiId="frontaliers"
              wikiTip={t("calc.tou.tip.world_income")}
            />
            <Field label={t("calc.tou.field.eu_efta")}>
              <div className="flex h-10 items-center gap-3 rounded-md border border-input bg-muted/40 px-3">
                <Switch
                  checked={form.isEUEFTAResident}
                  onCheckedChange={(c) => set("isEUEFTAResident", c)}
                />
                <span className="text-sm">{form.isEUEFTAResident ? t("common.yes") : t("common.no")}</span>
              </div>
            </Field>
          </div>
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              eligibility.eligibleForTOU
                ? "border-success/30 bg-success/5 text-success"
                : "border-warning/30 bg-warning/5 text-warning"
            }`}
          >
            {eligibility.eligibleForTOU ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <div>
              <div className="font-semibold">
                {t("calc.tou.share_label", { share: eligibility.swissShare })}
              </div>
              <div className="mt-0.5 opacity-90">{eligibility.recommendation}</div>
            </div>
          </div>
        </CalcCard>

        <CalcCard
          title={t("calc.tou.section.fiscal")}
          description={t("calc.tou.section.fiscal.desc")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("calc.tou.field.canton")}>
              <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
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
            <Field label={t("calc.tou.field.civil_status")}>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as IncomeTaxInput["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t("calc.status.single")}</SelectItem>
                  <SelectItem value="married">{t("calc.status.married")}</SelectItem>
                  <SelectItem value="single_with_children">{t("calc.status.single_with_children")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField label={t("calc.tou.field.children")} value={form.children} onChange={(v) => set("children", v)} />
            <NumField label={t("calc.tou.field.salary")} value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
            <NumField label={t("calc.tou.field.bonus")} value={form.bonus} onChange={(v) => set("bonus", v)} />
            <NumField label={t("calc.tou.field.source_tax")} value={form.sourceTaxAnnual} onChange={(v) => set("sourceTaxAnnual", v)} wikiId="frontaliers" wikiTip={t("calc.tou.tip.source_tax")} />
            <NumField label={t("calc.tou.field.p3a")} value={form.pillar3aContributions} onChange={(v) => set("pillar3aContributions", v)} wikiId="p3a-base" wikiTip={t("calc.tou.tip.p3a")} />
            <NumField label={t("calc.tou.field.lpp_buyback")} value={form.lppBuyback} onChange={(v) => set("lppBuyback", v)} wikiId="lpp-rachat" wikiTip={t("calc.tou.tip.lpp_buyback")} />
            <NumField label={t("calc.tou.field.mortgage")} value={form.mortgageInterest} onChange={(v) => set("mortgageInterest", v)} wikiId="valeur-locative" wikiTip={t("calc.tou.tip.mortgage")} />
            <NumField label={t("calc.tou.field.maintenance")} value={form.realEstateMaintenance} onChange={(v) => set("realEstateMaintenance", v)} wikiId="valeur-locative" wikiTip={t("calc.tou.tip.maintenance")} />
            <NumField label={t("calc.tou.field.health")} value={form.healthInsurancePremiums} onChange={(v) => set("healthInsurancePremiums", v)} wikiId="ifd-icc" wikiTip={t("calc.tou.tip.health")} />
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="flex justify-end">
          <ExportPdfButton
            onClick={() =>
              exportTouPdf({
                input: form,
                eligibility,
                comparison,
              })
            }
          />
        </div>
        <CalcCard title={t("calc.tou.compare.title")}>
          <Row>
            <MoneyTile label={t("calc.tou.compare.is")} value={comparison.sourceTax} hint={`${comparison.effectiveRateIS}%`} />
            <MoneyTile label={t("calc.tou.compare.tou")} value={comparison.ordinaryTax} hint={`${comparison.effectiveRateTOU}%`} />
          </Row>
          <div className="mt-4">
            <MoneyTile
              label={comparison.delta < 0 ? t("calc.tou.compare.savings") : t("calc.tou.compare.extra_cost")}
              value={Math.abs(comparison.delta)}
              tone={comparison.delta < 0 ? "success" : "warning"}
              big
            />
          </div>
          <div className="mt-3">
            <PctTile label={t("calc.tou.compare.marginal")} value={comparison.marginalRate} tone="primary" tip={t("calc.tou.compare.marginal.tip")} />
          </div>
        </CalcCard>

        <CalcCard>
          <div className="flex items-start gap-2 text-sm">
            <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              <div className="font-semibold">{comparison.recommendationText}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                {comparison.potentialDeductionsImpact}
              </p>
            </div>
          </div>
        </CalcCard>

        <CalcCard title={t("calc.tou.reminders")}>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {eligibility.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CalcCard>
      </div>
    </div>
  );
}

function Field({ label, children, wikiId, wikiTip }: { label: string; children: React.ReactNode; wikiId?: string; wikiTip?: React.ReactNode }) {
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

function NumField({ label, value, onChange, suffix, wikiId, wikiTip }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; wikiId?: string; wikiTip?: React.ReactNode }) {
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
