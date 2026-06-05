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
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CalcCard, MoneyTile, Row, HelpDot } from "@/components/calculators/CalcUI";
import { ExportPdfButton } from "@/components/calculators/ExportPdfButton";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import {
  computeHealthFrance,
  type HealthFranceInput,
} from "@/lib/health-france";
import { exportHealthFrancePdf } from "@/lib/pdf/reports";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/health-insurance-france")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Assurance santé frontaliers (CMU vs LAMal) · SwissBroker Pro" }] }),
  component: HealthInsuranceFranceCalc,
});

function HealthInsuranceFranceCalc() {
  const { clientId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "health-insurance-france");
  const [form, setForm] = useState<HealthFranceInput>({
    swissGrossSalaryCHF: 95_000,
    civilStatus: "single",
    childrenCount: 0,
    chfToEurRate: 1.05,
    taxYear: 2026,
    lamalAdultMonthlyCHF: 200,
    lamalChildMonthlyCHF: 49.4,
  });
  useHydrateFormFromPrefill(prefill, setForm);
  const set = <K extends keyof HealthFranceInput>(k: K, v: HealthFranceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeHealthFrance(form), [form]);

  const recoLabel = result.recommended === "CMU" ? "CMU (France)" : "LAMal (Suisse)";

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5"><CrossCalcImpactBanner calculator="health-insurance-france" clientId={clientId} /></div>
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <CalcCard
          title="Profil du frontalier"
          description="Comparez la cotisation CMU (régime français géré par le CNTFS via l'URSSAF) et l'assurance privée suisse (LAMal)."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Salaire suisse brut annuel N-2 (CHF)"
              value={form.swissGrossSalaryCHF}
              onChange={(v) => set("swissGrossSalaryCHF", v)}
              tip="Salaire de l'année N-2 (pour 2026 = vos revenus 2024). Base de calcul de la cotisation CMU, pas le salaire actuel."
            />
            <Field label="Situation civile (info contextuelle)">
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
              label="Enfants à charge (impacte LAMal)"
              value={form.childrenCount}
              onChange={(v) => set("childrenCount", v)}
              tip="Sans effet sur la CMU. Impacte uniquement le calcul LAMal (prime mensuelle par enfant)."
            />
            <NumField
              label="Taux de change CHF → EUR"
              value={form.chfToEurRate}
              onChange={(v) => set("chfToEurRate", v)}
              step={0.01}
              tip="Taux utilisé pour convertir votre salaire suisse en euros. Taux indicatif moyen 2026."
            />
            <NumField
              label="Année fiscale de référence"
              value={form.taxYear}
              onChange={(v) => set("taxYear", v)}
              tip="Détermine l'abattement officiel applicable. 2026 : 12 015 €. Révisé chaque année par l'administration française."
            />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>
              Le salaire indiqué doit correspondre au <strong>revenu N-2</strong> (pour {form.taxYear} = revenus {form.taxYear - 2}).
              La cotisation CMU est <strong>individuelle</strong> : situation civile et enfants n'impactent ni l'abattement
              ni l'assiette. Les enfants sont pris en compte pour la prime LAMal.
            </span>
          </div>
        </CalcCard>

        <CalcCard
          title="Tarifs LAMal (modifiables)"
          description="Tarifs indicatifs. Ajustez selon la caisse maladie, la franchise et le canton de domicile en France."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField
              label="Tarif adulte (CHF/mois)"
              value={form.lamalAdultMonthlyCHF ?? 200}
              onChange={(v) => set("lamalAdultMonthlyCHF", v)}
              step={1}
              tip="Prime mensuelle indicative. Varie selon la caisse maladie, la franchise et le canton de domicile en France."
            />
            <NumField
              label="Tarif enfant (CHF/mois)"
              value={form.lamalChildMonthlyCHF ?? 49.4}
              onChange={(v) => set("lamalChildMonthlyCHF", v)}
              step={0.1}
              tip="Prime mensuelle par enfant. Gratuit jusqu'à 18 ans dans certaines caisses selon les options choisies."
            />
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
              label={result.recommended === "CMU" ? "Économie annuelle vs LAMal" : "Économie annuelle vs CMU"}
              value={result.savingsCHF}
              tone="primary"
            />
          </Row>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyTile
              label="CMU (France)"
              value={result.cmuAnnualCHF}
              hint={`${result.cmuAnnualEUR.toLocaleString("fr-FR")} EUR`}
              tone={result.recommended === "CMU" ? "success" : "default"}
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
              RFR estimé (revenus N-2) : {result.rfrEUR.toLocaleString("fr-FR")} EUR · Abattement{" "}
              {form.taxYear} : {result.abatementEUR.toLocaleString("fr-FR")} EUR · Assiette :{" "}
              {result.cmuBaseEUR.toLocaleString("fr-FR")} EUR × 8%.
            </span>
          </div>
          <div className="mt-3 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            Le choix entre CMU et LAMal dépend aussi du lieu principal de consultation médicale
            (France ou Suisse) et de la couverture des ayants droit. Le droit d'option doit être
            exercé dans les 3 mois après le début de l'activité frontalière.
          </div>
        </CalcCard>

        <CalcCard title="Détail du calcul">
          <BreakdownSection title="CMU : cotisation maladie frontalier (URSSAF / CNTFS)" lines={result.cmuBreakdown} />
          <BreakdownSection title="LAMal : assurance maladie suisse" lines={result.lamalBreakdown} />
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

// APRÈS
function NumField({
  label,
  value,
  onChange,
  step,
  tip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  tip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {tip && <HelpDot tip={tip} />}
      </Label>
      <BaseNumField
        value={String(value)}
        onChange={(v) => onChange(Number(v) || 0)}
        step={step}
      />
    </div>
  );
}
