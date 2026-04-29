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
import { Switch } from "@/components/ui/switch";
import { Info, CheckCircle2, AlertCircle, Scale } from "lucide-react";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { checkQuasiResident, compareTOUvsSource } from "@/lib/tax/tou";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { exportTouPdf } from "@/lib/pdf/reports";

export const Route = createFileRoute("/_app/calculators/tou")({
  head: () => ({ meta: [{ title: "TOU / quasi-résident · SwissBroker Pro" }] }),
  component: TOUCalc,
});

function TOUCalc() {
  const [form, setForm] = useState({
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    children: 0,
    grossSalary: 90_000,
    spouseGrossSalary: 0,
    bonus: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    healthInsurancePremiums: 0,
    sourceTaxAnnual: 13_500,
    worldwideIncome: 92_000,
    isEUEFTAResident: true,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const eligibility = useMemo(
    () =>
      checkQuasiResident({
        worldwideIncome: form.worldwideIncome,
        swissIncome: form.grossSalary + form.bonus,
        isEUEFTAResident: form.isEUEFTAResident,
      }),
    [form.worldwideIncome, form.grossSalary, form.bonus, form.isEUEFTAResident],
  );

  const comparison = useMemo(() => {
    const taxInput: IncomeTaxInput = {
      canton: form.canton,
      status: form.status,
      children: form.children,
      grossSalary: form.grossSalary,
      spouseGrossSalary: form.spouseGrossSalary,
      bonus: form.bonus,
      pillar3aContributions: form.pillar3aContributions,
      lppBuyback: form.lppBuyback,
      mortgageInterest: form.mortgageInterest,
      realEstateMaintenance: form.realEstateMaintenance,
      healthInsurancePremiums: form.healthInsurancePremiums,
    };
    return compareTOUvsSource({
      sourceTaxAnnual: form.sourceTaxAnnual,
      taxInput,
      eligible: eligibility.eligibleForTOU,
    });
  }, [form, eligibility.eligibleForTOU]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title="Éligibilité quasi-résident"
          description="Seuil légal : 90 % du revenu mondial gagné en Suisse."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Revenu mondial annuel (CHF)"
              value={form.worldwideIncome}
              onChange={(v) => set("worldwideIncome", v)}
            />
            <Field label="Résidence UE / AELE">
              <div className="flex h-10 items-center gap-3 rounded-md border border-input bg-muted/40 px-3">
                <Switch
                  checked={form.isEUEFTAResident}
                  onCheckedChange={(c) => set("isEUEFTAResident", c)}
                />
                <span className="text-sm">{form.isEUEFTAResident ? "Oui" : "Non"}</span>
              </div>
            </Field>
          </div>
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              eligibility.eligibleForTOU
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
            }`}
          >
            {eligibility.eligibleForTOU ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <div>
              <div className="font-semibold">
                {eligibility.swissShare}% du revenu mondial en Suisse
              </div>
              <div className="mt-0.5 opacity-90">{eligibility.recommendation}</div>
            </div>
          </div>
        </CalcCard>

        <CalcCard
          title="Situation fiscale"
          description="Renseignez les déductions effectives (3a, rachat LPP, intérêts hypothécaires…)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Canton">
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
            </Field>
            <Field label="Situation civile">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as IncomeTaxInput["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e</SelectItem>
                  <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField label="Enfants à charge" value={form.children} onChange={(v) => set("children", v)} />
            <NumField label="Salaire annuel (CHF)" value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
            <NumField label="Bonus (CHF)" value={form.bonus} onChange={(v) => set("bonus", v)} />
            <NumField label="IS retenue annuelle (CHF)" value={form.sourceTaxAnnual} onChange={(v) => set("sourceTaxAnnual", v)} />
            <NumField label="Cotisations 3a" value={form.pillar3aContributions} onChange={(v) => set("pillar3aContributions", v)} />
            <NumField label="Rachat LPP" value={form.lppBuyback} onChange={(v) => set("lppBuyback", v)} />
            <NumField label="Intérêts hypothécaires" value={form.mortgageInterest} onChange={(v) => set("mortgageInterest", v)} />
            <NumField label="Entretien immobilier" value={form.realEstateMaintenance} onChange={(v) => set("realEstateMaintenance", v)} />
            <NumField label="Primes maladie / LCA" value={form.healthInsurancePremiums} onChange={(v) => set("healthInsurancePremiums", v)} />
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="flex justify-end">
          <ExportPdfButton
            onClick={() =>
              exportTouPdf({
                input: form,
                eligibility,
                comparison,
              })
            }
          />
        </div>
        <CalcCard title="Comparatif IS vs TOU">
          <Row>
            <MoneyTile label="IS retenue" value={comparison.sourceTax} hint={`${comparison.effectiveRateIS}%`} />
            <MoneyTile label="TOU calculée" value={comparison.ordinaryTax} hint={`${comparison.effectiveRateTOU}%`} />
          </Row>
          <div className="mt-4">
            <MoneyTile
              label={comparison.delta < 0 ? "Économie TOU" : "Surcoût TOU"}
              value={Math.abs(comparison.delta)}
              tone={comparison.delta < 0 ? "success" : "warning"}
              big
            />
          </div>
          <div className="mt-3">
            <PctTile label="Taux marginal" value={comparison.marginalRate} tone="primary" />
          </div>
        </CalcCard>

        <CalcCard>
          <div className="flex items-start gap-2 text-sm">
            <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              <div className="font-semibold">{comparison.recommendationText}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                {comparison.potentialDeductionsImpact}
              </p>
            </div>
          </div>
        </CalcCard>

        <CalcCard title="Rappels">
          <ul className="space-y-2 text-xs text-muted-foreground">
            {eligibility.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CalcCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}
