import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Info, Sparkles, AlertTriangle } from "lucide-react";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getComparableCantons,
  getSelectableCantons,
  type SelectableCantonCode,
} from "@/lib/swiss/cantons";
import { capitalWithdrawalTax } from "@/lib/lpp";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput, Regime } from "@/lib/tax-global/types";
import { CalcCard } from "@/components/calculators/CalcUI";
import { SplitCompareLayout, type SplitRow } from "@/components/calculators/SplitCompareLayout";
import { formatCHF } from "@/lib/format";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportCantonComparePdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { useT } from "@/contexts/LanguageContext";
import { useClientDashboard } from "@/hooks/use-client-dashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Client,
  ClientPension,
  ClientAssets,
} from "@/lib/clients/types";
import { toTaxGlobalInput } from "@/lib/clients/to-calculator-input";

const ZG_CODE = "ZG";
const SZ_CODE = "SZ";
const REFERENCE_CODES: ReadonlySet<string> = new Set([ZG_CODE, SZ_CODE]);

import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/canton-compare")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Comparateur cantonal · SwissBroker Pro" }] }),
  component: CantonCompareCalc,
});

type Row = {
  code: string;
  name: string;
  total: number;
  effective: number;
  regimeLabel: string;
  regime: Regime;
  isReference: boolean;
};

type CompareMode = "annual" | "lump_sum";

const REGIME_SHORT: Record<Regime, string> = {
  resident_ordinary: "Taxation ordinaire",
  source_taxed: "Impôt à la source",
  tou: "Quasi-résident (TOU)",
  cross_border_ge: "Frontalier · IS Genève",
  cross_border_fr_1983: "Frontalier · accord 1983",
  cross_border_other: "Frontalier · IS canton + impôt résidence",
  unknown: "Régime à préciser",
};

/** Lieu d'imposition réel selon le régime, pour clarifier où l'impôt est dû. */
function placeOfTaxation(regime: Regime): { flag: string; label: string } {
  switch (regime) {
    case "cross_border_fr_1983":
      return { flag: "🇫🇷", label: "Imposition France" };
    case "cross_border_ge":
      return { flag: "🇨🇭+🇫🇷", label: "IS CH + résidu FR" };
    case "cross_border_other":
      return { flag: "🇨🇭+🌍", label: "IS CH + impôt résidence" };
    case "resident_ordinary":
    case "source_taxed":
    case "tou":
      return { flag: "🇨🇭", label: "Imposition CH" };
    default:
      return { flag: "❔", label: "À préciser" };
  }
}

function CantonCompareCalc() {
  const t = useT();
  const { clientId } = Route.useSearch();
  const { client } = usePrefillFromClient(clientId, "canton-compare");
  const selectable = getSelectableCantons();
  const comparable = getComparableCantons();

  const { data: bundle } = useQuery({
    enabled: !!clientId,
    queryKey: ["client-bundle-canton-compare", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const [c, p, a] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("client_pension").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("client_assets").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      return {
        client: c.data as Client,
        pension: (p.data ?? null) as ClientPension | null,
        assets: (a.data ?? null) as ClientAssets | null,
      };
    },
  });
  const dashboard = useClientDashboard(bundle ?? null);

  // ── État du formulaire : on s'aligne sur le moteur Fiscal Global pour
  //    garantir des chiffres identiques entre les deux écrans.
  const [base, setBase] = useState<TaxGlobalInput>(() => ({
    ...createDefaultInput(),
    canton: "VD",
  }));

  // Hydratation depuis la fiche client : on réutilise exactement le mapping
  // employé par le Fiscal Global → cohérence garantie.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated && bundle?.client) {
      const prefill = toTaxGlobalInput(bundle);
      setBase((prev) => {
        const next: TaxGlobalInput = { ...prev };
        for (const [k, v] of Object.entries(prefill)) {
          if (v !== undefined && v !== null && v !== "") {
            (next as unknown as Record<string, unknown>)[k] = v;
          }
        }
        return next;
      });
      setHydrated(true);
    }
  }, [bundle, hydrated]);

  const set = <K extends keyof TaxGlobalInput>(k: K, v: TaxGlobalInput[K]) =>
    setBase((f) => ({ ...f, [k]: v }));

  const [referenceCanton, setReferenceCanton] = useState<SelectableCantonCode>("VD");
  useEffect(() => {
    if (hydrated && base.canton) {
      setReferenceCanton(base.canton as SelectableCantonCode);
    }
  }, [hydrated, base.canton]);

  const [mode, setMode] = useState<CompareMode>("annual");

  // ──────────────────────────────────────────────────────────────────────
  // Mode lump_sum : impôt sur prestation en capital LPP/3a à la retraite.
  // Inchangé, barème séparé, ne dépend pas du régime fiscal courant.
  // ──────────────────────────────────────────────────────────────────────
  const lppFromFiche = dashboard?.lpp?.projectedCapitalAt65 ?? 0;
  const p3aFromFiche = dashboard?.pillar3a?.projectedCapitalAt65 ?? 0;
  const [lppCapitalOverride, setLppCapitalOverride] = useState<number | null>(null);
  const [p3aCapitalOverride, setP3aCapitalOverride] = useState<number | null>(null);
  useEffect(() => {
    if (lppCapitalOverride === null && lppFromFiche > 0) setLppCapitalOverride(lppFromFiche);
  }, [lppFromFiche, lppCapitalOverride]);
  useEffect(() => {
    if (p3aCapitalOverride === null && p3aFromFiche > 0) setP3aCapitalOverride(p3aFromFiche);
  }, [p3aFromFiche, p3aCapitalOverride]);
  const lppCapital = lppCapitalOverride ?? lppFromFiche;
  const p3aCapital = p3aCapitalOverride ?? p3aFromFiche;
  const projectedLPPCapital = Math.max(0, lppCapital + p3aCapital);
  const lppDivergesFromFiche =
    lppFromFiche > 0 && lppCapitalOverride !== null && lppCapitalOverride !== lppFromFiche;
  const p3aDivergesFromFiche =
    p3aFromFiche > 0 && p3aCapitalOverride !== null && p3aCapitalOverride !== p3aFromFiche;
  const resetLppFromFiche = () => setLppCapitalOverride(lppFromFiche);
  const resetP3aFromFiche = () => setP3aCapitalOverride(p3aFromFiche);
  const lumpSumStatus: "single" | "married" | "single_with_children" =
    base.civilStatus === "married" || base.civilStatus === "registered_partnership"
      ? "married"
      : base.children > 0
        ? "single_with_children"
        : "single";

  const data = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const c of comparable) {
      try {
        if (mode === "annual") {
          // ⚠️ Source de vérité = moteur Fiscal Global.
          // On ne change que le canton, le reste (régime, déductions,
          // bonus, 3a, fortune…) est identique au calculateur fiscal global.
          const r = computeTaxGlobal({ ...base, canton: c.code });
          rows.push({
            code: c.code,
            name: c.name,
            total: r.totalTaxCHF,
            effective: r.effectiveRate,
            regimeLabel: REGIME_SHORT[r.regime] ?? r.regimeLabel,
            regime: r.regime,
            isReference: REFERENCE_CODES.has(c.code),
          });
        } else {
          const tt = capitalWithdrawalTax({
            capital: projectedLPPCapital,
            canton: c.code,
            status: lumpSumStatus,
          });
          const effective =
            projectedLPPCapital > 0
              ? Math.round((tt.total / projectedLPPCapital) * 1000) / 10
              : 0;
          rows.push({
            code: c.code,
            name: c.name,
            total: tt.total,
            effective,
            regimeLabel: "Impôt sur prestation en capital (barème séparé)",
            regime: "resident_ordinary",
            isReference: REFERENCE_CODES.has(c.code),
          });
        }
      } catch (e) {
        console.warn(`[canton-compare] Calcul ignoré pour ${c.code}`, e);
      }
    }
    const romands = rows.filter((r) => !REFERENCE_CODES.has(r.code)).sort((a, b) => a.total - b.total);
    const refs = rows.filter((r) => REFERENCE_CODES.has(r.code)).sort((a, b) => a.total - b.total);
    return [...romands, ...refs];
  }, [base, comparable, mode, projectedLPPCapital, lumpSumStatus]);

  // Détecte les régimes hétérogènes (frontalier vs résident ordinaire selon
  // le canton choisi) pour avertir le courtier que la comparaison croise
  // plusieurs régimes fiscaux et pas seulement des barèmes cantonaux.
  const distinctRegimes = useMemo(() => {
    const s = new Set<Regime>();
    data.forEach((d) => s.add(d.regime));
    return Array.from(s);
  }, [data]);
  const heterogeneousRegimes = mode === "annual" && distinctRegimes.length > 1;

  // Groupe "accord 1983" : cantons frontaliers FR où l'impôt est dû en France
  // et donc identique d'un canton à l'autre.
  const accord1983Rows = useMemo(
    () => data.filter((d) => d.regime === "cross_border_fr_1983"),
    [data],
  );
  const accord1983Sample = accord1983Rows[0];
  const accord1983Identical =
    accord1983Rows.length >= 2 &&
    accord1983Rows.every((r) => r.total === accord1983Sample!.total);
  const hasGeFrontalier = data.some((d) => d.regime === "cross_border_ge");
  const showAccord1983Banner = mode === "annual" && accord1983Rows.length >= 2;
  const showGeFrontalierBanner =
    mode === "annual" && hasGeFrontalier && accord1983Rows.length >= 1;


  const referenceTax = data.find((d) => d.code === referenceCanton)?.total ?? 0;
  const cheapestRomand = useMemo(
    () =>
      data
        .filter((d) => !REFERENCE_CODES.has(d.code))
        .reduce<Row | null>((acc, r) => (!acc || r.total < acc.total ? r : acc), null),
    [data],
  );
  const romandsCount = data.filter((d) => !REFERENCE_CODES.has(d.code)).length;
  const hasReferences = data.some((d) => REFERENCE_CODES.has(d.code));

  const brokerHeader = useBrokerPdfHeader();
  const handleExport = () =>
    exportCantonComparePdf({
      header: brokerHeader,
      input: {
        grossSalary: base.grossSalary,
        spouseGrossSalary: base.spouseGrossSalary,
        status:
          base.civilStatus === "married" || base.civilStatus === "registered_partnership"
            ? "married"
            : base.children > 0
              ? "single_with_children"
              : "single",
        children: base.children,
        netWealth: base.netWealth,
        referenceCanton,
      },
      rows: data,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: t("calc.canton_compare.guide.s1.title"), body: t("calc.canton_compare.guide.s1.body") },
    { title: t("calc.canton_compare.guide.s2.title"), body: t("calc.canton_compare.guide.s2.body") },
    { title: t("calc.canton_compare.guide.s3.title"), body: t("calc.canton_compare.guide.s3.body") },
  ];

  const isCouple =
    base.civilStatus === "married" || base.civilStatus === "registered_partnership";

  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title={t("calc.canton_compare.guide.title")} />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>

      {client && <ClientLinkBanner client={client} />}

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            Les chiffres affichés ici sont calculés avec <strong>le même moteur que le calculateur Fiscal Global</strong>.
            Pour un même client, la ligne du canton actuel correspond au montant affiché dans le Fiscal Global.
          </p>
        </div>
      </div>

      {clientId && (
        <CalcCard title={t("calc.canton_compare.mode.title")}>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as CompareMode)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              htmlFor="mode-annual"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem id="mode-annual" value="annual" className="mt-1" />
              <div>
                <div className="text-sm font-medium">{t("calc.canton_compare.mode.annual")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("calc.canton_compare.mode.annual.desc")}
                </div>
              </div>
            </label>
            <label
              htmlFor="mode-lump-sum"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 aria-disabled:opacity-50"
              aria-disabled={projectedLPPCapital <= 0}
            >
              <RadioGroupItem
                id="mode-lump-sum"
                value="lump_sum"
                className="mt-1"
                disabled={projectedLPPCapital <= 0}
              />
              <div>
                <div className="text-sm font-medium">{t("calc.canton_compare.mode.lump")}</div>
                <div className="text-xs text-muted-foreground">
                  {projectedLPPCapital > 0
                    ? t("calc.canton_compare.mode.lump.has_capital", { amount: formatCHF(projectedLPPCapital) })
                    : t("calc.canton_compare.mode.lump.no_capital")}
                </div>
              </div>
            </label>
          </RadioGroup>
        </CalcCard>
      )}

      {clientId && mode === "lump_sum" && (
        <CalcCard
          title="Capitaux retirés à la retraite"
          description="L'impôt sur prestation en capital s'applique sur le total retiré (2e pilier + 3a) selon un barème séparé (1/5 du barème ordinaire fédéral + cantonal)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Capital LPP projeté à la retraite</Label>
              <BaseNumField value={String(lppCapital)} onChange={(v) => setLppCapitalOverride(Number(v) || 0)} suffix="CHF" />
              <p className="text-[11px] text-muted-foreground">
                {lppFromFiche > 0
                  ? `Source : Projection fiche client (rendement 1,25%, frais 0,6%, conversion 6,0%, sans rachats). Modifiable pour what-if.`
                  : "Aucune projection disponible : complétez l'avoir LPP dans la fiche client."}
                {lppDivergesFromFiche && (
                  <>
                    {" "}
                    <button type="button" onClick={resetLppFromFiche} className="underline hover:text-foreground">
                      Réinitialiser depuis la fiche ({formatCHF(lppFromFiche)})
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Capital 3e pilier A projeté</Label>
              <BaseNumField value={String(p3aCapital)} onChange={(v) => setP3aCapitalOverride(Number(v) || 0)} suffix="CHF" />
              <p className="text-[11px] text-muted-foreground">
                {p3aFromFiche > 0
                  ? "D'après la fiche client (versement annuel + solde existant, rendement 2%). Modifiable."
                  : "Aucun 3a renseigné en fiche. Saisissez la valeur si pertinent."}
                {p3aDivergesFromFiche && (
                  <>
                    {" "}
                    <button type="button" onClick={resetP3aFromFiche} className="underline hover:text-foreground">
                      Réinitialiser depuis la fiche ({formatCHF(p3aFromFiche)})
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Capital total imposable (LPP + 3a)</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatCHF(projectedLPPCapital)}</div>
          </div>
        </CalcCard>
      )}

      <CalcCard
        title={t("calc.canton_compare.profile.title")}
        description={
          mode === "lump_sum"
            ? t("calc.canton_compare.profile.desc.lump", { amount: formatCHF(projectedLPPCapital) })
            : "Profil identique à celui du Fiscal Global : on fait varier uniquement le canton."
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField label="Salaire brut annuel (CHF)" value={base.grossSalary} onChange={(v) => set("grossSalary", v)} wikiId="ifd-icc" wikiTip={t("calc.canton_compare.tip.gross")} />
          <NumField label="Bonus / 13e (CHF)" value={base.bonus} onChange={(v) => set("bonus", v)} />
          <NumField label="Autres revenus (CHF)" value={base.otherIncome} onChange={(v) => set("otherIncome", v)} />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">État civil</Label>
            <Select
              value={base.civilStatus}
              onValueChange={(v) => set("civilStatus", v as TaxGlobalInput["civilStatus"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Célibataire</SelectItem>
                <SelectItem value="married">Marié·e</SelectItem>
                <SelectItem value="registered_partnership">Partenariat enregistré</SelectItem>
                <SelectItem value="cohabiting">Concubinage</SelectItem>
                <SelectItem value="divorced">Divorcé·e</SelectItem>
                <SelectItem value="separated">Séparé·e</SelectItem>
                <SelectItem value="widowed">Veuf·ve</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCouple && (
            <NumField label="Salaire brut conjoint (CHF)" value={base.spouseGrossSalary} onChange={(v) => set("spouseGrossSalary", v)} />
          )}
          <NumField label="Enfants à charge" value={base.children} onChange={(v) => set("children", v)} />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Pays de résidence</Label>
            <Select value={base.countryOfResidence} onValueChange={(v) => set("countryOfResidence", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CH">🇨🇭 Suisse</SelectItem>
                <SelectItem value="FR">🇫🇷 France</SelectItem>
                <SelectItem value="IT">🇮🇹 Italie</SelectItem>
                <SelectItem value="DE">🇩🇪 Allemagne</SelectItem>
                <SelectItem value="AT">🇦🇹 Autriche</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Permis</Label>
            <Select value={base.permit} onValueChange={(v) => set("permit", v as TaxGlobalInput["permit"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="swiss">🇨🇭 Suisse</SelectItem>
                <SelectItem value="C">Permis C</SelectItem>
                <SelectItem value="B">Permis B</SelectItem>
                <SelectItem value="L">Permis L</SelectItem>
                <SelectItem value="G">Permis G (frontalier)</SelectItem>
                <SelectItem value="Ci">Permis Ci</SelectItem>
                <SelectItem value="F">Permis F</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <NumField label="3e pilier A annuel (CHF)" value={base.pillar3aContributions} onChange={(v) => set("pillar3aContributions", v)} />
          <NumField label="Fortune nette (CHF)" value={base.netWealth} onChange={(v) => set("netWealth", v)} wikiId="fortune" wikiTip={t("calc.canton_compare.tip.wealth")} />

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Canton de référence</Label>
            <Select value={referenceCanton} onValueChange={(v) => setReferenceCanton(v as SelectableCantonCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectable.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CalcCard>

      {heterogeneousRegimes && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p className="text-foreground/90">
            <strong>Régimes fiscaux différents selon le canton.</strong> Pour ce profil, certains cantons appliquent
            l'imposition à la source ou un régime frontalier (accord 1983, IS genevoise) alors que d'autres relèvent
            de la taxation ordinaire. Les écarts ne reflètent donc pas uniquement les barèmes cantonaux mais aussi
            la mécanique fiscale applicable. Le régime utilisé est indiqué dans l'infobulle de chaque canton.
          </p>
        </div>
      )}

      {showAccord1983Banner && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <span className="mt-0.5 text-base leading-none" aria-hidden>🇫🇷</span>
          <div className="space-y-1 text-foreground/90">
            <p>
              <strong>Régime frontalier (accord franco-suisse 1983).</strong>{" "}
              L'impôt est dû <strong>en France uniquement</strong> pour{" "}
              {accord1983Rows.map((r) => r.code).join(", ")}. Le canton suisse
              de travail ne change pas le montant
              {accord1983Identical && accord1983Sample
                ? `, d'où ${formatCHF(accord1983Sample.total)} (${accord1983Sample.effective}%) identique sur ces ${accord1983Rows.length} cantons.`
                : "."}
              {hasGeFrontalier && (
                <> Seul <strong>Genève</strong> prélève à la source en Suisse (IS + 4,5% rétrocédés à la France).</>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Pour une vraie comparaison cantonale (26 chiffres distincts), basculez « Pays de résidence » sur 🇨🇭 Suisse.
            </p>
          </div>
        </div>
      )}

      {showGeFrontalierBanner && !showAccord1983Banner && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <span className="mt-0.5 text-base leading-none" aria-hidden>🇨🇭</span>
          <p className="text-foreground/90">
            <strong>Frontalier Genève.</strong> Imposition à la source genevoise (IS)
            + résidu éventuel en France. Les autres cantons sont indiqués à titre comparatif
            (impôt français applicable au titre de l'accord 1983).
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p
          className="text-muted-foreground [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: t("calc.canton_compare.scope_notice.html") }}
        />
      </div>

      {(() => {
        const refRow = data.find((d) => d.code === referenceCanton);
        const zgRow = data.find((d) => d.code === ZG_CODE);
        if (!refRow || !zgRow || refRow.code === zgRow.code) return null;
        const rows: SplitRow[] = [
          {
            label: mode === "lump_sum" ? "Impôt sur prestation en capital" : "Impôt total annuel",
            current: refRow.total,
            projected: zgRow.total,
            betterWhen: "lower",
          },
          {
            label: "Taux effectif",
            current: refRow.effective / 100,
            projected: zgRow.effective / 100,
            format: "pct",
            betterWhen: "lower",
          },
          {
            label: "Régime fiscal",
            current: refRow.regimeLabel,
            projected: zgRow.regimeLabel,
            format: "text",
            betterWhen: "neutral",
          },
        ];
        const saving = refRow.total - zgRow.total;
        return (
          <SplitCompareLayout
            title={`Résidence (${refRow.code}) vs Canton optimisé (Zoug)`}
            description={
              mode === "lump_sum"
                ? `Comparaison de l'impôt sur un retrait en capital de ${formatCHF(refRow.total > 0 ? (refRow.total / refRow.effective) * 100 : 0)} environ. Domicile fiscal au moment du retrait requis pour bénéficier du canton.`
                : "Comparaison à profil identique : seul le canton de domicile change."
            }
            currentLabel={`Canton de résidence · ${refRow.code}`}
            projectedLabel="Canton optimisé · Zoug"
            currentSubtitle={refRow.name}
            projectedSubtitle="Référence basse fiscalité"
            rows={rows}
            summary={{
              annualSaving: saving,
              deltaPercent: refRow.total > 0 ? saving / refRow.total : 0,
              deltaLabel: "Économie d'impôt",
            }}
          />
        );
      })()}

      <CalcCard title={t("calc.canton_compare.ranking.title")}>
        <div className="h-[520px] w-full chart-rise">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 12, right: 32, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="code" width={56} tick={{ fontSize: 11, fill: "var(--foreground)" }} />
              <Tooltip
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={{ maxWidth: 320, zIndex: 50 }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  maxWidth: 320,
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                }}
                itemStyle={{ whiteSpace: "normal" }}
                labelStyle={{ whiteSpace: "normal" }}
                formatter={(v: number, _: string, props) => {
                  const p = props.payload as Row;
                  const place = placeOfTaxation(p.regime);
                  const label = `${p.name} · ${p.effective}% · ${p.regimeLabel} · ${place.flag} ${place.label}`;
                  return [formatCHF(v), label];
                }}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {data.map((d) => {
                  const isCheapest = cheapestRomand?.code === d.code;
                  const isRef = REFERENCE_CODES.has(d.code);
                  // ZG / SZ : couleur dédiée (accent) à pleine opacité, sinon
                  // ils ressortaient quasi blancs à 0.65 d'opacité.
                  const fill = isRef
                    ? "var(--accent)"
                    : isCheapest
                      ? "var(--success)"
                      : "var(--primary)";
                  return <Cell key={d.code} fill={fill} fillOpacity={1} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {hasReferences && (
          <div className="mt-3 flex flex-wrap items-start gap-2 rounded-md border border-dashed border-success/40 bg-success/5 p-2 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            <span className="font-semibold text-foreground shrink-0">ZG · Zoug · SZ · Schwyz</span>
            <span className="min-w-0 flex-1 text-muted-foreground break-words">
              Cantons à fiscalité avantageuse affichés en référence (hors 6 cantons romands principaux). Profil identique : {romandsCount} cantons romands comparés.
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <Legend color="var(--success)" label={t("calc.canton_compare.legend.cheapest")} />
          <Legend color="var(--primary)" label={t("calc.canton_compare.legend.romand")} />
          <Legend color="var(--accent)" label={t("calc.canton_compare.legend.zg")} />
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="canton_compare"
          inputs={{ ...base, referenceCanton }}
          summary={{
            cheapestCanton: cheapestRomand?.code,
            cheapestTax: cheapestRomand?.total,
            referenceCanton,
            referenceTax,
            maxSavings: Math.max(0, referenceTax - (cheapestRomand?.total ?? 0)),
          }}
          defaultTitle={`Comparateur Suisse romande · réf ${referenceCanton}`}
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
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {wikiId && wikiTip ? <WikiTip articleId={wikiId} tip={wikiTip} /> : null}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        suffix={suffix}
      />
    </div>
  );
}

function Legend({ color, label, opacity = 1 }: { color: string; label: string; opacity?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color, opacity }} />
      {label}
    </span>
  );
}
