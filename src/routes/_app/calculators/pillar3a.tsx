import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import {
  pillar3aMaxContribution,
  pillar3aTaxSavings,
  projectPillar3a,
  staggeredWithdrawal,
} from "@/lib/pillar3";
import { CalcCard, MoneyTile, Row, InfoLabel } from "@/components/calculators/CalcUI";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportPillar3aPdf } from "@/lib/pdf/reports";
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

export const Route = createFileRoute("/_app/calculators/pillar3a")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "3e pilier A & B · SwissBroker Pro" }] }),
  component: Pillar3aCalc,
});

function Pillar3aCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "pillar3a");
  const [form, setForm] = useState({
    hasLPP: true,
    netSelfEmploymentIncome: 0,
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    grossSalary: 100_000,
    contribution: 7258,
    currentBalance: 50_000,
    yearsToRetirement: 25,
    expectedReturn: 2.5,
    withdrawalCapital: 250_000,
    withdrawalAccounts: 3,
    // 3e pilier B (libre, non déductible)
    pillar3bYearly: 3_000,
    pillar3bCurrent: 0,
    pillar3bYears: 25,
    pillar3bReturn: 2.0,
  });
  useHydrateFormFromPrefill(prefill, setForm);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const max = pillar3aMaxContribution({
    hasLPP: form.hasLPP,
    netSelfEmploymentIncome: form.netSelfEmploymentIncome,
  });

  const savings = useMemo(
    () =>
      pillar3aTaxSavings({
        contribution: form.contribution,
        taxInput: {
          canton: form.canton,
          status: form.status,
          grossSalary: form.grossSalary,
        },
      }),
    [form],
  );

  const projection = useMemo(
    () =>
      projectPillar3a({
        currentBalance: form.currentBalance,
        yearlyContribution: form.contribution,
        years: form.yearsToRetirement,
        expectedReturnRate: form.expectedReturn,
      }),
    [form],
  );

  const stag = useMemo(
    () =>
      staggeredWithdrawal({
        totalCapital: form.withdrawalCapital,
        numberOfAccounts: form.withdrawalAccounts,
        canton: form.canton,
        status:
          form.status === "single_with_children" ? "single_with_children" : form.status,
      }),
    [form],
  );

  const { user } = useAuth();
  const handleExport = () =>
    exportPillar3aPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      taxSavings: savings,
      projection,
      staggered: stag,
    });

  // Projection 3e pilier B (libre, non déductible mais souvent exonéré à la sortie)
  const projection3b = useMemo(() => {
    const r = form.pillar3bReturn / 100;
    let balance = form.pillar3bCurrent;
    for (let i = 0; i < form.pillar3bYears; i++) {
      balance = balance * (1 + r) + form.pillar3bYearly;
    }
    const totalContrib = form.pillar3bYearly * form.pillar3bYears;
    return {
      finalBalance: Math.round(balance),
      totalContributions: totalContrib,
      totalReturns: Math.round(balance - form.pillar3bCurrent - totalContrib),
    };
  }, [form.pillar3bCurrent, form.pillar3bReturn, form.pillar3bYears, form.pillar3bYearly]);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideSteps: GuideStep[] = [
    { title: "Bienvenue dans le calculateur 3e pilier", body: "Compare l'effet du 3a (lié, déductible, sortie limitée) et du 3b (libre, fiscalisé, souple)." },
    { title: "Plafonds 3a 2026", body: "7 258 CHF pour salariés affiliés LPP, 36 288 CHF pour indépendants sans LPP (max 20 % du revenu)." },
    { title: "Hypothèses", body: "Rendement, durée et tranche marginale d'imposition pour estimer l'économie fiscale annuelle." },
    { title: "3e pilier B", body: "Versement libre, retrait à tout moment, mais primes non déductibles. Intéressant pour défiscaliser via assurance-vie ou compléter le 3a saturé." }
  ];



  return (
    <div className="space-y-6">
      <GuideMode open={guideOpen} onClose={() => setGuideOpen(false)} steps={guideSteps} title="Guide 3e pilier" />
      <div className="flex justify-end"><GuideToggleButton onClick={() => setGuideOpen(true)} /></div>


      {client && <ClientLinkBanner client={client} />}

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="font-semibold">3e pilier en Suisse : deux régimes complémentaires</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Pilier 3a (lié)</div>
            <p className="mt-1 text-xs text-muted-foreground">Cotisations <strong>déductibles du revenu imposable</strong> (max 7'258 CHF avec LPP, 36'288 CHF indépendant). Capital bloqué jusqu'à 5 ans avant l'âge AVS. Imposé à taux réduit au retrait.</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Pilier 3b (libre)</div>
            <p className="mt-1 text-xs text-muted-foreground">Épargne libre : assurance-vie, compte épargne, fonds. <strong>Pas de déduction</strong> à l'entrée mais aucun plafond, capital disponible à tout moment, et retrait <strong>généralement exonéré</strong> d'impôt sur le revenu.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title="Cotisation 3a annuelle" description="Plafond 2026 : 7'258 CHF (LPP) ou 36'288 CHF (indépendant).">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.hasLPP} onCheckedChange={(v) => set("hasLPP", Boolean(v))} />
                Affilié à une caisse LPP
              </label>
              {!form.hasLPP && (
                <NumField
                  label="Revenu net indépendant"
                  value={form.netSelfEmploymentIncome}
                  onChange={(v) => set("netSelfEmploymentIncome", v)}
                />
              )}
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
              <NumField label="Salaire brut annuel" value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
              <NumField label={`Cotisation versée (max ${max.toLocaleString("fr-CH")})`} value={form.contribution} onChange={(v) => set("contribution", Math.min(v, max))} />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Économie fiscale immédiate">
            <Row>
              <MoneyTile label="Économie d'impôt" value={savings.taxSavings} tone="success" big tip="Impôt fédéral + cantonal + communal économisé grâce à la déduction." />
              <MoneyTile label="Coût net" value={savings.effectiveCost} tone="primary" tip="Cotisation versée moins l'économie d'impôt. Effort réel d'épargne." />
            </Row>
            <p className="mt-2 text-xs text-muted-foreground">
              Taux marginal estimé : <strong>{savings.marginalRate.toFixed(1)} %</strong>
            </p>
          </CalcCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CalcCard title="Projection capital 3a">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Solde actuel" value={form.currentBalance} onChange={(v) => set("currentBalance", v)} />
            <NumField label="Années jusqu'à retrait" value={form.yearsToRetirement} onChange={(v) => set("yearsToRetirement", v)} />
            <NumField label="Rendement net (%/an)" value={form.expectedReturn} onChange={(v) => set("expectedReturn", v)} step={0.1} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyTile label="Capital final" value={projection.finalBalance} tone="primary" big tip="Solde estimé à la date du retrait, intérêts composés inclus." />
            <MoneyTile label="Cotisations cumulées" value={projection.totalContributions} tip="Somme totale des versements effectués sur la période." />
            <MoneyTile label="Intérêts cumulés" value={projection.totalReturns} tone="success" tip="Performance générée par la capitalisation composée." />
          </div>
        </CalcCard>
        <CalcCard title="Retrait étalé sur plusieurs comptes" description="3 à 5 comptes 3a permettent d'éclater l'imposition.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Capital total à retirer" value={form.withdrawalCapital} onChange={(v) => set("withdrawalCapital", v)} />
            <NumField label="Nombre de comptes" value={form.withdrawalAccounts} onChange={(v) => set("withdrawalAccounts", v)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyTile label="Impôt si retrait unique" value={stag.totalTaxSingle} tone="warning" tip="Tout le capital retiré la même année : barème progressif appliqué d'un coup." />
            <MoneyTile label="Impôt si fractionné" value={stag.totalTaxSeparated} tone="primary" tip="Capital divisé en N retraits sur années différentes : chaque tranche imposée séparément à taux plus bas." />
            <MoneyTile label="Économie" value={stag.savings} tone="success" big tip="Différence entre les deux scénarios. Gain fiscal de la stratégie." />
            <MoneyTile label="Par compte" value={stag.perAccount} tip="Montant moyen par compte 3a." />
          </div>
        </CalcCard>
      </div>

      <CalcCard
        title="3e pilier B (libre)"
        description="Épargne libre, sans plafond ni blocage. Pas de déduction fiscale, mais retrait souvent exonéré."
        tip="Le 3b regroupe assurance-vie mixte, compte épargne, fonds libres. Utile pour épargner au-delà du 3a, financer un projet avant la retraite, ou compléter une planification successorale."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumField label="Capital actuel 3b" value={form.pillar3bCurrent} onChange={(v) => set("pillar3bCurrent", v)} />
              <NumField label="Versement annuel" value={form.pillar3bYearly} onChange={(v) => set("pillar3bYearly", v)} />
              <NumField label="Durée (années)" value={form.pillar3bYears} onChange={(v) => set("pillar3bYears", v)} />
              <NumField label="Rendement net (%/an)" value={form.pillar3bReturn} onChange={(v) => set("pillar3bReturn", v)} step={0.1} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pas de déduction fiscale, mais capital disponible à tout moment et retrait
              normalement exonéré d'impôt sur le revenu (selon produit et durée).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyTile label="Capital final 3b" value={projection3b.finalBalance} tone="primary" big tip="Capital estimé après capitalisation composée." />
            <MoneyTile label="Versements cumulés" value={projection3b.totalContributions} tip="Total des primes ou versements effectués." />
            <MoneyTile label="Intérêts cumulés" value={projection3b.totalReturns} tone="success" tip="Performance brute du placement." />
            <MoneyTile label="Total 3a + 3b projeté" value={projection.finalBalance + projection3b.finalBalance} tone="success" tip="Vue consolidée du 3e pilier à la sortie." />
          </div>
        </div>
      </CalcCard>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="pillar3a"
          inputs={form}
          summary={{
            taxSavings: savings.taxSavings,
            effectiveCost: savings.effectiveCost,
            marginalRate: savings.marginalRate,
            finalBalance: projection.finalBalance,
            totalContributions: projection.totalContributions,
            totalReturns: projection.totalReturns,
            staggeredSavings: stag.savings,
          }}
          defaultTitle={`3a ${form.canton} · ${form.contribution} CHF/an`}
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
