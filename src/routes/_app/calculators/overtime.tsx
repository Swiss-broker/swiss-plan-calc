import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Clock, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import { CalcCard, MoneyTile, PctTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { CANTONS, CANTON_BY_CODE } from "@/lib/swiss/cantons";
import {
  computeOvertime,
  type OvertimeInput,
  type OvertimeTaxStatus,
} from "@/lib/overtime-fr";
import { exportOvertimePdf } from "@/lib/pdf/reports";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/overtime")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Heures supp · SwissBroker Pro" }] }),
  component: OvertimeCalc,
});

function OvertimeCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "overtime");
  const [form, setForm] = useState<OvertimeInput>({
    taxStatus: "cross_border_fr_1983",
    workCanton: "VD",
    baseAnnualSalaryCHF: 95_000,
    overtimeAmountCHF: 8_000,
    civilStatus: "single",
    childrenCount: 0,
    spouseEmployed: false,
    spouseAnnualSalaryCHF: 0,
    chfToEurRate: 1.05,
    estimatedFrenchMarginalRate: 14,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof OvertimeInput>(k: K, v: OvertimeInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeOvertime(form), [form]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title="Profil"
          description="Régime fiscal du client et données du contrat de travail suisse."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Statut fiscal">
              <Select
                value={form.taxStatus}
                onValueChange={(v) => set("taxStatus", v as OvertimeTaxStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cross_border_fr_1983">Frontalier 1983 (FR)</SelectItem>
                  <SelectItem value="cross_border_ge">Frontalier Genève</SelectItem>
                  <SelectItem value="source_taxed">Imposé à la source</SelectItem>
                  <SelectItem value="tou">TOU / Quasi-résident</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Canton de travail">
              <Select value={form.workCanton} onValueChange={(v) => set("workCanton", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANTONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {CANTON_BY_CODE[c.code]?.name ?? c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Salaire de base annuel (CHF)"
              value={form.baseAnnualSalaryCHF}
              onChange={(v) => set("baseAnnualSalaryCHF", v)}
            />
            <NumField
              label="Heures supplémentaires annuelles (CHF brut)"
              value={form.overtimeAmountCHF}
              onChange={(v) => set("overtimeAmountCHF", v)}
            />
          </div>
        </CalcCard>

        <CalcCard title="Données fiscales personnelles">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Situation civile">
              <Select
                value={form.civilStatus}
                onValueChange={(v) => set("civilStatus", v as "single" | "married")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Célibataire</SelectItem>
                  <SelectItem value="married">Marié·e / pacsé·e</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumField
              label="Nombre d'enfants à charge"
              value={form.childrenCount}
              onChange={(v) => set("childrenCount", v)}
            />
            <Field label="Conjoint salarié ?">
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={form.spouseEmployed}
                  onCheckedChange={(v) => set("spouseEmployed", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {form.spouseEmployed ? "Oui" : "Non"}
                </span>
              </div>
            </Field>
            {form.spouseEmployed && (
              <NumField
                label="Salaire conjoint (CHF)"
                value={form.spouseAnnualSalaryCHF ?? 0}
                onChange={(v) => set("spouseAnnualSalaryCHF", v)}
              />
            )}
            <NumField
              label="Taux EUR/CHF"
              value={form.chfToEurRate}
              onChange={(v) => set("chfToEurRate", v)}
              step={0.01}
            />
            {form.taxStatus === "cross_border_fr_1983" && (
              <NumField
                label="Taux marginal IR France estimé (%)"
                value={form.estimatedFrenchMarginalRate}
                onChange={(v) => set("estimatedFrenchMarginalRate", v)}
                step={1}
              />
            )}
          </div>
        </CalcCard>

        <CalcCard title="Notes">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {result.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div className="flex justify-end gap-2">
          <SaveSimulationButton
            kind="overtime"
            inputs={form}
            summary={{
              status: result.status,
              overtimeCHF: result.overtimeCHF,
              swissTaxOnOvertime: result.swissTaxOnOvertime,
              frenchTaxOnOvertime: result.frenchTaxOnOvertime,
              totalTaxOnOvertime: result.totalTaxOnOvertime,
              netOvertimeCHF: result.netOvertimeCHF,
              taxSavings: result.taxSavings,
              hasFrenchExemption: result.hasFrenchExemption,
            }}
            defaultTitle={`Heures sup · ${form.workCanton} · ${form.overtimeAmountCHF} CHF`}
          />
          <ExportPdfButton onClick={() => exportOvertimePdf({ input: form, result })} />
        </div>

        <CalcCard title="Synthèse heures supplémentaires">
          <Row>
            <MoneyTile
              label="Net perçu sur heures sup"
              value={result.netOvertimeCHF}
              tone="success"
              big
            />
            <MoneyTile
              label="Économie fiscale (exonération FR)"
              value={result.taxSavings}
              tone="primary"
            />
          </Row>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>Heures sup brutes : {result.overtimeCHF.toLocaleString("fr-CH")} CHF</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyTile
              label="Impôt Suisse"
              value={result.swissTaxOnOvertime}
              hint={`${result.swissRate}%`}
            />
            <MoneyTile
              label="Impôt France"
              value={result.frenchTaxOnOvertime}
              hint={result.hasFrenchExemption ? `${result.frenchRate}% sur la part > plafond` : "Non applicable"}
            />
            <MoneyTile label="Impôt total heures sup" value={result.totalTaxOnOvertime} />
            <PctTile
              label="Charge effective"
              value={result.overtimeCHF > 0 ? (result.totalTaxOnOvertime / result.overtimeCHF) * 100 : 0}
            />
          </div>
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

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        step={step}
      />
    </Field>
  );
}
