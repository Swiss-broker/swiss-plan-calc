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
import { getSelectableCantons, CROSS_BORDER_FR_CANTONS } from "@/lib/swiss/cantons";
import { computeSourceTax, type SourceScale } from "@/lib/tax/source";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { Info } from "lucide-react";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportSourceTaxPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
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

export const Route = createFileRoute("/_app/calculators/source-tax")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Impôt à la source · SwissBroker Pro" }] }),
  component: SourceTaxCalc,
});

function SourceTaxCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "source-tax");
  const [form, setForm] = useState({
    canton: "GE",
    scale: "A" as SourceScale,
    monthlyGross: 8_000,
    spouseMonthlyGross: 0,
    children: 0,
    church: false,
    isCrossBorderFR: false,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { user } = useAuth();
  const brokerHeader = useBrokerPdfHeader();
  const crossBorderEligible = CROSS_BORDER_FR_CANTONS.includes(form.canton);
  const result = useMemo(() => computeSourceTax(form), [form]);
  const handleExport = () =>
    exportSourceTaxPdf({
      header: brokerHeader,
      input: form,
      result,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.source_tax.guide.s1.title"), body: t("calc.source_tax.guide.s1.body") },
    { title: t("calc.source_tax.guide.s2.title"), body: t("calc.source_tax.guide.s2.body") },
    { title: t("calc.source_tax.guide.s3.title"), body: t("calc.source_tax.guide.s3.body") },
  ];

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.source_tax.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <CalcCard
          title={t("calc.source_tax.section.title")}
          description={t("calc.source_tax.section.desc")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("calc.source_tax.field.work_canton")}</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span>{t("calc.source_tax.field.scale")}</span>
                <WikiTip articleId="frontaliers" tip={t("calc.source_tax.tip.scale")} />
              </Label>
              <Select value={form.scale} onValueChange={(v) => set("scale", v as SourceScale)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{t("calc.source_tax.scale.A")}</SelectItem>
                  <SelectItem value="B">{t("calc.source_tax.scale.B")}</SelectItem>
                  <SelectItem value="C">{t("calc.source_tax.scale.C")}</SelectItem>
                  <SelectItem value="H">{t("calc.source_tax.scale.H")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("calc.source_tax.field.monthly_gross")}</Label>
              <BaseNumField
                value={String(form.monthlyGross)}
                onChange={(v) => set("monthlyGross", Number(v) || 0)}
                suffix="CHF"
              />
            </div>
            {form.scale === "C" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>Salaire mensuel brut conjoint</span>
                  <WikiTip articleId="frontaliers" tip="Le barème C détermine le taux sur le revenu mensuel COMBINÉ du ménage, puis l'applique au salaire propre du contribuable. Saisissez le brut mensuel du conjoint." />
                </Label>
                <BaseNumField
                  value={String(form.spouseMonthlyGross)}
                  onChange={(v) => set("spouseMonthlyGross", Number(v) || 0)}
                  suffix="CHF"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("calc.source_tax.field.children")}</Label>
              <BaseNumField
                value={String(form.children)}
                onChange={(v) => set("children", Number(v) || 0)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.church}
                onCheckedChange={(v) => set("church", Boolean(v))}
              />
              {t("calc.source_tax.church")}
            </label>
            {crossBorderEligible && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.isCrossBorderFR}
                  onCheckedChange={(v) => set("isCrossBorderFR", Boolean(v))}
                />
                <span>{t("calc.source_tax.crossborder.label")}</span>
                <WikiTip articleId="frontaliers" tip={t("calc.source_tax.crossborder.tip")} />
              </label>
            )}
          </div>
          {form.isCrossBorderFR && (
            <div className="mt-4 flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{t("calc.source_tax.crossborder.note")}</p>
            </div>
          )}
        </CalcCard>
      </div>

      <div className="space-y-4 lg:col-span-5">
        <CalcCard title={t("calc.source_tax.result.title", { scale: result.scaleUsed })}>
          <Row>
            <PctTile label={t("calc.source_tax.result.rate")} value={result.rate} tone="primary" tip={t("calc.source_tax.result.rate.tip")} />
            <MoneyTile label={t("calc.source_tax.result.monthly")} value={result.monthlyTax} tone="primary" big tip={t("calc.source_tax.result.monthly.tip")} />
          </Row>
          <div className="mt-3">
            <MoneyTile label={t("calc.source_tax.result.annual")} value={result.annualTax} tone="default" tip={t("calc.source_tax.result.annual.tip")} />
          </div>
          {form.scale === "C" && (
            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-2 text-[11px] text-foreground">
              Barème <strong>{result.scaleUsed}</strong> — taux déterminé sur le revenu mensuel combiné du ménage : <strong>{result.combinedMonthly.toLocaleString("fr-CH")} CHF</strong>, appliqué au salaire propre.
            </div>
          )}
          <div className="mt-3 flex gap-2 rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{t("calc.source_tax.tip.linear_approximation")}</p>
          </div>
          {form.isCrossBorderFR && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] text-foreground">
              {t("calc.source_tax.crossborder.detailed_note")}
            </div>
          )}
          {result.crossBorderNote && (
            <p className="mt-3 text-xs text-muted-foreground">{result.crossBorderNote}</p>
          )}
        </CalcCard>
        <div className="flex flex-wrap justify-end gap-2">
          <SaveSimulationButton
            kind="source_tax"
            inputs={form}
            summary={{
              rate: result.rate,
              monthlyTax: result.monthlyTax,
              annualTax: result.annualTax,
            }}
            defaultTitle={`Source ${form.canton} ${form.scale} · ${form.monthlyGross}/mois`}
          />
          <ExportPdfButton onClick={handleExport} />
        </div>
      </div>
      </div>
    </div>
  );
}
