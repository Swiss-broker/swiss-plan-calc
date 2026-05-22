// Phase 4.2 · Comparateur dividende / salaire / bénéfices (UI dirigeant).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Info,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Users,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { supabase } from "@/integrations/supabase/client";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { exportDirectorCompensationPdf } from "@/lib/pdf/reports";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
import { useT } from "@/contexts/LanguageContext";
import { t as translate } from "@/lib/i18n";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCHF } from "@/lib/format";
import { getSelectableCantons, type SelectableCantonCode } from "@/lib/swiss/cantons";
import {
  computeAllStrategies,
  computeStrategy,
  computeStrategyFromAbsolute,
  recommendBestStrategy,
} from "@/lib/director-compensation";
import type {
  AbsoluteAllocation,
  CompensationResult,
  CompensationStrategy,
  DirectorInputs,
  LppPlanKind,
} from "@/lib/director-compensation/types";
import type { Client } from "@/lib/clients/types";
import type { Company } from "@/lib/companies/types";
import type { FilingStatus } from "@/lib/tax/ifd";
import { DirectorLppBuybackCard } from "@/components/calculators/DirectorLppBuybackCard";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  companyId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/director-compensation")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: translate("calc.dir.head.title") },
      {
        name: "description",
        content: translate("calc.dir.head.desc"),
      },
    ],
  }),
  component: DirectorCompensationCalc,
});

const FILING_OPTIONS: { value: FilingStatus; labelKey: string }[] = [
  { value: "single", labelKey: "calc.status.single" },
  { value: "married", labelKey: "calc.status.married" },
  { value: "single_with_children", labelKey: "calc.status.single_with_children" },
];

function DirectorCompensationCalc() {
  const t = useT();
  const brokerHeader = useBrokerPdfHeader();
  const { clientId, companyId } = Route.useSearch();

  // Charge optionnellement le client + la société depuis l'URL.
  const linkQuery = useQuery({
    queryKey: ["director-comp-link", clientId, companyId],
    enabled: Boolean(clientId || companyId),
    queryFn: async () => {
      const [c, co] = await Promise.all([
        clientId
          ? supabase.from("clients").select("*").eq("id", clientId).single()
          : Promise.resolve({ data: null, error: null }),
        companyId
          ? supabase.from("companies").select("*").eq("id", companyId).single()
          : Promise.resolve({ data: null, error: null }),
      ]);
      return {
        client: (c.data as Client | null) ?? null,
        company: (co.data as Company | null) ?? null,
      };
    },
  });

  const linkedClient = linkQuery.data?.client ?? null;
  const linkedCompany = linkQuery.data?.company ?? null;

  const [inputs, setInputs] = useState<DirectorInputs>({
    totalProfit: 200_000,
    companyCanton: "GE",
    directorCanton: "GE",
    status: "single",
    children: 0,
    confession: "none",
    age: 40,
    lppPlan: "mandatory",
    qualifiedHolding: true,
    reserveTarget: 0,
  });

  // Situation actuelle (répartition réelle déclarée par le dirigeant)
  const [hasCurrent, setHasCurrent] = useState(false);
  const [current, setCurrent] = useState<AbsoluteAllocation>({
    grossSalary: 100_000,
    dividends: 30_000,
  });

  // Hydratation depuis client + société (une seule fois)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    if (!linkedClient && !linkedCompany) return;
    setInputs((prev) => ({
      ...prev,
      totalProfit:
        linkedCompany?.annual_profit != null
          ? Number(linkedCompany.annual_profit)
          : prev.totalProfit,
      companyCanton:
        (linkedCompany?.canton as SelectableCantonCode | undefined) ?? prev.companyCanton,
      directorCanton:
        (linkedClient?.canton as SelectableCantonCode | undefined) ?? prev.directorCanton,
      status: (linkedClient?.civil_status as FilingStatus | undefined) ?? prev.status,
      children: Array.isArray(linkedClient?.children)
        ? linkedClient.children.length
        : prev.children,
      confession:
        (linkedClient?.confession as DirectorInputs["confession"] | undefined) ??
        prev.confession,
      age: linkedClient?.date_of_birth
        ? Math.max(
            18,
            new Date().getFullYear() -
              new Date(linkedClient.date_of_birth).getFullYear(),
          )
        : prev.age,
    }));
    if (linkedClient?.gross_annual_salary != null) {
      setCurrent((p) => ({ ...p, grossSalary: Number(linkedClient.gross_annual_salary) }));
      setHasCurrent(true);
    }
    setHydrated(true);
  }, [linkedClient, linkedCompany, hydrated]);

  const headcount = (linkedCompany as (Company & { headcount_fte?: number | null }) | null)?.headcount_fte ?? null;

  // Stratégie personnalisée
  const [custom, setCustom] = useState<CompensationStrategy>({
    salaryPct: 60,
    dividendPct: 30,
    retainedPct: 10,
    label: t("calc.dir.custom.label"),
  });

  const setField = <K extends keyof DirectorInputs>(k: K, v: DirectorInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const presetResults = useMemo(() => computeAllStrategies(inputs), [inputs]);
  const customResult = useMemo(
    () => computeStrategy(inputs, custom),
    [inputs, custom],
  );
  const currentResult = useMemo(
    () => (hasCurrent ? computeStrategyFromAbsolute(inputs, current, t("calc.dir.current.label")) : null),
    [hasCurrent, inputs, current, t],
  );
  const strategiesForCompare = useMemo(
    () => [...presetResults, customResult],
    [presetResults, customResult],
  );
  const recommendation = useMemo(
    () => recommendBestStrategy(strategiesForCompare),
    [strategiesForCompare],
  );
  const tableResults = useMemo(
    () => (currentResult ? [currentResult, ...strategiesForCompare] : strategiesForCompare),
    [currentResult, strategiesForCompare],
  );

  const availableProfit = Math.max(0, inputs.totalProfit - (inputs.reserveTarget ?? 0));

  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.dir.guide.s1.title"), body: t("calc.dir.guide.s1.body") },
    { title: t("calc.dir.guide.s2.title"), body: t("calc.dir.guide.s2.body") },
    { title: t("calc.dir.guide.s3.title"), body: t("calc.dir.guide.s3.body") },
    { title: t("calc.dir.guide.s4.title"), body: t("calc.dir.guide.s4.body") },
    { title: t("calc.dir.guide.s5.title"), body: t("calc.dir.guide.s5.body") },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <CrossCalcImpactBanner calculator="director-compensation" clientId={clientId} />
        <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.dir.guide.title")} />
        <div className="flex justify-end gap-2">
          <ExportPdfButton
            onClick={() =>
              exportDirectorCompensationPdf({
                header: brokerHeader,
                inputs,
                results: strategiesForCompare,
                recommended: recommendation.best,
                current: currentResult,
                clientName: linkedClient ? `${linkedClient.first_name} ${linkedClient.last_name}` : null,
                companyName: linkedCompany?.legal_name ?? null,
              })
            }
          />
          <SaveSimulationButton
            kind="director_compensation"
            inputs={{ ...inputs, hasCurrent, current, custom }}
            summary={{
              recommendedLabel: recommendation.best.strategy.label,
              recommendedDirectorNet: recommendation.best.directorNet,
              recommendedTotalCharges: recommendation.best.totalTaxAndCharges,
              currentDirectorNet: currentResult?.directorNet ?? 0,
              gainAnnual: currentResult
                ? Math.max(0, recommendation.best.directorNet - currentResult.directorNet)
                : 0,
              totalProfit: inputs.totalProfit,
              companyCanton: inputs.companyCanton,
              directorCanton: inputs.directorCanton,
            }}
            defaultTitle={`Dirigeant ${inputs.companyCanton} · profit ${inputs.totalProfit} CHF`}
          />
          <GuideToggleButton onClick={() => setGuideOpen(true)} />
        </div>
        {(linkedClient || linkedCompany) && (
          <LinkBanner client={linkedClient} company={linkedCompany} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Inputs */}
          <div className="space-y-6 lg:col-span-2">
            <CalcCard
              title={t("calc.dir.card.inputs.title")}
              description={t("calc.dir.card.inputs.desc")}
            >
              <div className="space-y-4">
                <NumField
                  label={t("calc.dir.field.profit")}
                  value={inputs.totalProfit}
                  onChange={(v) => setField("totalProfit", v)}
                  hint={t("calc.dir.field.profit.hint")}
                  wikiId="dirigeant"
                  wikiTip={t("calc.dir.field.profit.tip")}
                />
                <NumField
                  label={t("calc.dir.field.reserve")}
                  value={inputs.reserveTarget ?? 0}
                  onChange={(v) => setField("reserveTarget", v)}
                  hint={t("calc.dir.field.reserve.hint")}
                  wikiId="dirigeant"
                  wikiTip={t("calc.dir.field.reserve.tip")}
                />
                {(inputs.reserveTarget ?? 0) > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                    <div className="flex justify-between"><span>{t("calc.dir.reserve.total_profit")}</span><strong className="tabular-nums">{formatCHF(inputs.totalProfit)}</strong></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("calc.dir.reserve.minus")}</span><span className="tabular-nums">{formatCHF(inputs.reserveTarget ?? 0)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-border pt-1"><span>{t("calc.dir.reserve.available")}</span><strong className="tabular-nums text-primary">{formatCHF(availableProfit)}</strong></div>
                    {availableProfit <= 0 && (
                      <p className="mt-2 text-warning">{t("calc.dir.reserve.warn_zero")}</p>
                    )}
                  </div>
                )}
                {headcount != null && headcount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {t("calc.dir.headcount", { n: headcount })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label={t("calc.dir.field.canton_company")}
                    value={inputs.companyCanton}
                    onChange={(v) => setField("companyCanton", v as SelectableCantonCode)}
                    wikiId="dirigeant"
                    wikiTip={t("calc.dir.field.canton_company.tip")}
                  />
                  <SelectField
                    label={t("calc.dir.field.canton_director")}
                    value={inputs.directorCanton}
                    onChange={(v) =>
                      setField("directorCanton", v as SelectableCantonCode)
                    }
                    wikiId="dirigeant"
                    wikiTip={t("calc.dir.field.canton_director.tip")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t("calc.dir.field.civil_status")}
                    </Label>
                    <Select
                      value={inputs.status}
                      onValueChange={(v) => setField("status", v as FilingStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILING_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {t(o.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumField
                    label={t("calc.dir.field.children")}
                    value={inputs.children ?? 0}
                    onChange={(v) => setField("children", v)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label={t("calc.dir.field.age")}
                    value={inputs.age}
                    onChange={(v) => setField("age", v)}
                    wikiId="lpp-credits"
                    wikiTip={t("calc.dir.field.age.tip")}
                  />
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>{t("calc.dir.field.lpp_plan")}</span>
                      <WikiTip articleId="lpp-coordination" tip={t("calc.dir.field.lpp_plan.tip")} />
                    </Label>
                    <Select
                      value={inputs.lppPlan}
                      onValueChange={(v) => setField("lppPlan", v as LppPlanKind)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mandatory">{t("calc.dir.lpp.mandatory")}</SelectItem>
                        <SelectItem value="executive_1e">{t("calc.dir.lpp.executive")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {inputs.lppPlan === "executive_1e" && (
                      <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] leading-snug text-foreground/80">
                        <strong>Plan cadre 1e</strong>, prévoyance surobligatoire pour salaires
                        élevés. Plus grande flexibilité d'investissement et optimisation fiscale,
                        mais niveau de risque supérieur selon la stratégie choisie.
                      </p>
                    )}
                  </div>

                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <span>{t("calc.dir.field.qualified")}</span>
                      <WikiTip articleId="dirigeant" tip={t("calc.dir.field.qualified.tip")} />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("calc.dir.field.qualified.hint")}
                    </p>
                  </div>
                  <Switch
                    checked={inputs.qualifiedHolding}
                    onCheckedChange={(v) => setField("qualifiedHolding", v)}
                  />
                </div>
              </div>
            </CalcCard>

            <CalcCard
              title={t("calc.dir.card.custom.title")}
              description={t("calc.dir.card.custom.desc")}
            >
              <CustomStrategySliders value={custom} onChange={setCustom} />
            </CalcCard>

            <CalcCard
              title={t("calc.dir.card.current.title")}
              description={t("calc.dir.card.current.desc")}
            >
              <Accordion type="single" collapsible defaultValue={hasCurrent ? "cur" : undefined}>
                <AccordionItem value="cur" className="border-b-0">
                  <AccordionTrigger className="py-2 text-sm">
                    {hasCurrent ? t("calc.dir.current.edit") : t("calc.dir.current.set")}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Switch checked={hasCurrent} onCheckedChange={setHasCurrent} />
                      <span>{t("calc.dir.current.include")}</span>
                    </div>
                    <NumField
                      label={t("calc.dir.current.salary")}
                      value={current.grossSalary}
                      onChange={(v) => setCurrent((p) => ({ ...p, grossSalary: v }))}
                    />
                    <NumField
                      label={t("calc.dir.current.dividends")}
                      value={current.dividends}
                      onChange={(v) => setCurrent((p) => ({ ...p, dividends: v }))}
                    />
                    <NumField
                      label={t("calc.dir.current.retained")}
                      value={current.retained ?? 0}
                      onChange={(v) => setCurrent((p) => ({ ...p, retained: v || undefined }))}
                      hint={t("calc.dir.current.retained.hint")}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CalcCard>
          </div>

          {/* Results */}
          <div className="space-y-6 lg:col-span-3">
            <RecommendationCard
              best={recommendation.best}
              reason={recommendation.reason}
              totalProfit={inputs.totalProfit}
              current={currentResult}
              clientName={linkedClient ? `${linkedClient.first_name} ${linkedClient.last_name}` : null}
            />

            <CalcCard
              title={t("calc.dir.card.compare.title")}
              description={t("calc.dir.card.compare.desc")}
            >
              <ComparisonTable
                results={tableResults}
                bestLabel={recommendation.best.strategy.label}
                currentLabel={currentResult?.strategy.label}
              />
            </CalcCard>


            <CalcCard
              title={t("calc.dir.card.chart.title")}
              description={t("calc.dir.card.chart.desc")}
            >
              <ComparisonChart results={tableResults} />
            </CalcCard>

            <DirectorLppBuybackCard
              best={recommendation.best}
              retirementAge={65}
              initialBalance={
                Number(
                  (linkedClient as unknown as { lpp_current_balance?: number } | null)
                    ?.lpp_current_balance ?? 0,
                ) || 0
              }
            />
          </div>
        </div>

        <LegalDisclaimer />
      </div>
    </TooltipProvider>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function NumField({
  label,
  value,
  onChange,
  hint,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      <BaseNumField value={String(value)} onChange={(v) => onChange(Number(v) || 0)} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  wikiId,
  wikiTip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wikiId?: string;
  wikiTip?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {getSelectableCantons().map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.code} · {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CustomStrategySliders({
  value,
  onChange,
}: {
  value: CompensationStrategy;
  onChange: (v: CompensationStrategy) => void;
}) {
  const t = useT();
  const salaryPct = value.salaryPct;
  const remainder = 100 - salaryPct;
  const dividendShareOfRemainder =
    remainder > 0 ? (value.dividendPct / remainder) * 100 : 100;

  const setSalary = (newSalary: number) => {
    const r = 100 - newSalary;
    const div = (dividendShareOfRemainder / 100) * r;
    const ret = r - div;
    onChange({
      ...value,
      salaryPct: round1(newSalary),
      dividendPct: round1(div),
      retainedPct: round1(ret),
    });
  };

  const setDivShare = (share: number) => {
    const r = 100 - salaryPct;
    const div = (share / 100) * r;
    const ret = r - div;
    onChange({
      ...value,
      dividendPct: round1(div),
      retainedPct: round1(ret),
    });
  };

  const presets: { label: string; s: number; d: number; r: number }[] = [
    { label: "100 / 0 / 0", s: 100, d: 0, r: 0 },
    { label: "70 / 30 / 0", s: 70, d: 30, r: 0 },
    { label: "50 / 50 / 0", s: 50, d: 50, r: 0 },
    { label: "50 / 30 / 20", s: 50, d: 30, r: 20 },
    { label: "30 / 70 / 0", s: 30, d: 70, r: 0 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            {t("calc.dir.custom.salary")}
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t("calc.dir.custom.salary.tip")}
              </TooltipContent>
            </Tooltip>
          </Label>
          <span className="text-sm font-semibold tabular-nums">{salaryPct.toFixed(0)} %</span>
        </div>
        <Slider value={[salaryPct]} min={0} max={100} step={5} onValueChange={([v]) => setSalary(v)} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-medium">
            {t("calc.dir.custom.remainder", { pct: remainder.toFixed(0) })}
          </Label>
          <span className="text-sm font-semibold tabular-nums">
            {dividendShareOfRemainder.toFixed(0)} %
          </span>
        </div>
        <Slider
          value={[dividendShareOfRemainder]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => setDivShare(v)}
          disabled={remainder === 0}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{t("calc.dir.custom.label.salary")}</div>
          <div className="font-semibold">{value.salaryPct.toFixed(0)} %</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{t("calc.dir.custom.label.dividends")}</div>
          <div className="font-semibold">{value.dividendPct.toFixed(0)} %</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            {t("calc.dir.custom.label.reserves")}
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t("calc.dir.custom.reserves.tip")}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="font-semibold">{value.retainedPct.toFixed(0)} %</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("calc.dir.custom.presets")}</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:border-primary hover:bg-primary/5 transition-colors"
              onClick={() =>
                onChange({
                  ...value,
                  salaryPct: p.s,
                  dividendPct: p.d,
                  retainedPct: p.r,
                })
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function effectivePct(r: CompensationResult): { s: number; d: number; rr: number } {
  const total = r.inputs.totalProfit || 1;
  const s = (r.company.totalSalaryCost / total) * 100;
  const d = (r.company.dividendsPaid / total) * 100;
  const rr = (r.company.retainedActual / total) * 100;
  return { s, d, rr };
}

function ComparisonTable({
  results,
  bestLabel,
  currentLabel,
}: {
  results: CompensationResult[];
  bestLabel?: string;
  currentLabel?: string;
}) {
  const t = useT();
  const currentRow = currentLabel
    ? results.find((r) => r.strategy.label === currentLabel)
    : undefined;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("calc.dir.col.strategy")}</TableHead>
            <TableHead className="text-right">{t("calc.dir.col.gross_salary")}</TableHead>
            <TableHead className="text-right">{t("calc.dir.col.corporate_tax")}</TableHead>
            <TableHead className="text-right">{t("calc.dir.col.dividends")}</TableHead>
            <TableHead className="text-right">{t("calc.dir.col.income_tax")}</TableHead>
            <TableHead className="text-right">{t("calc.dir.col.reserves")}</TableHead>
            <TableHead className="text-right font-bold">{t("calc.dir.col.net")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r, idx) => {
            const isBest = r.strategy.label === bestLabel;
            const isCurrent = currentLabel != null && r.strategy.label === currentLabel;
            const eff = effectivePct(r);
            const adjusted = r.company.dividendShortfall;
            return (
              <TableRow
                key={idx}
                className={cn(
                  isBest && "bg-success/5 hover:bg-success/10",
                  isCurrent && "bg-muted/40 hover:bg-muted/60",
                )}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 font-medium">
                      {r.strategy.label}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">{t("calc.dir.badge.current")}</Badge>
                      )}
                      {isBest && (
                        <Badge variant="secondary" className="bg-success/15 text-success-foreground text-[10px]">
                          <Sparkles className="mr-1 h-3 w-3" /> {t("calc.dir.badge.recommended")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("calc.dir.effective", { s: eff.s.toFixed(0), d: eff.d.toFixed(0), r: eff.rr.toFixed(0) })}
                      {adjusted && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 cursor-help text-warning">
                              {t("calc.dir.adjusted")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {t("calc.dir.adjusted.tip", {
                              targeted: formatCHF(r.company.dividendsTargeted),
                              paid: formatCHF(r.company.dividendsPaid),
                            })}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCHF(r.company.grossSalary)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatCHF(r.company.corporateTax)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCHF(r.company.dividendsPaid)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatCHF(r.director.totalIncomeTax)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCHF(r.retainedInCompany)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCHF(r.directorNet)}</TableCell>
              </TableRow>
            );
          })}
          {currentRow && (
            <TableRow className="border-t-2 border-primary/30 bg-primary/5">
              <TableCell className="text-xs font-semibold uppercase text-muted-foreground">
                {t("calc.dir.delta_vs_current")}
              </TableCell>
              <TableCell colSpan={6} className="text-[11px] text-muted-foreground">
                {t("calc.dir.current_net", { amount: formatCHF(currentRow.directorNet) })}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {currentRow && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {results
            .filter((r) => r.strategy.label !== currentLabel)
            .map((r, i) => {
              const delta = r.directorNet - currentRow.directorNet;
              const positive = delta >= 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-2 text-xs",
                    positive ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <span className="font-medium">{r.strategy.label}</span>
                  <span className={cn("inline-flex items-center gap-1 tabular-nums font-semibold", positive ? "text-success-foreground" : "text-destructive")}>
                    {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {positive ? "+" : ""}{formatCHF(delta)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function ComparisonChart({ results }: { results: CompensationResult[] }) {
  const t = useT();
  const kTax = t("calc.dir.chart.taxes");
  const kNet = t("calc.dir.chart.net");
  const kRes = t("calc.dir.chart.reserves");
  const data = results.map((r) => ({
    name: r.strategy.label ?? "",
    [kTax]: Math.round(r.totalTaxAndCharges),
    [kNet]: Math.round(r.directorNet),
    [kRes]: Math.round(r.retainedInCompany),
  }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <RTooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => formatCHF(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={kTax} stackId="a" fill="var(--destructive)">
            {data.map((_, i) => (
              <Cell key={i} fill="var(--destructive)" />
            ))}
          </Bar>
          <Bar dataKey={kNet} stackId="a" fill="var(--success, var(--primary))" />
          <Bar dataKey={kRes} stackId="a" fill="var(--primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecommendationCard({
  best,
  reason,
  totalProfit,
  current,
  clientName,
}: {
  best: CompensationResult;
  reason: string;
  totalProfit: number;
  current: CompensationResult | null;
  clientName: string | null;
}) {
  const t = useT();
  const salaryRatio = totalProfit > 0 ? best.company.totalSalaryCost / totalProfit : 0;
  const lowSalaryWarning = salaryRatio < 0.5 && best.company.totalSalaryCost > 0;

  return (
    <div className="rounded-2xl border border-success/40 bg-gradient-to-br from-success/10 to-primary/5 p-5 shadow-3d">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-success/15 p-2">
          <TrendingUp className="h-5 w-5 text-success-foreground" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("calc.dir.reco.label")}
          </div>
          <h3 className="mt-0.5 text-xl font-semibold">{best.strategy.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MoneyTile label={t("calc.dir.reco.tile.net")} value={best.directorNet} tone="success" big tip={t("calc.dir.reco.tile.net.tip")} />
        <MoneyTile label={t("calc.dir.reco.tile.gross")} value={best.company.grossSalary} tone="default" tip={t("calc.dir.reco.tile.gross.tip")} />
        <MoneyTile label={t("calc.dir.reco.tile.div")} value={best.company.dividendsPaid} tone="primary" tip={t("calc.dir.reco.tile.div.tip")} />
        <MoneyTile label={t("calc.dir.reco.tile.res")} value={best.retainedInCompany} tone="default" tip={t("calc.dir.reco.tile.res.tip")} />
      </div>
      {current && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-card/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("calc.dir.reco.client.title", { name: clientName ?? t("calc.dir.reco.this_director") })}
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            {t("calc.dir.reco.body", {
              curSal: formatCHF(current.company.grossSalary),
              curDiv: formatCHF(current.company.dividendsPaid),
              strategy: best.strategy.label ?? "",
              newSal: formatCHF(best.company.grossSalary),
              newDiv: formatCHF(best.company.dividendsPaid),
            })}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DeltaTile label={t("calc.dir.reco.delta.savings")} value={current.totalTaxAndCharges - best.totalTaxAndCharges} positiveIsGood />
            <DeltaTile label={t("calc.dir.reco.delta.net")} value={best.directorNet - current.directorNet} positiveIsGood />
            <DeltaTile label={t("calc.dir.reco.delta.10y")} value={(best.directorNet - current.directorNet) * 10} positiveIsGood />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("calc.dir.reco.footer")}
          </p>
        </div>
      )}
      {lowSalaryWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <strong>{t("calc.dir.warn.low_salary.title")}</strong>{" "}
            {t("calc.dir.warn.low_salary.body", { pct: (salaryRatio * 100).toFixed(0) })}
          </div>
        </div>
      )}
      {best.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
          {best.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkBanner({
  client,
  company,
}: {
  client: Client | null;
  company: Company | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-primary">
        {t("calc.dir.link.label")}
      </span>
      {client && (
        <Link
          to="/clients/$clientId"
          params={{ clientId: client.id }}
          className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <User className="h-3.5 w-3.5" />
          {client.first_name} {client.last_name}
        </Link>
      )}
      {company && (
        <Link
          to="/companies/$companyId"
          params={{ companyId: company.id }}
          className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          <Building2 className="h-3.5 w-3.5" />
          {company.legal_name}
        </Link>
      )}
    </div>
  );
}

function LegalDisclaimer() {
  const t = useT();
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <strong className="text-foreground">{t("calc.dir.legal.intro")}</strong>{" "}
          {t("calc.dir.legal.body")}
        </div>
      </div>
    </div>
  );
}

function DeltaTile({ label, value, positiveIsGood }: { label: string; value: number; positiveIsGood?: boolean }) {
  const positive = value >= 0;
  const good = positiveIsGood ? positive : !positive;
  return (
    <div className={cn(
      "rounded-lg border p-3",
      good
        ? "border-success/60 bg-success/15 ring-1 ring-success/30"
        : "border-destructive/30 bg-destructive/5",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-base font-semibold tabular-nums", good ? "text-success" : "text-destructive")}>
        {positive ? "+" : ""}{formatCHF(value)}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
