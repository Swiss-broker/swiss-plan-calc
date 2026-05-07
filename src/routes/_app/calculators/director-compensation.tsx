// Phase 4.2 — Comparateur dividende / salaire / bénéfices (UI dirigeant).
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
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";
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

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  companyId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/director-compensation")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Comparateur salaire / dividende — SwissBroker Pro" },
      {
        name: "description",
        content:
          "Comparez les stratégies de rémunération salaire / dividendes / réserves d'un dirigeant de société suisse.",
      },
    ],
  }),
  component: DirectorCompensationCalc,
});

const FILING_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Célibataire" },
  { value: "married", label: "Marié·e" },
  { value: "single_with_children", label: "Famille monoparentale" },
];

function DirectorCompensationCalc() {
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
    label: "Personnalisée",
  });

  const setField = <K extends keyof DirectorInputs>(k: K, v: DirectorInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const presetResults = useMemo(() => computeAllStrategies(inputs), [inputs]);
  const customResult = useMemo(
    () => computeStrategy(inputs, custom),
    [inputs, custom],
  );
  const currentResult = useMemo(
    () => (hasCurrent ? computeStrategyFromAbsolute(inputs, current, "Situation actuelle") : null),
    [hasCurrent, inputs, current],
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
    { title: "Bienvenue dans le comparateur Dirigeant", body: "Ce mode guide explique comment optimiser le mix salaire / dividende / réserves pour un dirigeant de société." },
    { title: "Bénéfice avant rémunération", body: "Le résultat de la société AVANT de vous verser quoi que ce soit. C'est le gâteau à répartir." },
    { title: "Stratégies", body: "100% salaire (max LPP/AVS), 100% dividende (économie sociale), équilibré (best-of) ou personnalisée. Chaque option a un impact différent sur cotisations sociales et impôt." },
    { title: "Réserves", body: "Bénéfice net (après IS) laissé dans la société au lieu d'être distribué. Ne crée pas d'impôt personnel et finance les futures distributions ou un rachat de parts." },
    { title: "Comparatif", body: "Coût total (cotisations + impôt société + impôt personnel) et net en poche pour chaque stratégie." },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide Dirigeant" />
        <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>
        {(linkedClient || linkedCompany) && (
          <LinkBanner client={linkedClient} company={linkedCompany} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Inputs */}
          <div className="space-y-6 lg:col-span-2">
            <CalcCard
              title="Données société & dirigeant"
              description="Bénéfice annuel à répartir entre salaire, dividendes et réserves."
            >
              <div className="space-y-4">
                <NumField
                  label="Bénéfice annuel total (CHF)"
                  value={inputs.totalProfit}
                  onChange={(v) => setField("totalProfit", v)}
                  hint="Avant charges sociales et impôt société"
                  wikiId="dirigeant"
                  wikiTip="Résultat de la société AVANT toute rémunération du dirigeant. C'est le « gâteau » à répartir entre salaire, dividende et réserves."
                />
                <NumField
                  label="Réserve cible à conserver en société (CHF/an)"
                  value={inputs.reserveTarget ?? 0}
                  onChange={(v) => setField("reserveTarget", v)}
                  hint="Optionnel — montant prélevé en priorité sur le bénéfice avant la répartition salaire/dividende."
                  wikiId="dirigeant"
                  wikiTip="Si renseigné, la réserve cible est déduite du bénéfice total avant le calcul des stratégies. Le reliquat est réparti entre salaire et dividendes."
                />
                {(inputs.reserveTarget ?? 0) > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                    <div className="flex justify-between"><span>Bénéfice total</span><strong className="tabular-nums">{formatCHF(inputs.totalProfit)}</strong></div>
                    <div className="flex justify-between text-muted-foreground"><span>− Réserve cible</span><span className="tabular-nums">{formatCHF(inputs.reserveTarget ?? 0)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-border pt-1"><span>Disponible salaire + dividendes</span><strong className="tabular-nums text-primary">{formatCHF(availableProfit)}</strong></div>
                    {availableProfit <= 0 && (
                      <p className="mt-2 text-warning">⚠️ Réserve cible ≥ bénéfice total : aucune répartition possible.</p>
                    )}
                  </div>
                )}
                {headcount != null && headcount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Société comptant <strong className="text-foreground">{headcount}</strong> collaborateur(s) (ETP).
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Canton siège société"
                    value={inputs.companyCanton}
                    onChange={(v) => setField("companyCanton", v as SelectableCantonCode)}
                    wikiId="dirigeant"
                    wikiTip="Canton du siège : détermine l'impôt sur le bénéfice de la société (IS cantonal + IFD)."
                  />
                  <SelectField
                    label="Canton domicile dirigeant"
                    value={inputs.directorCanton}
                    onChange={(v) =>
                      setField("directorCanton", v as SelectableCantonCode)
                    }
                    wikiId="dirigeant"
                    wikiTip="Canton de domicile : détermine l'impôt personnel sur le salaire et le dividende perçus."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Situation civile
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
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <NumField
                    label="Enfants à charge"
                    value={inputs.children ?? 0}
                    onChange={(v) => setField("children", v)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Âge dirigeant"
                    value={inputs.age}
                    onChange={(v) => setField("age", v)}
                    wikiId="lpp-credits"
                    wikiTip="Détermine la tranche de bonification LPP (7 % / 10 % / 15 % / 18 %)."
                  />
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>Plan LPP</span>
                      <WikiTip articleId="lpp-coordination" tip="Obligatoire = plafond 90 720 CHF, taux légaux. Plan cadre / 1e = surobligatoire au choix de l'employeur, jusqu'à 900 000 CHF assurés." />
                    </Label>
                    <Select
                      value={inputs.lppPlan}
                      onValueChange={(v) => setField("lppPlan", v as LppPlanKind)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mandatory">LPP obligatoire</SelectItem>
                        <SelectItem value="executive_1e">Plan cadre / 1e</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <span>Participation qualifiée (≥ 10 %)</span>
                      <WikiTip articleId="dirigeant" tip="≥ 10 % du capital = imposition privilégiée des dividendes (RFFA) : 70 % imposable au fédéral, 50-70 % cantonal selon canton." />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Active l'imposition partielle des dividendes (RFFA).
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
              title="Stratégie personnalisée"
              description="Ajustez la répartition. Les 3 leviers font toujours 100 %."
            >
              <CustomStrategySliders value={custom} onChange={setCustom} />
            </CalcCard>

            <CalcCard
              title="Situation actuelle du client"
              description="Renseignez la rémunération réelle pour comparer avec les stratégies optimisées."
            >
              <Accordion type="single" collapsible defaultValue={hasCurrent ? "cur" : undefined}>
                <AccordionItem value="cur" className="border-b-0">
                  <AccordionTrigger className="py-2 text-sm">
                    {hasCurrent ? "Modifier la situation actuelle" : "Saisir la situation actuelle"}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Switch checked={hasCurrent} onCheckedChange={setHasCurrent} />
                      <span>Inclure la situation actuelle dans le comparatif</span>
                    </div>
                    <NumField
                      label="Salaire brut actuel (CHF/an)"
                      value={current.grossSalary}
                      onChange={(v) => setCurrent((p) => ({ ...p, grossSalary: v }))}
                    />
                    <NumField
                      label="Dividendes actuels (CHF/an)"
                      value={current.dividends}
                      onChange={(v) => setCurrent((p) => ({ ...p, dividends: v }))}
                    />
                    <NumField
                      label="Réserves laissées en société (CHF/an, optionnel)"
                      value={current.retained ?? 0}
                      onChange={(v) => setCurrent((p) => ({ ...p, retained: v || undefined }))}
                      hint="Laissez vide pour calcul automatique."
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
              title="Comparatif des stratégies"
              description="Mode réaliste : les dividendes sont cappés au bénéfice net après IS si nécessaire."
            >
              <ComparisonTable
                results={tableResults}
                bestLabel={recommendation.best.strategy.label}
                currentLabel={currentResult?.strategy.label}
              />
            </CalcCard>

            <CalcCard
              title="Visualisation : répartition du bénéfice"
              description="Pour chaque stratégie : impôts & cotisations, net dirigeant, réserves société."
            >
              <ComparisonChart results={tableResults} />
            </CalcCard>
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
  // Slider principal : salaire vs reste (dividendes + réserves).
  // Sous-slider : dans le "reste", part dividendes vs réserves.
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
            Part « salaire » (coût total société)
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Le pourcentage « salaire » représente le <strong>coût total société</strong> (salaire
                brut + charges sociales employeur). Exemple : 70 % sur 200 000 CHF de bénéfice =
                140 000 CHF de coût salarial total, soit ~124 000 CHF de salaire brut versé +
                ~16 000 CHF de charges sociales employeur.
              </TooltipContent>
            </Tooltip>
          </Label>
          <span className="text-sm font-semibold tabular-nums">{salaryPct.toFixed(0)} %</span>
        </div>
        <Slider
          value={[salaryPct]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => setSalary(v)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm font-medium">
            Du restant ({remainder.toFixed(0)} %), part « dividendes »
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
          <div className="text-[10px] uppercase text-muted-foreground">Salaire</div>
          <div className="font-semibold">{value.salaryPct.toFixed(0)} %</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Dividendes</div>
          <div className="font-semibold">{value.dividendPct.toFixed(0)} %</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            Réserves
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Part du bénéfice net (après impôt société) <strong>laissée dans la société</strong>{" "}
                au lieu d'être versée au dirigeant. Elle alimente les fonds propres (réserves
                légales ou libres) et reste mobilisable plus tard : auto financement, achat de
                matériel, dividendes futurs, vente de la société, etc. Aucun impôt sur le revenu
                pour le dirigeant tant qu'elle reste en société.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="font-semibold">{value.retainedPct.toFixed(0)} %</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Présets</div>
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
  const currentRow = currentLabel
    ? results.find((r) => r.strategy.label === currentLabel)
    : undefined;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stratégie</TableHead>
            <TableHead className="text-right">Salaire brut</TableHead>
            <TableHead className="text-right">IS société</TableHead>
            <TableHead className="text-right">Dividendes</TableHead>
            <TableHead className="text-right">Impôt revenu</TableHead>
            <TableHead className="text-right">Réserves</TableHead>
            <TableHead className="text-right font-bold">Net dirigeant</TableHead>
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
                        <Badge variant="outline" className="text-[10px]">Actuel</Badge>
                      )}
                      {isBest && (
                        <Badge variant="secondary" className="bg-success/15 text-success-foreground text-[10px]">
                          <Sparkles className="mr-1 h-3 w-3" /> Recommandée
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Effectif : {eff.s.toFixed(0)}/{eff.d.toFixed(0)}/{eff.rr.toFixed(0)}
                      {adjusted && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 cursor-help text-warning">
                              (ajusté)
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            La répartition demandée impliquait{" "}
                            {formatCHF(r.company.dividendsTargeted)} de dividendes,
                            mais le bénéfice net après impôt société ne permet que{" "}
                            {formatCHF(r.company.dividendsPaid)}. Le delta a été
                            absorbé par les charges et l'IS.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCHF(r.company.grossSalary)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCHF(r.company.corporateTax)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCHF(r.company.dividendsPaid)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCHF(r.director.totalIncomeTax)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCHF(r.retainedInCompany)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCHF(r.directorNet)}
                </TableCell>
              </TableRow>
            );
          })}
          {currentRow && (
            <TableRow className="border-t-2 border-primary/30 bg-primary/5">
              <TableCell className="text-xs font-semibold uppercase text-muted-foreground">
                Δ vs actuel
              </TableCell>
              <TableCell colSpan={6} className="text-[11px] text-muted-foreground">
                Net dirigeant actuel : {formatCHF(currentRow.directorNet)}. Détail des écarts ci-dessous.
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
  const data = results.map((r) => ({
    name: r.strategy.label ?? "",
    "Impôts & cotisations": Math.round(r.totalTaxAndCharges),
    "Net dirigeant": Math.round(r.directorNet),
    "Réserves société": Math.round(r.retainedInCompany),
  }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
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
          <Bar dataKey="Impôts & cotisations" stackId="a" fill="var(--destructive)">
            {data.map((_, i) => (
              <Cell key={i} fill="var(--destructive)" />
            ))}
          </Bar>
          <Bar dataKey="Net dirigeant" stackId="a" fill="var(--success, var(--primary))" />
          <Bar dataKey="Réserves société" stackId="a" fill="var(--primary)" />
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
            Stratégie recommandée
          </div>
          <h3 className="mt-0.5 text-xl font-semibold">{best.strategy.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MoneyTile label="Net dirigeant" value={best.directorNet} tone="success" big tip="Cash net qui reste au dirigeant après cotisations sociales et impôt sur le revenu." />
        <MoneyTile label="Salaire brut" value={best.company.grossSalary} tone="default" tip="Salaire brut versé par la société (avant cotisations sociales et impôts)." />
        <MoneyTile label="Dividendes" value={best.company.dividendsPaid} tone="primary" tip="Montant brut versé en dividendes au dirigeant (avant imposition partielle)." />
        <MoneyTile label="Réserves" value={best.retainedInCompany} tone="default" tip="Bénéfice net après IS conservé dans la société (renforce les fonds propres, pas imposé chez le dirigeant)." />
      </div>
      {current && (
        <div className="mt-5 rounded-xl border border-primary/30 bg-card/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            💡 Recommandation pour {clientName ?? "ce dirigeant"}
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            Passer de la situation actuelle (salaire {formatCHF(current.company.grossSalary)} / dividendes {formatCHF(current.company.dividendsPaid)})
            à la stratégie <strong>{best.strategy.label}</strong> (salaire {formatCHF(best.company.grossSalary)} / dividendes {formatCHF(best.company.dividendsPaid)}) permettrait :
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DeltaTile label="Économie fiscale annuelle" value={current.totalTaxAndCharges - best.totalTaxAndCharges} positiveIsGood />
            <DeltaTile label="Net dirigeant supplémentaire / an" value={best.directorNet - current.directorNet} positiveIsGood />
            <DeltaTile label="Cumul sur 10 ans" value={(best.directorNet - current.directorNet) * 10} positiveIsGood />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            ⚠️ Recommandation INDICATIVE. Vérifier avec un fiscaliste les contraintes spécifiques (salaire usuel pour la branche, historique fiscal, statut LPP, etc.).
          </p>
        </div>
      )}
      {lowSalaryWarning && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <strong>Attention théorie du dividende dissimulé.</strong> La part salaire
            ({(salaryRatio * 100).toFixed(0)} % du bénéfice) est inférieure à 50 %.
            L'AFC peut requalifier une partie des dividendes en salaire si la
            rémunération n'est pas conforme à l'usage de la branche.
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
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-primary">
        Calcul lié
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
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <strong className="text-foreground">Avertissement.</strong> Les résultats
          sont des <strong>estimations indicatives</strong> basées sur les paramètres
          fiscaux et sociaux 2024-2026 (à reconfirmer pour le millésime fiscal final).
          Les multiplicateurs communaux utilisés sont ceux du chef-lieu cantonal :
          la précision communale exacte sera disponible dans une prochaine version.
          Ce calcul ne remplace pas l'analyse d'un expert fiscal ou d'une fiduciaire.
          Les notions de <em>salaire usuel</em>, <em>dividende dissimulé</em> et{" "}
          <em>participation qualifiée</em> dépendent de l'appréciation de l'AFC et
          du canton.
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
      good ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-base font-semibold tabular-nums", good ? "text-success-foreground" : "text-destructive")}>
        {positive ? "+" : ""}{formatCHF(value)}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
