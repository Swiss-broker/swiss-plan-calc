// src/routes/_app/calculators/health-insurance-france.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Shield, Info, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { useBrokerPdfHeader } from "@/hooks/useBrokerPdfHeader";
import { exportHealthFrancePdf } from "@/lib/pdf/reports";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { useLoadSavedSimulation } from "@/hooks/useLoadSavedSimulation";
import {
  computeHealthFrance,
  type HealthFranceInput,
} from "@/lib/health-france";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  simId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/health-insurance-france")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Assurance santé frontaliers (CMU vs LAMal) · SwissBroker Pro" }] }),
  component: HealthInsuranceFranceCalc,
});

function HealthInsuranceFranceCalc() {
  const { clientId, simId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "health-insurance-france");
  const { inputs: savedInputs, isLoading: loadingSaved } = useLoadSavedSimulation(simId);
  const [form, setForm] = useState<HealthFranceInput>({
    swissGrossSalaryCHF: 95_000,
    civilStatus: "single",
    childrenCount: 0,
    chfToEurRate: 1.05,
    taxYear: 2026,
    lamalAdultMonthlyCHF: 200,
    lamalChildMonthlyCHF: 49.4,
  });
  useHydrateFormFromPrefill(simId ? null : prefill, setForm);

  // Rechargement d'un brouillon sauvegardé : ne s'applique qu'une fois par
  // simId, pour ne pas écraser les modifications faites après le chargement.
  const loadedSimRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!simId || !savedInputs) return;
    if (loadedSimRef.current === simId) return;
    setForm((prev) => ({ ...prev, ...savedInputs } as HealthFranceInput));
    loadedSimRef.current = simId;
  }, [simId, savedInputs]);

  const set = <K extends keyof HealthFranceInput>(k: K, v: HealthFranceInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeHealthFrance(form), [form]);
  const brokerHeader = useBrokerPdfHeader();
  const handleExportPdf = () => {
    exportHealthFrancePdf({ header: brokerHeader, input: form, result });
  };
  const [guideOpen, setGuideOpen] = useState(false);

  const recoLabel = result.recommended === "CMU" ? "CMU (France)" : "LAMal (Suisse)";

  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur le calculateur CMU vs LAMal",
      body: "Comparez la cotisation maladie française (CMU) et l'assurance suisse (LAMal) pour un client frontalier, et identifiez l'option la plus avantageuse.",
    },
    {
      target: "health-fr-profile",
      title: "Profil du frontalier",
      body: "Le salaire suisse doit correspondre au revenu N-2, c'est la base de calcul officielle de la cotisation CMU, pas le salaire actuel.",
    },
    {
      target: "health-fr-lamal",
      title: "Tarifs LAMal",
      body: "Ces tarifs sont indicatifs et modifiables selon la caisse maladie, la franchise et le canton de domicile du client en France.",
    },
    {
      target: "health-fr-result",
      title: "Option recommandée",
      body: "Le calculateur compare les deux cotisations annuelles et recommande automatiquement la moins chère. Le choix final dépend aussi du lieu de consultation médicale habituel.",
    },
    {
      target: "health-fr-save",
      title: "Sauvegarder la simulation",
      body: "Pensez à sauvegarder, sinon cette simulation n'apparaîtra pas dans la synthèse du rendez-vous.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <div className="flex-1"><CrossCalcImpactBanner calculator="health-insurance-france" clientId={clientId} /></div>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, CMU vs LAMal"
        guideId="calc-health-insurance-france"
      />
      {client && (
        <div className="md:col-span-5">
          <ClientLinkBanner client={client} />
        </div>
      )}
      {simId && loadingSaved && (
        <div className="md:col-span-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
          Chargement de la sauvegarde…
        </div>
      )}
      {simId && !loadingSaved && savedInputs && (
        <div className="md:col-span-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          Vous consultez une simulation sauvegardée. Toute modification créera une nouvelle sauvegarde distincte si vous cliquez sur « Sauvegarder ».
        </div>
      )}
      <div className="md:col-span-3 space-y-4">
        <div data-guide="health-fr-profile">
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
        </div>

        <div data-guide="health-fr-lamal">
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
        </div>

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
        <div data-guide="health-fr-result">
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
        </div>

        <CalcCard title="Détail du calcul">
          <BreakdownSection title="CMU : cotisation maladie frontalier (URSSAF / CNTFS)" lines={result.cmuBreakdown} />
          <BreakdownSection title="LAMal : assurance maladie suisse" lines={result.lamalBreakdown} />
        </CalcCard>

        <div className="flex justify-end" data-guide="health-fr-save">
          <Button type="button" variant="outline" className="gap-2" onClick={handleExportPdf}>
            <Download className="h-4 w-4" />
            Télécharger le rapport PDF
          </Button>
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
        </div>
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