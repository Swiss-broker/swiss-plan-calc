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
import { Globe, Info, ArrowRightLeft } from "lucide-react";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { formatCHF } from "@/lib/format";
import {
  computeCrossBorder,
  isFrAccordCanton,
  FR_ACCORD_CANTONS,
} from "@/lib/tax/cross-border";
import { CANTON_BY_CODE } from "@/lib/swiss/cantons";
import { exportCrossBorderPdf } from "@/lib/pdf/reports";
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

export const Route = createFileRoute("/_app/calculators/cross-border")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Frontaliers FR · SwissBroker Pro" }] }),
  component: CrossBorderCalc,
});

const ELIGIBLE_CANTONS = [...FR_ACCORD_CANTONS, "GE"] as const;

function CrossBorderCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "cross-border");
  const [form, setForm] = useState({
    workCanton: "VD" as string,
    grossAnnualSalary: 95_000,
    status: "single" as "single" | "married",
    children: 0,
    spouseEmployed: false,
    spouseGrossSalary: 0,
    eurChfRate: 0.95,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeCrossBorder(form), [form]);

  const regimeBadge = isFrAccordCanton(form.workCanton)
    ? t("calc.cross_border.regime.fr_accord")
    : form.workCanton === "GE"
      ? t("calc.cross_border.regime.ge")
      : t("calc.cross_border.regime.none");
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.cross_border.guide.s1.title"), body: t("calc.cross_border.guide.s1.body") },
    { title: t("calc.cross_border.guide.s2.title"), body: t("calc.cross_border.guide.s2.body") },
    { title: t("calc.cross_border.guide.s3.title"), body: t("calc.cross_border.guide.s3.body") },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.cross_border.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <div className="md:col-span-5"><ClientLinkBanner client={client} /></div>}
      <div className="md:col-span-3">
        <CalcCard
          title={t("calc.cross_border.section.title")}
          description={t("calc.cross_border.section.desc")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("calc.cross_border.field.work_canton")}>
              <Select value={form.workCanton} onValueChange={(v) => set("workCanton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELIGIBLE_CANTONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} · {CANTON_BY_CODE[c]?.name ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("calc.cross_border.field.regime")} wikiId="frontaliers" wikiTip={t("calc.cross_border.tip.regime")}>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                <Globe className="mr-2 h-4 w-4 text-primary" />
                {regimeBadge}
              </div>
            </Field>
            <NumField
              label={t("calc.cross_border.field.gross")}
              value={form.grossAnnualSalary}
              onChange={(v) => set("grossAnnualSalary", v)}
            />
            <Field label={t("calc.cross_border.field.civil_status")}>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as "single" | "married")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t("calc.cross_border.status.single")}</SelectItem>
                  <SelectItem value="married">{t("calc.cross_border.status.married")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label={t("calc.cross_border.field.children")}
              value={form.children}
              onChange={(v) => set("children", v)}
            />
            {form.status === "married" && (
              <NumField
                label={t("calc.cross_border.field.spouse_salary")}
                value={form.spouseGrossSalary}
                onChange={(v) => set("spouseGrossSalary", v)}
              />
            )}
            <NumField
              label={t("calc.cross_border.field.eur_chf")}
              value={form.eurChfRate}
              onChange={(v) => set("eurChfRate", v)}
              step={0.01}
            />
          </div>
        </CalcCard>

        <div className="mt-4">
          <CalcCard title={t("calc.cross_border.notes.title")}>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {result.notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </CalcCard>
        </div>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="flex justify-end gap-2">
          <SaveSimulationButton
            kind="cross_border"
            inputs={form}
            summary={{
              regime: result.regime,
              regimeLabel: result.regimeLabel,
              totalTax: result.totalTax,
              netAnnual: result.netAnnual,
              totalRate: result.totalRate,
              swissTax: result.swissTax,
              foreignTax: result.foreignTax,
              alternativeDelta: result.alternative?.delta ?? 0,
            }}
            defaultTitle={`Frontalier ${form.workCanton} · ${form.grossAnnualSalary} CHF`}
          />
          <ExportPdfButton
            onClick={() => exportCrossBorderPdf({ input: form, result })}
          />
        </div>
        <CalcCard title={result.regimeLabel}>
          <Row>
            <MoneyTile label={t("calc.cross_border.tile.net")} value={result.netAnnual} tone="success" big tip={t("calc.cross_border.tile.net.tip")} />
            <PctTile label={t("calc.cross_border.tile.total_rate")} value={result.totalRate} tone="primary" tip={t("calc.cross_border.tile.total_rate.tip")} />
          </Row>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyTile label={t("calc.cross_border.tile.swiss_tax")} value={result.swissTax} hint={`${result.swissRate}%`} />
            <MoneyTile
              label={t("calc.cross_border.tile.foreign_tax")}
              value={result.foreignTax}
              hint={`${result.foreignRate}%`}
            />
          </div>
        </CalcCard>

        {result.alternative && (
          <CalcCard title={t("calc.cross_border.alt.title")}>
            <div className="flex items-start gap-2 text-sm">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">{result.alternative.label}</div>
                <div className="mt-1 text-muted-foreground">
                  {t("calc.cross_border.alt.line", {
                    total: formatCHF(result.alternative.totalTax),
                    net: formatCHF(result.alternative.netAnnual),
                  })}
                </div>
                <div
                  className={`mt-2 text-xs font-semibold ${
                    result.alternative.delta > 0
                      ? "text-success"
                      : "text-destructive"
                  }`}
                >
                  {result.alternative.delta > 0
                    ? t("calc.cross_border.alt.gain", { amount: formatCHF(result.alternative.delta) })
                    : t("calc.cross_border.alt.cost", { amount: formatCHF(Math.abs(result.alternative.delta)) })}
                </div>
              </div>
            </div>
          </CalcCard>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, wikiId, wikiTip }: { label: string; children: React.ReactNode; wikiId?: string; wikiTip?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId ? <WikiTip articleId={wikiId} tip={wikiTip ?? label} /> : null}
      </Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step: _step,
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
    <Field label={label} wikiId={wikiId} wikiTip={wikiTip}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </Field>
  );
}
