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
import { Calculator, Info, RotateCcw, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { projectLPP, simulateBuybackPlan, computeLppInsuredSalary } from "@/lib/lpp";
import { LPP_2026 } from "@/lib/lpp/parameters-2026";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
const fmtCHF = formatCHF;
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportLppPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { WikiTip } from "@/components/calculators/WikiTip";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/lpp")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "LPP & rachats · SwissBroker Pro" }] }),
  component: LppCalc,
});

function LppCalc() {
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
    // rachat
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    buybackCapacity: 60_000,
    buybackYears: 3,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const [insuredSalaryManual, setInsuredSalaryManual] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Auto-recalcul du salaire assuré quand brut/plafond changent (sauf mode manuel)
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

  const projection = useMemo(
    () =>
      projectLPP({
        ...form,
        yearlyBuyback: Math.round(form.buybackCapacity / Math.max(1, form.buybackYears)),
        buybackYears: form.buybackYears,
        insuredSalaryCap: form.insuredSalaryCap,
      }),
    [form],
  );
  const buybackPlan = useMemo(
    () =>
      simulateBuybackPlan({
        buybackCapacity: form.buybackCapacity,
        years: Math.max(1, form.buybackYears),
        taxInput: {
          canton: form.canton,
          status: form.status,
          grossSalary: form.grossSalary,
          children: form.children,
        },
      }),
    [form],
  );

  const { user } = useAuth();
  const handleExport = () =>
    exportLppPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      projection,
      buybackPlan,
    });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue dans le calculateur LPP", body: "Ce mode guide vous présente les étapes pour projeter votre 2e pilier et planifier vos rachats." },
    { title: "Données personnelles", body: "Saisissez âge actuel, âge de retraite et avoir LPP actuel (visible sur votre certificat de prévoyance)." },
    { title: "Salaire et salaire assuré", body: "Le salaire assuré LPP correspond au salaire AVS moins la déduction de coordination (plafonné à 90 720 CHF en 2026)." },
    { title: "Hypothèses de projection", body: "Rendement attendu (typiquement 1.25 à 2 %), frais TER, croissance salariale. Restez conservateur." },
    { title: "Plan de rachat", body: "Renseignez votre capacité de rachat (visible sur le certificat) et la durée souhaitée pour étaler l'économie fiscale." },
    { title: "Résultats", body: "Capital projeté, rente mensuelle et économies fiscales totales liées aux rachats." }
  ];



  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide LPP" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <ClientLinkBanner client={client} />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title="Projection capital LPP" description="Bonifications légales + rendement net (taux − frais) + rachats annuels.">
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
              <NumField label="Âge actuel" value={form.currentAge} onChange={(v) => set("currentAge", v)} />
              <NumField label="Âge retraite" value={form.retirementAge} onChange={(v) => set("retirementAge", v)} />
              <NumField label="Avoir LPP actuel (CHF)" value={form.currentBalance} onChange={(v) => set("currentBalance", v)} />
              <NumField label="Rendement brut (%/an)" value={form.expectedReturnRate} onChange={(v) => set("expectedReturnRate", v)} step={0.1} />
              <NumField label="Frais TER + admin (%/an)" value={form.feeRate} onChange={(v) => set("feeRate", v)} step={0.05} />
              <NumField label="Croissance salariale (%/an)" value={form.salaryGrowthRate} onChange={(v) => set("salaryGrowthRate", v)} step={0.1} />
              <NumField label="Taux conversion à la retraite (%)" value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} />
              <NumField label="Bonifications surobligatoires (%)" value={form.extraCreditRate} onChange={(v) => set("extraCreditRate", v)} step={0.5} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Rendement net effectif appliqué : <strong>{projection.netReturnRate.toFixed(2)}%</strong> par an.
            </p>
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed text-foreground/80">
              <p className="font-semibold text-foreground">📘 Note pédagogique : plan LPP standard vs cadre</p>
              <p className="mt-1">
                Par défaut le calcul applique le <strong>minimum légal LPP</strong> :
                rendement <strong>1.25 %</strong> (taux min. 2026), plafond salaire
                assuré <strong>90 720 CHF</strong>, taux conversion <strong>6.8 %</strong>.
                Pour un profil <strong>cadre / plan 1e</strong>, ajustez : bonifications
                surobligatoires <strong>5–10 %</strong>, plafond élargi (jusqu'à
                ~860 000 CHF), rendement réel de la caisse.
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Source : paramètres LPP 2026 publiés par l'Office fédéral des assurances
                sociales (OFAS).
              </p>
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Résultat à la retraite">
            <Row>
              <MoneyTile
                label="Capital projeté (avec rendement)"
                value={projection.projectedBalance}
                hint="Bonifications + intérêts nets + rachats"
                tone="primary"
                big
              />
              <MoneyTile
                label="Rente annuelle estimée"
                value={projection.annualPension}
                hint={`Taux conversion ${form.conversionRate}%`}
                tone="success"
              />
            </Row>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label="Rente mensuelle" value={projection.monthlyPension} tone="default" tip="Rente mensuelle estimée à l'âge de référence." />
              <MoneyTile
                label="Capital sans rendement (référence)"
                value={projection.projectedBalanceNoYield}
                hint={`+${formatCHF(projection.projectedBalance - projection.projectedBalanceNoYield)} grâce au rendement`}
                tone="default"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label="Frais cumulés" value={projection.totalFees} tone="warning" tip="Total des frais TER + administration prélevés sur la durée." />
              <MoneyTile label="Rachats injectés" value={projection.totalBuybacks} tone="default" tip="Total des rachats LPP versés sur la période." />
            </div>
          </CalcCard>
        </div>
      </div>

      <CalcCard title="Évolution du capital LPP" description="Capital net (rendement − frais), capital sans rendement, et part des intérêts.">
        <div className="h-72 w-full chart-rise">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection.yearly}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatCHF(v)}
              />
              <RLine type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2.5} dot={false} name="Capital net" />
              <RLine type="monotone" dataKey="balanceNoYield" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Sans rendement" />
              <RLine type="monotone" dataKey="interest" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} name="Intérêts nets" />
              <RLine type="monotone" dataKey="fees" stroke="var(--destructive)" strokeWidth={1.5} dot={false} name="Frais" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CalcCard>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title="Plan de rachat LPP" description="Étalez vos rachats pour maximiser l'effet progressif.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Canton</Label>
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
                <Label className="text-xs font-medium text-muted-foreground">Situation civile</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as IncomeTaxInput["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Célibataire</SelectItem>
                    <SelectItem value="married">Marié·e</SelectItem>
                    <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => set("children", v)} />
              <NumField label="Capacité de rachat (CHF)" value={form.buybackCapacity} onChange={(v) => set("buybackCapacity", v)} />
              <NumField label="Étaler sur (années)" value={form.buybackYears} onChange={(v) => set("buybackYears", v)} />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Économie fiscale">
            <Row>
              <MoneyTile label="Économie totale" value={buybackPlan.totalTaxSavings} tone="success" big tip="Somme des économies fiscales sur toute la durée du plan." />
              <MoneyTile label="Versement / an" value={buybackPlan.yearlyAmount} tip="Versement annuel moyen pour atteindre l'objectif sur la durée choisie." />
            </Row>
            <p className="mt-2 text-xs text-muted-foreground">
              Retour fiscal moyen : <strong>{buybackPlan.averageReturn}%</strong> du capital racheté.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              {buybackPlan.yearly.map((y) => (
                <div key={y.year} className="flex items-center justify-between border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
                  <span className="text-muted-foreground">Année {y.year}</span>
                  <span className="tabular-nums text-success-foreground">
                    {formatCHF(y.taxSavings)}
                  </span>
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
        Salaire inférieur au seuil d'entrée LPP ({fmtCHF(ENTRY)}). Affiliation LPP non obligatoire.
      </span>
    );
  } else if (capped) {
    recap = (
      <>
        {fmtCHF(grossSalary)} − {fmtCHF(COORD)} = {fmtCHF(rawDiff)},{" "}
        <span className="font-semibold">plafonné à {fmtCHF(insuredSalaryCap)}</span>
      </>
    );
  } else {
    recap = (
      <>
        {fmtCHF(grossSalary)} − {fmtCHF(COORD)} = <span className="font-semibold">{fmtCHF(Math.max(MIN_COORD, rawDiff))}</span>{" "}
        (sous plafond {fmtCHF(insuredSalaryCap)})
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Salaire assuré LPP
        </div>

        {/* ZONE 1 — Input primaire */}
        <NumField
          label="Salaire brut annuel total (CHF)"
          value={grossSalary}
          onChange={onGrossChange}
        />

        {/* ZONE 2 — Constantes */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              Déduction coordination 2026
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent>Constante OFAS, non modifiable.</TooltipContent>
              </UiTooltip>
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">{fmtCHF(COORD)}</div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              Plafond salaire assuré
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Régime obligatoire pur. À ajuster si plan cadres (132'300) ou plan 1e
                  (réservé aux salaires {">"} 132'300, plafond modulé selon le plan).
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
              Salaire coord. minimum
              <UiTooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent>Plancher OFAS 2026.</TooltipContent>
              </UiTooltip>
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">{fmtCHF(MIN_COORD)}</div>
          </div>
        </div>

        {/* ZONE 3 — Output */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Salaire assuré (CHF)
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
                {isManual ? "Manuel" : "Auto"}
              </span>
              {isManual && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={onRecalcAuto}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Recalculer auto
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
            Calculé automatiquement à partir du salaire brut, de la déduction de
            coordination et du plafond. Modifiable pour plans surobligatoires ou règles
            spécifiques.
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-foreground/80">{recap}</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
