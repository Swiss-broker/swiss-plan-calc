import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line as RLine,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { RotateCcw, TrendingUp } from "lucide-react";

import { CalcCard, MoneyTile, HelpDot } from "@/components/calculators/CalcUI";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { useT } from "@/contexts/LanguageContext";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { ReportPdf, makeFilename, type PdfHeaderInfo } from "@/lib/pdf/builder";
import { formatCHF, formatPct } from "@/lib/format";
import {
  compareInvestments,
  INVESTMENT_TYPES,
  type ContributionFrequency,
  type InvestmentInput,
  type InvestmentResult,
  type InvestmentType,
} from "@/lib/investment-compare";

export const Route = createFileRoute("/_app/calculators/investment-compare")({
  head: () => ({ meta: [{ title: "Comparateur d'investissements · SwissBroker Pro" }] }),
  component: InvestmentCompareCalc,
});

const DEFAULT_A: InvestmentInput = {
  name: "",
  type: "savings",
  initialCapital: 100_000,
  periodicContribution: 0,
  contributionFrequency: "none",
  grossReturnRate: 1.5,
  annualFeeRate: 0,
  durationYears: 20,
  exitTaxRate: 22,
  interestMode: "compound",
};

const DEFAULT_B: InvestmentInput = {
  name: "",
  type: "etf",
  initialCapital: 100_000,
  periodicContribution: 0,
  contributionFrequency: "none",
  grossReturnRate: 5,
  annualFeeRate: 0.8,
  durationYears: 20,
  exitTaxRate: 22,
  interestMode: "compound",
};

function InvestmentCompareCalc() {
  const t = useT();
  const [a, setA] = useState<InvestmentInput>({ ...DEFAULT_A, name: t("calc.invcompare.default_a") });
  const [b, setB] = useState<InvestmentInput>({ ...DEFAULT_B, name: t("calc.invcompare.default_b") });
  const [guideOpen, setGuideOpen] = useState(false);

  const comparison = useMemo(() => compareInvestments(a, b), [a, b]);

  const reset = () => {
    setA({ ...DEFAULT_A, name: t("calc.invcompare.default_a") });
    setB({ ...DEFAULT_B, name: t("calc.invcompare.default_b") });
  };

  const brokerHeader = useBrokerPdfHeader();
  const handleExport = () => exportInvestmentComparePdf({ header: brokerHeader, comparison, t });

  const guideSteps: GuideStep[] = [
    { title: t("calc.invcompare.step.welcome.t"), body: t("calc.invcompare.step.welcome.b") },
    { title: t("calc.invcompare.step.params.t"), body: t("calc.invcompare.step.params.b") },
    { title: t("calc.invcompare.step.results.t"), body: t("calc.invcompare.step.results.b") },
  ];

  // Données graphique : merge des séries A et B sur l'année max.
  const chartData = useMemo(() => {
    const maxY = Math.max(comparison.a.series.length, comparison.b.series.length);
    const out: Array<{ year: number; a?: number; b?: number }> = [];
    for (let y = 0; y < maxY; y++) {
      out.push({
        year: y,
        a: comparison.a.series[y]?.netCapital,
        b: comparison.b.series[y]?.netCapital,
      });
    }
    return out;
  }, [comparison]);

  const winnerName =
    comparison.winner === "a"
      ? comparison.a.input.name
      : comparison.winner === "b"
        ? comparison.b.input.name
        : "";
  const loserName =
    comparison.winner === "a"
      ? comparison.b.input.name
      : comparison.winner === "b"
        ? comparison.a.input.name
        : "";

  return (
    <div className="space-y-6">
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title={t("calc.invcompare.guide_title")}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("calc.invcompare.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("calc.invcompare.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <GuideToggleButton onClick={() => setGuideOpen(true)} />
          <Button variant="outline" size="sm" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("calc.invcompare.reset")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InvestmentCard side="a" value={a} onChange={setA} result={comparison.a} />
        <InvestmentCard side="b" value={b} onChange={setB} result={comparison.b} />
      </div>

      <CalcCard
        title={t("calc.invcompare.summary_title")}
        className="border-primary/40 bg-primary/5"
      >
        {comparison.winner === "tie" ? (
          <p className="text-sm text-muted-foreground">{t("calc.invcompare.tie")}</p>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl font-bold tracking-tight text-primary tabular-nums">
              {formatCHF(comparison.netDifference)}
            </div>
            <div className="text-sm font-medium">
              {t("calc.invcompare.in_favor_of", { name: winnerName })}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("calc.invcompare.summary_text", {
                years: a.durationYears,
                winner: winnerName,
                loser: loserName,
                amount: formatCHF(comparison.netDifference),
                pct: formatPct(comparison.pctAdvantage),
              })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("calc.invcompare.nominal_notice")}
            </p>
          </div>
        )}
      </CalcCard>

      <CalcCard title={t("calc.invcompare.chart_title")} description={t("calc.invcompare.chart_desc")}>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                label={{ value: t("calc.invcompare.axis_years"), position: "insideBottom", offset: -2, fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => new Intl.NumberFormat("fr-CH", { notation: "compact" }).format(v)}
              />
              <RTooltip
                formatter={(value: number) => formatCHF(value)}
                labelFormatter={(year: number) => `${t("calc.invcompare.year_label")} ${year}`}
              />
              <Legend />
              <RLine
                type="monotone"
                dataKey="a"
                name={a.name || t("calc.invcompare.investment_a")}
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={false}
              />
              <RLine
                type="monotone"
                dataKey="b"
                name={b.name || t("calc.invcompare.investment_b")}
                stroke="var(--accent)"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind={"investment_compare" as never}
          inputs={{ a, b } as Record<string, unknown>}
          summary={{
            winner: comparison.winner,
            netDifference: comparison.netDifference,
            pctAdvantage: comparison.pctAdvantage,
            aFinalNet: comparison.a.finalNetCapital,
            bFinalNet: comparison.b.finalNetCapital,
          }}
          defaultTitle={`${a.name || "A"} vs ${b.name || "B"} · ${a.durationYears} ans`}
        />
        <ExportPdfButton onClick={handleExport} />
      </div>
    </div>
  );
}

function InvestmentCard({
  side,
  value,
  onChange,
  result,
}: {
  side: "a" | "b";
  value: InvestmentInput;
  onChange: (next: InvestmentInput) => void;
  result: InvestmentResult;
}) {
  const t = useT();
  const set = <K extends keyof InvestmentInput>(k: K, v: InvestmentInput[K]) =>
    onChange({ ...value, [k]: v });
  const titleKey = side === "a" ? "calc.invcompare.investment_a" : "calc.invcompare.investment_b";
  const tone = side === "a" ? "primary" : "success";

  return (
    <CalcCard
      title={t(titleKey)}
      className={side === "a" ? "border-primary/30" : "border-success/30"}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">{t("calc.invcompare.field.name")}</Label>
            <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder={t(titleKey)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("calc.invcompare.field.type")}</Label>
            <Select value={value.type} onValueChange={(v) => set("type", v as InvestmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVESTMENT_TYPES.map((it) => (
                  <SelectItem key={it} value={it}>{t(`calc.invcompare.type.${it}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumField
            label={t("calc.invcompare.field.duration")}
            value={value.durationYears}
            onChange={(v) => set("durationYears", Math.max(1, Math.round(v)))}
            suffix={t("common.years.short")}
          />
          <NumField
            label={t("calc.invcompare.field.initial")}
            value={value.initialCapital}
            onChange={(v) => set("initialCapital", Math.max(0, v))}
            suffix="CHF"
          />
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {t("calc.invcompare.field.frequency")}
              <HelpDot tip={t("calc.invcompare.tip.frequency")} />
            </Label>
            <Select
              value={value.contributionFrequency}
              onValueChange={(v) => set("contributionFrequency", v as ContributionFrequency)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("calc.invcompare.freq.none")}</SelectItem>
                <SelectItem value="monthly">{t("calc.invcompare.freq.monthly")}</SelectItem>
                <SelectItem value="annual">{t("calc.invcompare.freq.annual")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {value.contributionFrequency !== "none" && (
            <NumField
              label={t("calc.invcompare.field.contribution")}
              value={value.periodicContribution}
              onChange={(v) => set("periodicContribution", Math.max(0, v))}
              suffix="CHF"
            />
          )}
          <NumField
            label={t("calc.invcompare.field.return")}
            value={value.grossReturnRate}
            onChange={(v) => set("grossReturnRate", clampPct(v))}
            suffix="%"
            tip={t("calc.invcompare.tip.return")}
          />
          <NumField
            label={t("calc.invcompare.field.fees")}
            value={value.annualFeeRate}
            onChange={(v) => set("annualFeeRate", clampPct(v))}
            suffix="%"
            tip={t("calc.invcompare.tip.fees")}
          />
          <NumField
            label={t("calc.invcompare.field.exit_tax")}
            value={value.exitTaxRate}
            onChange={(v) => set("exitTaxRate", clampPct(v))}
            suffix="%"
            tip={t("calc.invcompare.tip.exit_tax")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MoneyTile label={t("calc.invcompare.res.gross")} value={result.finalGrossCapital} tone={tone} tip={t("calc.invcompare.tip.gross")} />
          <MoneyTile label={t("calc.invcompare.res.gain")} value={result.grossGain} tip={t("calc.invcompare.tip.gain")} />
          <MoneyTile label={t("calc.invcompare.res.fees")} value={result.feesImpact} tone="warning" tip={t("calc.invcompare.tip.fees_impact")} />
          <MoneyTile label={t("calc.invcompare.res.tax")} value={result.exitTax} tone="warning" tip={t("calc.invcompare.tip.tax_impact")} />
          <div className="col-span-2">
            <MoneyTile
              label={t("calc.invcompare.res.net")}
              value={result.finalNetCapital}
              tone="success"
              big
              tip={t("calc.invcompare.tip.net")}
            />
          </div>
        </div>
      </div>
    </CalcCard>
  );
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  tip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  tip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {tip ? <HelpDot tip={tip} /> : null}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}

function exportInvestmentComparePdf(args: {
  header?: Partial<PdfHeaderInfo>;
  comparison: ReturnType<typeof compareInvestments>;
  t: (k: string, p?: Record<string, string | number>, fb?: string) => string;
}) {
  const { comparison, t } = args;
  const a = comparison.a;
  const b = comparison.b;
  const pdf = new ReportPdf({
    title: t("calc.invcompare.title"),
    subtitle: t("calc.invcompare.subtitle"),
    ...args.header,
  } as PdfHeaderInfo);

  pdf.situationBanner(t("calc.invcompare.summary_title").toUpperCase());

  pdf.section(t("calc.invcompare.summary_title"));
  if (comparison.winner === "tie") {
    pdf.paragraph(t("calc.invcompare.tie"));
  } else {
    const winner = comparison.winner === "a" ? a : b;
    const loser = comparison.winner === "a" ? b : a;
    pdf.metricsGrid([
      { label: t("calc.invcompare.res.net") + " · " + a.input.name, value: a.finalNetCapital, tone: comparison.winner === "a" ? "success" : "primary" },
      { label: t("calc.invcompare.res.net") + " · " + b.input.name, value: b.finalNetCapital, tone: comparison.winner === "b" ? "success" : "primary" },
      { label: "Δ " + t("calc.invcompare.summary_title"), value: formatCHF(comparison.netDifference), tone: "success" },
      { label: t("calc.invcompare.in_favor_of", { name: winner.input.name }), value: formatPct(comparison.pctAdvantage), tone: "success" },
    ]);
    pdf.callout(
      t("calc.invcompare.summary_text", {
        years: winner.input.durationYears,
        winner: winner.input.name,
        loser: loser.input.name,
        amount: formatCHF(comparison.netDifference),
        pct: formatPct(comparison.pctAdvantage),
      }),
      "success",
    );
  }

  pdf.section(t("calc.invcompare.chart_title"));
  pdf.table(
    [
      "",
      a.input.name || t("calc.invcompare.investment_a"),
      b.input.name || t("calc.invcompare.investment_b"),
    ],
    [
      [t("calc.invcompare.field.type"), t(`calc.invcompare.type.${a.input.type}`), t(`calc.invcompare.type.${b.input.type}`)],
      [t("calc.invcompare.field.duration"), `${a.input.durationYears} ${t("common.years.short")}`, `${b.input.durationYears} ${t("common.years.short")}`],
      [t("calc.invcompare.field.initial"), formatCHF(a.input.initialCapital), formatCHF(b.input.initialCapital)],
      [t("calc.invcompare.field.frequency"), t(`calc.invcompare.freq.${a.input.contributionFrequency}`), t(`calc.invcompare.freq.${b.input.contributionFrequency}`)],
      [t("calc.invcompare.field.contribution"), formatCHF(a.input.periodicContribution), formatCHF(b.input.periodicContribution)],
      [t("calc.invcompare.field.return"), formatPct(a.input.grossReturnRate), formatPct(b.input.grossReturnRate)],
      [t("calc.invcompare.field.fees"), formatPct(a.input.annualFeeRate), formatPct(b.input.annualFeeRate)],
      [t("calc.invcompare.field.exit_tax"), formatPct(a.input.exitTaxRate), formatPct(b.input.exitTaxRate)],
      ["—", "—", "—"],
      [t("calc.invcompare.res.gross"), formatCHF(a.finalGrossCapital), formatCHF(b.finalGrossCapital)],
      [t("calc.invcompare.res.gain"), formatCHF(a.grossGain), formatCHF(b.grossGain)],
      [t("calc.invcompare.res.fees"), formatCHF(a.feesImpact), formatCHF(b.feesImpact)],
      [t("calc.invcompare.res.tax"), formatCHF(a.exitTax), formatCHF(b.exitTax)],
      [t("calc.invcompare.res.net"), formatCHF(a.finalNetCapital), formatCHF(b.finalNetCapital)],
    ],
    { highlightLast: true },
  );

  for (const r of [a, b]) {
    pdf.section(r.input.name);
    pdf.metricsGrid([
      { label: t("calc.invcompare.res.net"), value: r.finalNetCapital, tone: "success" },
      { label: t("calc.invcompare.res.gross"), value: r.finalGrossCapital, tone: "primary" },
      { label: t("calc.invcompare.res.gain"), value: r.grossGain },
      { label: t("calc.invcompare.res.tax"), value: r.exitTax, tone: "warning" },
    ]);
  }

  pdf.spacer(2);
  pdf.paragraph(t("calc.invcompare.nominal_notice"), { italic: true, muted: true });

  pdf.save(makeFilename("investment_compare"));
}
