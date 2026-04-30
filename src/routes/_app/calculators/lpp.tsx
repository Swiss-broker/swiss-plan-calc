import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line as RLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectableCantons } from "@/lib/swiss/cantons";
import { projectLPP, simulateBuybackPlan } from "@/lib/lpp";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportLppPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";

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
    insuredSalary: 95_000,
    expectedReturnRate: 2.5,
    feeRate: 0.6,
    salaryGrowthRate: 1,
    conversionRate: 6.0,
    extraCreditRate: 0,
    yearlyBuyback: 0,
    // rachat
    canton: "VD",
    status: "single" as IncomeTaxInput["status"],
    grossSalary: 120_000,
    children: 0,
    buybackCapacity: 60_000,
    buybackYears: 3,
  });
  useHydrateFormFromPrefill(prefill, setForm);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const projection = useMemo(
    () =>
      projectLPP({
        ...form,
        yearlyBuyback: Math.round(form.buybackCapacity / Math.max(1, form.buybackYears)),
        buybackYears: form.buybackYears,
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

  return (
    <div className="space-y-6">
      {client && <ClientLinkBanner client={client} />}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <CalcCard title="Projection capital LPP" description="Bonifications légales + rendement net (taux − frais) + rachats annuels.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField label="Âge actuel" value={form.currentAge} onChange={(v) => set("currentAge", v)} />
              <NumField label="Âge retraite" value={form.retirementAge} onChange={(v) => set("retirementAge", v)} />
              <NumField label="Avoir LPP actuel (CHF)" value={form.currentBalance} onChange={(v) => set("currentBalance", v)} />
              <NumField label="Salaire assuré (CHF)" value={form.insuredSalary} onChange={(v) => set("insuredSalary", v)} />
              <NumField label="Rendement brut (%/an)" value={form.expectedReturnRate} onChange={(v) => set("expectedReturnRate", v)} step={0.1} />
              <NumField label="Frais TER + admin (%/an)" value={form.feeRate} onChange={(v) => set("feeRate", v)} step={0.05} />
              <NumField label="Croissance salariale (%/an)" value={form.salaryGrowthRate} onChange={(v) => set("salaryGrowthRate", v)} step={0.1} />
              <NumField label="Taux conversion à la retraite (%)" value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} />
              <NumField label="Bonifications surobligatoires (%)" value={form.extraCreditRate} onChange={(v) => set("extraCreditRate", v)} step={0.5} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Rendement net effectif appliqué : <strong>{projection.netReturnRate.toFixed(2)}%</strong> par an.
            </p>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Résultat retraite">
            <Row>
              <MoneyTile label="Capital projeté (net)" value={projection.projectedBalance} tone="primary" big />
              <MoneyTile label="Rente annuelle" value={projection.annualPension} tone="success" />
            </Row>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label="Rente mensuelle" value={projection.monthlyPension} tone="default" />
              <MoneyTile label="Sans rendement" value={projection.projectedBalanceNoYield} tone="default" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyTile label="Frais cumulés" value={projection.totalFees} tone="warning" />
              <MoneyTile label="Rachats injectés" value={projection.totalBuybacks} tone="default" />
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
              <NumField label="Salaire brut annuel (CHF)" value={form.grossSalary} onChange={(v) => set("grossSalary", v)} />
              <NumField label="Nombre d'enfants" value={form.children} onChange={(v) => set("children", v)} />
              <NumField label="Capacité de rachat (CHF)" value={form.buybackCapacity} onChange={(v) => set("buybackCapacity", v)} />
              <NumField label="Étaler sur (années)" value={form.buybackYears} onChange={(v) => set("buybackYears", v)} />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 md:col-span-2">
          <CalcCard title="Économie fiscale">
            <Row>
              <MoneyTile label="Économie totale" value={buybackPlan.totalTaxSavings} tone="success" big />
              <MoneyTile label="Versement / an" value={buybackPlan.yearlyAmount} />
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
