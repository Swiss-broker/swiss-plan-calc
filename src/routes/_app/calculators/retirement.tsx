import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { annuityVsLumpSum, capitalWithdrawalTax } from "@/lib/lpp";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { exportRetirementPdf } from "@/lib/pdf/reports";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/calculators/retirement")({
  head: () => ({ meta: [{ title: "Rente vs capital · SwissBroker Pro" }] }),
  component: RetirementCalc,
});

function RetirementCalc() {
  const [form, setForm] = useState({
    capital: 600_000,
    canton: "VD",
    status: "single" as "single" | "married" | "single_with_children",
    conversionRate: 6.0,
    yearsAlive: 22,
    selfReturnRate: 2.5,
    rentMarginalRate: 25,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const lumpTax = useMemo(
    () => capitalWithdrawalTax({ capital: form.capital, canton: form.canton, status: form.status }),
    [form],
  );

  const compare = useMemo(
    () =>
      annuityVsLumpSum({
        capital: form.capital,
        conversionRate: form.conversionRate,
        yearsAlive: form.yearsAlive,
        selfReturnRate: form.selfReturnRate,
        rentMarginalRate: form.rentMarginalRate,
        lumpSumTax: lumpTax.total,
      }),
    [form, lumpTax.total],
  );

  const reco =
    compare.recommendation === "annuity"
      ? "Privilégier la rente : sécurité à vie + revenu garanti."
      : compare.recommendation === "lump_sum"
        ? "Privilégier le capital : meilleur rendement net après impôts si bien placé."
        : "Mixte recommandé : 50/50 capital + rente pour équilibrer sécurité et performance.";

  const { user } = useAuth();
  const handleExport = () =>
    exportRetirementPdf({
      header: { brokerEmail: user?.email ?? undefined },
      input: form,
      lumpTax,
      compare,
      reco,
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CalcCard title="Hypothèses" description="Comparez le retrait en capital au versement en rente.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField label="Capital LPP au moment de la retraite" value={form.capital} onChange={(v) => set("capital", v)} />
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
                <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Célibataire</SelectItem>
                    <SelectItem value="married">Marié·e</SelectItem>
                    <SelectItem value="single_with_children">Famille monoparentale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Taux de conversion (%)" value={form.conversionRate} onChange={(v) => set("conversionRate", v)} step={0.05} />
              <NumField label="Espérance de vie résiduelle (ans)" value={form.yearsAlive} onChange={(v) => set("yearsAlive", v)} />
              <NumField label="Rendement net du capital placé (%/an)" value={form.selfReturnRate} onChange={(v) => set("selfReturnRate", v)} step={0.1} />
              <NumField label="Taux marginal sur la rente (%)" value={form.rentMarginalRate} onChange={(v) => set("rentMarginalRate", v)} step={0.5} />
            </div>
          </CalcCard>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <CalcCard title="Impôt unique sur capital (1/5 du barème)">
            <Row>
              <MoneyTile label="IFD" value={lumpTax.ifd} />
              <MoneyTile label="Cantonal" value={lumpTax.cantonal} />
            </Row>
            <div className="mt-3">
              <MoneyTile label="Total impôt capital" value={lumpTax.total} tone="warning" big />
            </div>
          </CalcCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalcCard title="Scénario rente">
          <Row>
            <MoneyTile label="Total brut versé" value={compare.totalRente} />
            <MoneyTile label="Net après impôts" value={compare.netAnnuity} tone="primary" big />
          </Row>
        </CalcCard>
        <CalcCard title="Scénario capital">
          <Row>
            <MoneyTile label="Capital après impôt" value={form.capital - lumpTax.total} />
            <MoneyTile label="Net projeté" value={compare.netLumpSum} tone="primary" big />
          </Row>
        </CalcCard>
      </div>

      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-success-foreground/80">Recommandation</div>
        <p className="mt-1 text-sm">{reco}</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <SaveSimulationButton
          kind="retirement"
          inputs={form}
          summary={{
            netAnnuity: compare.netAnnuity,
            netLumpSum: compare.netLumpSum,
            lumpTaxTotal: lumpTax.total,
            recommendation: compare.recommendation,
          }}
          defaultTitle={`Retraite ${form.canton} · capital ${form.capital}`}
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
