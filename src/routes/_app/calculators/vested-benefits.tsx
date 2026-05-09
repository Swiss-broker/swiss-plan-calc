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
import { Sparkles, ShieldCheck, TrendingUp, Activity } from "lucide-react";
import {
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { getWithdrawalCantons } from "@/lib/swiss/cantons";
import {
  compareVestedStrategies,
  recommendVestedStrategy,
  VESTED_STRATEGIES,
  type VestedStrategy,
} from "@/lib/lpp/vested";
import { formatCHF } from "@/lib/format";
import { exportVestedBenefitsPdf } from "@/lib/pdf/reports";

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { useT } from "@/contexts/LanguageContext";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/vested-benefits")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Libre passage · SwissBroker Pro" }] }),
  component: VestedBenefitsCalc,
});

const STRATEGY_ICONS: Record<VestedStrategy, React.ElementType> = {
  security: ShieldCheck,
  balanced: Activity,
  dynamic: TrendingUp,
};

function VestedBenefitsCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "vested-benefits");
  const [form, setForm] = useState({
    initialBalance: 150_000,
    yearsToRetirement: 20,
    withdrawalCanton: "VD",
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const projections = useMemo(
    () => compareVestedStrategies(form.initialBalance, form.yearsToRetirement, form.withdrawalCanton),
    [form],
  );

  const recommended = recommendVestedStrategy(form.yearsToRetirement);

  const strategyLabel = (id: VestedStrategy) => {
    const map: Record<VestedStrategy, string> = {
      security: t("calc.vested.strategy.security"),
      balanced: t("calc.vested.strategy.balanced"),
      dynamic: t("calc.vested.strategy.dynamic"),
    };
    return map[id];
  };

  const strategyDesc = (id: VestedStrategy) => {
    const map: Record<VestedStrategy, string> = {
      security: t("calc.vested.strategy.security_desc"),
      balanced: t("calc.vested.strategy.balanced_desc"),
      dynamic: t("calc.vested.strategy.dynamic_desc"),
    };
    return map[id];
  };

  const chartData = useMemo(() => {
    const len = projections[0]?.yearByYear.length ?? 0;
    const rows: Array<Record<string, number>> = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { year: i };
      projections.forEach((p) => {
        row[p.strategy.id] = p.yearByYear[i].balance;
      });
      rows.push(row);
    }
    return rows;
  }, [projections]);

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.vested.step.welcome.t"), body: t("calc.vested.step.welcome.b") },
    { title: t("calc.vested.step.capital.t"), body: t("calc.vested.step.capital.b") },
    { title: t("calc.vested.step.split.t"), body: t("calc.vested.step.split.b") },
  ];

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.vested.guide_title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      {client && <div className="md:col-span-5"><ClientLinkBanner client={client} /></div>}
      <div className="md:col-span-2">
        <CalcCard title={t("calc.vested.params_card")} description={t("calc.vested.params_desc")}>
          <div className="space-y-4">
            <Field label={t("calc.vested.field.initial")} wikiId="lpp-conversion" wikiTip={t("calc.vested.tip.initial")}>
              <BaseNumField
                value={String(form.initialBalance)}
                onChange={(v) => set("initialBalance", Number(v) || 0)}
                suffix="CHF"
              />
            </Field>
            <Field label={t("calc.vested.field.years")} wikiId="lpp-conversion" wikiTip={t("calc.vested.tip.years")}>
              <BaseNumField
                value={String(form.yearsToRetirement)}
                onChange={(v) => set("yearsToRetirement", Number(v) || 0)}
              />
            </Field>
            <Field label={t("calc.vested.field.canton")} wikiId="lpp-conversion" wikiTip={t("calc.vested.tip.canton")}>
              <Select value={form.withdrawalCanton} onValueChange={(v) => set("withdrawalCanton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getWithdrawalCantons().map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("calc.vested.recommendation")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("calc.vested.recommendation_body", {
                years: form.yearsToRetirement,
                strategy: strategyLabel(recommended),
              })}
            </p>
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-3">
        <div className="flex justify-end">
          <ExportPdfButton
            onClick={() =>
              exportVestedBenefitsPdf({
                input: form,
                projections,
                recommended,
              })
            }
          />
        </div>
        <CalcCard title={t("calc.vested.projection_card")}>
          <div className="h-72 chart-rise">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="year" tickFormatter={(v) => t("calc.vested.year_axis", { n: v })} className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip
                  formatter={(v: number) => formatCHF(v)}
                  labelFormatter={(l) => t("calc.vested.year_label", { n: l })}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="security" name={t("calc.vested.strategy.security")} stroke="var(--muted-foreground)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="balanced" name={t("calc.vested.strategy.balanced")} stroke="var(--primary)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="dynamic" name={t("calc.vested.strategy.dynamic")} stroke="var(--success)" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CalcCard>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {projections.map((p) => {
            const Icon = STRATEGY_ICONS[p.strategy.id];
            const isRecommended = p.strategy.id === recommended;
            return (
              <CalcCard key={p.strategy.id} className={isRecommended ? "ring-2 ring-primary/40" : undefined}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">{strategyLabel(p.strategy.id)}</h4>
                  </div>
                  {isRecommended && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      {t("calc.vested.recommended_badge")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{strategyDesc(p.strategy.id)}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MoneyTile label={t("calc.vested.final_balance")} value={p.finalBalance} tone="primary" big compact tip={t("calc.vested.tip.final_balance")} />
                  <MoneyTile label={t("calc.vested.net_gains")} value={p.totalGains} tone="success" big compact tip={t("calc.vested.tip.net_gains")} />
                </div>
                <dl className="mt-4 space-y-1.5 text-xs">
                  <Line2 label={t("calc.vested.net_return")} value={`${p.netReturn} %`} />
                  <Line2 label={t("calc.vested.annual_fees")} value={`${p.strategy.totalFees} %`} />
                  <Line2 label={t("calc.vested.range_low")} value={formatCHF(p.finalLow)} />
                  <Line2 label={t("calc.vested.range_high")} value={formatCHF(p.finalHigh)} />
                  {p.estimatedExitTax !== undefined && (
                    <Line2 label={t("calc.vested.exit_tax")} value={formatCHF(p.estimatedExitTax)} />
                  )}
                  {p.estimatedExitTax !== undefined && (
                    <Line2 label={t("calc.vested.net_after_tax")} value={formatCHF(p.finalBalance - p.estimatedExitTax)} bold />
                  )}
                </dl>
              </CalcCard>
            );
          })}
      </div>

      <CalcCard>
        <Row>
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t("calc.vested.disclaimer.lp")}</strong>{" "}
            {t("calc.vested.disclaimer.lp_body")}
          </div>
          <div className="text-xs text-muted-foreground">
            <strong className="text-foreground">{t("calc.vested.disclaimer.assumptions")}</strong>{" "}
            {t("calc.vested.disclaimer.assumptions_body")}
          </div>
          <div className="text-xs text-muted-foreground sm:col-span-2">
            <strong className="text-foreground">{t("calc.vested.disclaimer.source")}</strong>{" "}
            {t("calc.vested.disclaimer.source_body")}
          </div>
        </Row>
      </CalcCard>
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

function Line2({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
