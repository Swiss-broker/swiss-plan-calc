// src/routes/_app/calculators/health-insurance-resident.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Info } from "lucide-react";
import { CalcCard, MoneyTile, Row, HelpDot } from "@/components/calculators/CalcUI";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { useLoadSavedSimulation } from "@/hooks/useLoadSavedSimulation";
import {
  computeHealthResident,
  type HealthResidentInput,
} from "@/lib/health-resident";
import { formatCHF } from "@/lib/format";
import { CrossCalcImpactBanner } from "@/components/calculators/CrossCalcImpactBanner";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  caseId: fallback(z.string().uuid().optional(), undefined),
  simId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/health-insurance-resident")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Caisse maladie résident · SwissBroker Pro" }] }),
  component: HealthInsuranceResidentCalc,
});

function HealthInsuranceResidentCalc() {
  const { clientId, simId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "health-insurance-resident");
  const { inputs: savedInputs, isLoading: loadingSaved } = useLoadSavedSimulation(simId);
  const [form, setForm] = useState<HealthResidentInput>({
    currentBaseMonthlyCHF: 350,
    currentComplementaryMonthlyCHF: 50,
    optimizedBaseMonthlyCHF: 300,
    optimizedComplementaryMonthlyCHF: 30,
    yearsToRetirement: 20,
  });
  useHydrateFormFromPrefill(simId ? null : prefill, setForm);

  // Rechargement d'un brouillon sauvegardé : ne s'applique qu'une fois par
  // simId, pour ne pas écraser les modifications faites après le chargement.
  const loadedSimRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!simId || !savedInputs) return;
    if (loadedSimRef.current === simId) return;
    setForm((prev) => ({ ...prev, ...savedInputs } as HealthResidentInput));
    loadedSimRef.current = simId;
  }, [simId, savedInputs]);

  const set = <K extends keyof HealthResidentInput>(k: K, v: HealthResidentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeHealthResident(form), [form]);
  const [guideOpen, setGuideOpen] = useState(false);

  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur le calculateur Caisse maladie résident",
      body: "Comparez la prime LAMal actuelle du client (assurance de base + complémentaire) à une offre optimisée, et chiffrez l'économie mensuelle, annuelle et cumulée jusqu'à la retraite.",
    },
    {
      target: "health-res-current",
      title: "Situation actuelle",
      body: "Saisissez les primes mensuelles actuelles du client, telles qu'elles figurent sur son décompte de prime.",
    },
    {
      target: "health-res-optimized",
      title: "Situation optimisée",
      body: "Saisissez les primes mensuelles de l'offre optimisée envisagée (autre caisse, autre franchise, ajustement de la complémentaire).",
    },
    {
      target: "health-res-result",
      title: "Économie chiffrée",
      body: "Le calculateur chiffre automatiquement l'économie mensuelle, annuelle, et cumulée jusqu'à la retraite du client.",
    },
    {
      target: "health-res-save",
      title: "Sauvegarder la simulation",
      body: "Pensez à sauvegarder, sinon cette simulation n'apparaîtra pas dans la synthèse du rendez-vous.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <div className="flex-1"><CrossCalcImpactBanner calculator="health-insurance-resident" clientId={clientId} /></div>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, Caisse maladie résident"
        guideId="calc-health-insurance-resident"
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
        <div data-guide="health-res-current">
          <CalcCard
            title="Situation actuelle"
            description="Primes mensuelles LAMal actuellement payées par le client (assurance de base + complémentaire)."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Assurance de base (CHF/mois)"
                value={form.currentBaseMonthlyCHF}
                onChange={(v) => set("currentBaseMonthlyCHF", v)}
                step={1}
              />
              <NumField
                label="Complémentaire (CHF/mois)"
                value={form.currentComplementaryMonthlyCHF}
                onChange={(v) => set("currentComplementaryMonthlyCHF", v)}
                step={1}
              />
            </div>
          </CalcCard>
        </div>

        <div data-guide="health-res-optimized">
          <CalcCard
            title="Situation optimisée"
            description="Primes mensuelles de l'offre optimisée envisagée pour le client."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Assurance de base (CHF/mois)"
                value={form.optimizedBaseMonthlyCHF}
                onChange={(v) => set("optimizedBaseMonthlyCHF", v)}
                step={1}
              />
              <NumField
                label="Complémentaire (CHF/mois)"
                value={form.optimizedComplementaryMonthlyCHF}
                onChange={(v) => set("optimizedComplementaryMonthlyCHF", v)}
                step={1}
              />
            </div>
          </CalcCard>
        </div>

        <CalcCard title="Horizon">
          <NumField
            label="Années restantes jusqu'à la retraite"
            value={form.yearsToRetirement ?? 20}
            onChange={(v) => set("yearsToRetirement", v)}
            tip="Utilisé uniquement pour chiffrer l'économie cumulée jusqu'à la retraite dans la synthèse."
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
        <div data-guide="health-res-result">
          <CalcCard title="Comparatif">
            <Row>
              <MoneyTile label="Prime actuelle" value={result.currentAnnualCHF} hint={`${formatCHF(result.currentMonthlyCHF)}/mois`} />
              <MoneyTile label="Prime optimisée" value={result.optimizedAnnualCHF} hint={`${formatCHF(result.optimizedMonthlyCHF)}/mois`} tone="success" />
            </Row>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyTile label="Économie mensuelle" value={result.monthlySavingsCHF} tone={result.monthlySavingsCHF >= 0 ? "success" : "warning"} />
              <MoneyTile label="Économie annuelle" value={result.annualSavingsCHF} tone={result.annualSavingsCHF >= 0 ? "success" : "warning"} />
            </div>
            {result.cumulativeSavingsCHF !== null && (
              <div className="mt-3 rounded-lg border-2 border-success/40 bg-success/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-success">
                  Économie cumulée jusqu'à la retraite ({form.yearsToRetirement} ans)
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-success">
                  {formatCHF(result.cumulativeSavingsCHF)}
                </div>
              </div>
            )}
          </CalcCard>
        </div>

        <div className="flex justify-end" data-guide="health-res-save">
          <SaveSimulationButton
            kind="health_insurance_resident"
            inputs={form}
            summary={{
              currentMonthlyCHF: result.currentMonthlyCHF,
              currentAnnualCHF: result.currentAnnualCHF,
              optimizedMonthlyCHF: result.optimizedMonthlyCHF,
              optimizedAnnualCHF: result.optimizedAnnualCHF,
              monthlySavingsCHF: result.monthlySavingsCHF,
              annualSavingsCHF: result.annualSavingsCHF,
              yearsToRetirement: result.yearsToRetirement,
              cumulativeSavingsCHF: result.cumulativeSavingsCHF,
            }}
            defaultTitle={`Caisse maladie résident · ${form.currentBaseMonthlyCHF + form.currentComplementaryMonthlyCHF} CHF/mois`}
          />
        </div>
      </div>
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
