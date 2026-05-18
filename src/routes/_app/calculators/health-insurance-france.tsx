import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Shield, Info, ChevronDown } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalcCard, MoneyTile, Row } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import {
  computeHealthFrance,
  type HealthFranceInput,
} from "@/lib/health-france";
import { exportHealthFrancePdf } from "@/lib/pdf/reports";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/health-insurance-france")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "CMU/CNTFS vs LAMal · SwissBroker Pro" }] }),
  component: HealthInsuranceFranceCalc,
});

function HealthInsuranceFranceCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "health-insurance-france");
  const [form, setForm] = useState<HealthFranceInput>({
    swissGrossSalaryCHF: 95_000,
    spouseFrenchSalaryEUR: 0,
    spouseHasOwnCoverage: false,
    civilStatus: "single",
    childrenCount: 0,
    chfToEurRate: 1.05,
    lamalAnnualCHF: 3_600,
    taxYear: new Date().getFullYear(),
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof HealthFranceInput>(k: K, v: HealthFranceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeHealthFrance(form), [form]);

  const recoLabel = result.recommended === "CMU_CNTFS" ? "CMU/CNTFS (France)" : "LAMal (Suisse)";

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title="Profil du frontalier"
          description="Données utilisées pour estimer la cotisation CMU/CNTFS (URSSAF) et la comparer à la prime LAMal suisse."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Salaire suisse brut annuel (CHF)"
              value={form.swissGrossSalaryCHF}
              onChange={(v) => set("swissGrossSalaryCHF", v)}
            />
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
            {form.civilStatus === "married" && (
              <>
                <NumField
                  label="Salaire annuel conjoint (EUR)"
                  value={form.spouseFrenchSalaryEUR}
                  onChange={(v) => set("spouseFrenchSalaryEUR", v)}
                />
                <Field label="Conjoint a sa propre couverture santé ?">
                  <div className="flex h-9 items-center gap-2">
                    <Switch
                      checked={form.spouseHasOwnCoverage}
                      onCheckedChange={(v) => set("spouseHasOwnCoverage", v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.spouseHasOwnCoverage ? "Oui" : "Non"}
                    </span>
                  </div>
                </Field>
              </>
            )}
            <NumField
              label="Taux de change CHF → EUR"
              value={form.chfToEurRate}
              onChange={(v) => set("chfToEurRate", v)}
              step={0.01}
            />
            <NumField
              label="Année fiscale de référence"
              value={form.taxYear}
              onChange={(v) => set("taxYear", v)}
            />
          </div>
        </CalcCard>

        <CalcCard
          title="Prime LAMal (alternative suisse)"
          description="Prime annuelle estimée de l'assurance maladie suisse de base. À ajuster selon canton, caisse et franchise."
        >
          <NumField
            label="Prime annuelle LAMal (CHF)"
            value={form.lamalAnnualCHF ?? 0}
            onChange={(v) => set("lamalAnnualCHF", v)}
          />
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
            kind="health_insurance_france"
            inputs={form}
            summary={{
              recommended: result.recommended,
              recommendedAnnualCHF: result.recommendedAnnualCHF,
              cmuAnnualCHF: result.cmuAnnualCHF,
              lamalAnnualCHF: result.lamalAnnualCHF,
              savingsCHF: result.savingsCHF,
              rfrEUR: result.rfrEUR,
            }}
            defaultTitle={`Santé frontalier · ${form.civilStatus === "married" ? "Couple" : "Solo"} · ${form.swissGrossSalaryCHF} CHF`}
          />
          <ExportPdfButton onClick={() => exportHealthFrancePdf({ input: form, result })} />
        </div>

        <CalcCard title={`Option recommandée : ${recoLabel}`}>
          <Row>
            <MoneyTile
              label="Cotisation annuelle (recommandé)"
              value={result.recommendedAnnualCHF}
              tone="success"
              big
            />
            <MoneyTile
              label={result.recommended === "CMU_CNTFS" ? "Économie annuelle vs LAMal" : "Économie annuelle vs CMU/CNTFS"}
              value={result.savingsCHF}
              tone="primary"
            />
          </Row>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyTile
              label="CMU/CNTFS (France)"
              value={result.cmuAnnualCHF}
              hint={`${result.cmuAnnualEUR.toLocaleString("fr-FR")} EUR`}
              tone={result.recommended === "CMU_CNTFS" ? "success" : "default"}
            />
            <MoneyTile
              label="LAMal (Suisse)"
              value={result.lamalAnnualCHF}
              tone={result.recommended === "LAMAL" ? "success" : "default"}
            />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>
              RFR estimé : {result.rfrEUR.toLocaleString("fr-FR")} EUR · Abattement :{" "}
              {result.abatementEUR.toLocaleString("fr-FR")} EUR ({result.partsFiscales} part
              {result.partsFiscales > 1 ? "s" : ""} fiscale{result.partsFiscales > 1 ? "s" : ""}).
            </span>
          </div>
        </CalcCard>

        <CalcCard title="Détail du calcul">
          <BreakdownSection title="CMU/CNTFS — Cotisation Subsidiaire Maladie (URSSAF)" lines={result.cmuBreakdown} />
          <BreakdownSection title="LAMal — assurance maladie suisse" lines={result.lamalBreakdown} />
        </CalcCard>
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string }[];
}) {
  return (
    <Collapsible defaultOpen={false} className="border-b border-border/60 py-2 last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium hover:text-primary [&[data-state=open]>svg]:rotate-180">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <ul className="mt-2 space-y-1.5 text-xs">
          {lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-dashed border-border/40 pb-1 last:border-b-0">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium tabular-nums">{l.value}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
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
