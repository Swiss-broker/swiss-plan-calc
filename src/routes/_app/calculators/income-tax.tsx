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
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import { runOptimizer } from "@/lib/optimizer";
import { OptimizationsPanel } from "@/components/optimizer/OptimizationsPanel";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportIncomeTaxPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/calculators/income-tax")({
  head: () => ({ meta: [{ title: "Impôt revenu & fortune · SwissBroker Pro" }] }),
  component: IncomeTaxCalculator,
});

function IncomeTaxCalculator() {
  const [form, setForm] = useState({
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    confession: "none" as NonNullable<IncomeTaxInput["confession"]>,
    children: 0,
    grossSalary: 100_000,
    spouseGrossSalary: 0,
    bonus: 0,
    otherIncome: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    netWealth: 0,
    lppBuybackCapacity: 0,
    pillar3aBalance: 0,
  });

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const { user } = useAuth();
  const result = useMemo(() => computeIncomeTax(form), [form]);
  const optimizations = useMemo(
    () =>
      runOptimizer({
        taxInput: form,
        lppBuybackCapacity: form.lppBuybackCapacity,
        pillar3aCurrent: form.pillar3aContributions,
        pillar3aBalance: form.pillar3aBalance,
        hasLPP: true,
      }),
    [form],
  );

  const handleExport = () =>
    exportIncomeTaxPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      result,
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <CalcCard title="Situation" description="Renseignez votre profil fiscal.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Canton">
              <Select value={form.canton} onValueChange={(v) => setField("canton", v)}>
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
                onValueChange={(v) => setField("status", v as IncomeTaxInput["status"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e</SelectItem>
                  <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Confession">
              <Select
                value={form.confession}
                onValueChange={(v) =>
                  setField("confession", v as NonNullable<IncomeTaxInput["confession"]>)
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="catholic">Catholique romaine</SelectItem>
                  <SelectItem value="protestant">Protestante</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => setField("children", v)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField label="Salaire brut annuel (CHF)" value={form.grossSalary} onChange={(v) => setField("grossSalary", v)} />
            {form.status === "married" && (
              <NumField
                label="Salaire brut conjoint (CHF)"
                value={form.spouseGrossSalary}
                onChange={(v) => setField("spouseGrossSalary", v)}
              />
            )}
            <NumField label="Bonus (CHF)" value={form.bonus} onChange={(v) => setField("bonus", v)} />
            <NumField
              label="Autres revenus (CHF)"
              value={form.otherIncome}
              onChange={(v) => setField("otherIncome", v)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Cotisations 3a (CHF)"
              value={form.pillar3aContributions}
              onChange={(v) => setField("pillar3aContributions", v)}
            />
            <NumField
              label="Rachat LPP (CHF)"
              value={form.lppBuyback}
              onChange={(v) => setField("lppBuyback", v)}
            />
            <NumField
              label="Intérêts hypothécaires (CHF)"
              value={form.mortgageInterest}
              onChange={(v) => setField("mortgageInterest", v)}
            />
            <NumField
              label="Entretien immobilier (CHF)"
              value={form.realEstateMaintenance}
              onChange={(v) => setField("realEstateMaintenance", v)}
            />
            <NumField
              label="Fortune nette (CHF)"
              value={form.netWealth}
              onChange={(v) => setField("netWealth", v)}
            />
            <NumField
              label="Capacité de rachat LPP (CHF)"
              value={form.lppBuybackCapacity}
              onChange={(v) => setField("lppBuybackCapacity", v)}
            />
            <NumField
              label="Capital 3a accumulé (CHF)"
              value={form.pillar3aBalance}
              onChange={(v) => setField("pillar3aBalance", v)}
            />
          </div>
        </CalcCard>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <CalcCard title="Résultat fiscal" description="Estimation barèmes 2026.">
          <Row>
            <MoneyTile label="Impôt total" value={result.totalTax} tone="primary" big />
            <PctTile label="Taux effectif" value={result.effectiveRate} tone="primary" />
          </Row>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyTile label="IFD" value={result.ifd} />
            <MoneyTile label="Cantonal" value={result.cantonal} />
            <MoneyTile label="Communal" value={result.communal} />
            <MoneyTile label="Paroissial" value={result.church} />
            <MoneyTile label="Fortune" value={result.wealthTax} />
            <PctTile label="Taux marginal" value={result.marginalRate} tone="warning" />
          </div>
        </CalcCard>

        <CalcCard title="Détail revenu imposable">
          <dl className="space-y-2 text-sm">
            <Line label="Revenu brut" value={formatCHF(result.grossIncome)} />
            <Line label="− AVS / AI / APG / AC" value={formatCHF(-result.deductions.avs)} />
            <Line label="− LPP" value={formatCHF(-result.deductions.lpp)} />
            <Line label="− 3a" value={formatCHF(-result.deductions.pillar3a)} />
            <Line label="− Rachat LPP" value={formatCHF(-result.deductions.lppBuyback)} />
            <Line label="− Frais professionnels" value={formatCHF(-result.deductions.professional)} />
            <Line label="− Assurance maladie" value={formatCHF(-result.deductions.healthInsurance)} />
            <Line label="− Hypothèque & immo" value={formatCHF(-(result.deductions.mortgage + result.deductions.realEstate))} />
            <div className="my-2 border-t border-border" />
            <Line label="Revenu imposable" value={formatCHF(result.taxableIncomeCC)} bold />
          </dl>
        </CalcCard>
      </div>

      <div className="lg:col-span-5">
        <OptimizationsPanel optimizations={optimizations} />
      </div>

      <div className="flex flex-wrap justify-end gap-2 lg:col-span-5">
        <SaveSimulationButton
          kind="income_tax"
          inputs={form}
          summary={{
            totalTax: result.totalTax,
            effectiveRate: result.effectiveRate,
            marginalRate: result.marginalRate,
            taxableIncomeCC: result.taxableIncomeCC,
            ifd: result.ifd,
            cantonal: result.cantonal,
            communal: result.communal,
          }}
          defaultTitle={`Impôt ${form.canton} · ${formatCHF(form.grossSalary)}`}
        />
        <ExportPdfButton onClick={handleExport} />
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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
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

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
