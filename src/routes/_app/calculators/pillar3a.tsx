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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import {
  pillar3aMaxContribution,
  pillar3aTaxSavings,
  projectPillar3a,
  staggeredWithdrawal,
} from "@/lib/pillar3";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportPillar3aPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/calculators/pillar3a")({
  head: () => ({ meta: [{ title: "Pilier 3a · SwissBroker Pro" }] }),
  component: Pillar3aCalc,
});

function Pillar3aCalc() {
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
  });

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
        <div className="space-y-4 lg:col-span-2">
          <CalcCard title="Économie fiscale immédiate">
            <Row>
              <MoneyTile label="Économie d'impôt" value={savings.taxSavings} tone="success" big />
              <MoneyTile label="Coût net" value={savings.effectiveCost} tone="primary" />
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
            <MoneyTile label="Capital final" value={projection.finalBalance} tone="primary" big />
            <MoneyTile label="Cotisations cumulées" value={projection.totalContributions} />
            <MoneyTile label="Intérêts cumulés" value={projection.totalReturns} tone="success" />
          </div>
        </CalcCard>
        <CalcCard title="Retrait étalé sur plusieurs comptes" description="3 à 5 comptes 3a permettent d'éclater l'imposition.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Capital total à retirer" value={form.withdrawalCapital} onChange={(v) => set("withdrawalCapital", v)} />
            <NumField label="Nombre de comptes" value={form.withdrawalAccounts} onChange={(v) => set("withdrawalAccounts", v)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyTile label="Impôt si retrait unique" value={stag.totalTaxSingle} tone="warning" />
            <MoneyTile label="Impôt si fractionné" value={stag.totalTaxSeparated} tone="primary" />
            <MoneyTile label="Économie" value={stag.savings} tone="success" big />
            <MoneyTile label="Par compte" value={stag.perAccount} />
          </div>
        </CalcCard>
      </div>
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
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
