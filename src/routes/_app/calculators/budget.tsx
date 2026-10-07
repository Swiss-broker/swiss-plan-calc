// src/routes/_app/calculators/budget.tsx
//
// Calculateur Budget — un seul outil, utilisé deux fois dans le même
// rendez-vous : ouvert en tout début d'entretien (budget actuel, avant
// toute simulation, puisqu'aucune simulation n'existe encore dans un
// dossier fraîchement créé), puis revisité en fin d'entretien (même
// outil, budget optimisé, puisque les simulations faites entre-temps dans
// le même dossier sont reprises automatiquement). Voir computeBudget dans
// @/lib/budget pour la logique de calcul.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Info, Wallet } from "lucide-react";
import { CalcCard, MoneyTile, Row, HelpDot } from "@/components/calculators/CalcUI";
import { SaveSimulationButton } from "@/components/calculators/SaveSimulationButton";
import { ClientLinkBanner } from "@/components/calculators/ClientLinkBanner";
import { usePrefillFromClient, useHydrateFormFromPrefill } from "@/hooks/usePrefillFromClient";
import { useLoadSavedSimulation } from "@/hooks/useLoadSavedSimulation";
import { useCaseSimulations } from "@/hooks/useCaseSimulations";
import { computeBudget, type BudgetInput } from "@/lib/budget";
import { KIND_LABELS } from "@/lib/history/types";
import { formatCHF } from "@/lib/format";
import { GuideMode, GuideToggleButton, type GuideStep } from "@/components/calculators/GuideMode";
import { Label } from "@/components/ui/label";
import { NumField as BaseNumField } from "@/components/ui/num-field";

const searchSchema = z.object({
  clientId: fallback(z.string().uuid().optional(), undefined),
  caseId: fallback(z.string().uuid().optional(), undefined),
  simId: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/calculators/budget")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Budget · SwissBroker Pro" }] }),
  component: BudgetCalc,
});

const DEFAULT_FORM: BudgetInput = {
  netSalaryMonthlyCHF: 0,
  spouseNetSalaryMonthlyCHF: 0,
  rentalIncomeMonthlyCHF: 0,
  otherIncomeMonthlyCHF: 0,
  housingMonthlyCHF: 0,
  energyMonthlyCHF: 0,
  healthInsuranceMonthlyCHF: 0,
  otherInsuranceMonthlyCHF: 0,
  transportMonthlyCHF: 0,
  loansMonthlyCHF: 0,
  alimonyPaidMonthlyCHF: 0,
  otherExpensesMonthlyCHF: 0,
};

function BudgetCalc() {
  const { clientId, caseId, simId } = Route.useSearch();
  const { client, prefill } = usePrefillFromClient(clientId, "budget");
  const { inputs: savedInputs, isLoading: loadingSaved } = useLoadSavedSimulation(simId);
  const { entries } = useCaseSimulations(clientId, caseId);
  const [form, setForm] = useState<BudgetInput>(DEFAULT_FORM);
  useHydrateFormFromPrefill(simId ? null : prefill, setForm);

  const loadedSimRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!simId || !savedInputs) return;
    if (loadedSimRef.current === simId) return;
    setForm((prev) => ({ ...prev, ...savedInputs }) as BudgetInput);
    loadedSimRef.current = simId;
  }, [simId, savedInputs]);

  const set = <K extends keyof BudgetInput>(k: K, v: BudgetInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => computeBudget(form, entries), [form, entries]);
  const [guideOpen, setGuideOpen] = useState(false);

  const guideSteps: GuideStep[] = [
    {
      title: "Bienvenue sur le calculateur Budget",
      body: "À utiliser deux fois dans le même rendez-vous : en tout début d'entretien pour établir le budget actuel du client, puis en fin d'entretien pour voir le budget optimisé une fois les simulations réalisées.",
    },
    {
      target: "budget-income",
      title: "Revenus mensuels",
      body: "Saisissez avec le client tous ses revenus mensuels nets : salaire(s), revenus locatifs, autres revenus.",
    },
    {
      target: "budget-expenses",
      title: "Charges mensuelles",
      body: "Saisissez toutes les charges mensuelles fixes du client : logement, assurance maladie, crédits, pension alimentaire versée, autres charges.",
    },
    {
      target: "budget-current",
      title: "Budget actuel",
      body: "La marge mensuelle actuelle du client, calculée automatiquement (revenus − charges).",
    },
    {
      target: "budget-optimized",
      title: "Budget optimisé",
      body: "Une fois des simulations enregistrées dans ce même dossier (3a, caisse maladie, fiscal global, etc.), leurs économies mensuelles s'ajoutent ici automatiquement, poste par poste, pour afficher le budget optimisé.",
    },
    {
      target: "budget-save",
      title: "Sauvegarder la simulation",
      body: "Sauvegardez une première fois en début de rendez-vous (budget actuel), puis une seconde fois en fin de rendez-vous (budget optimisé) pour que les deux apparaissent dans la synthèse.",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Budget</h1>
        </div>
        <GuideToggleButton onClick={() => setGuideOpen(true)} />
      </div>
      <GuideMode
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={guideSteps}
        title="Guide, Budget"
        guideId="calc-budget"
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
          Vous consultez une simulation sauvegardée. Toute modification créera une nouvelle
          sauvegarde distincte si vous cliquez sur « Sauvegarder ».
        </div>
      )}

      <div className="md:col-span-3 space-y-4">
        <div data-guide="budget-income">
          <CalcCard
            title="Revenus mensuels"
            description="Tous les revenus nets mensuels du client (et de son conjoint le cas échéant)."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Salaire net"
                value={form.netSalaryMonthlyCHF}
                onChange={(v) => set("netSalaryMonthlyCHF", v)}
              />
              <NumField
                label="Salaire net conjoint"
                value={form.spouseNetSalaryMonthlyCHF}
                onChange={(v) => set("spouseNetSalaryMonthlyCHF", v)}
              />
              <NumField
                label="Revenus locatifs"
                value={form.rentalIncomeMonthlyCHF}
                onChange={(v) => set("rentalIncomeMonthlyCHF", v)}
              />
              <NumField
                label="Autres revenus"
                value={form.otherIncomeMonthlyCHF}
                onChange={(v) => set("otherIncomeMonthlyCHF", v)}
              />
            </div>
          </CalcCard>
        </div>

        <div data-guide="budget-expenses">
          <CalcCard
            title="Charges mensuelles"
            description="Toutes les charges fixes mensuelles du client."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumField
                label="Logement (loyer/charges)"
                value={form.housingMonthlyCHF}
                onChange={(v) => set("housingMonthlyCHF", v)}
              />
              <NumField
                label="Énergie (eau, électricité, gaz)"
                value={form.energyMonthlyCHF}
                onChange={(v) => set("energyMonthlyCHF", v)}
              />
              <NumField
                label="Assurance maladie"
                value={form.healthInsuranceMonthlyCHF}
                onChange={(v) => set("healthInsuranceMonthlyCHF", v)}
              />
              <NumField
                label="Autres assurances (véhicule, ménage, RC…)"
                value={form.otherInsuranceMonthlyCHF}
                onChange={(v) => set("otherInsuranceMonthlyCHF", v)}
              />
              <NumField
                label="Transport (véhicule, essence, abonnement)"
                value={form.transportMonthlyCHF}
                onChange={(v) => set("transportMonthlyCHF", v)}
              />
              <NumField
                label="Crédits / leasing"
                value={form.loansMonthlyCHF}
                onChange={(v) => set("loansMonthlyCHF", v)}
              />
              <NumField
                label="Pension alimentaire versée"
                value={form.alimonyPaidMonthlyCHF}
                onChange={(v) => set("alimonyPaidMonthlyCHF", v)}
              />
              <NumField
                label="Autres charges"
                value={form.otherExpensesMonthlyCHF}
                onChange={(v) => set("otherExpensesMonthlyCHF", v)}
              />
            </div>
          </CalcCard>
        </div>

        <CalcCard
          title="Détail des optimisations identifiées"
          description="Chaque gain mensuel récurrent déjà identifié dans ce dossier (simulations 'annual' non archivées), poste par poste."
        >
          {result.optimizations.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 text-primary" />
              Aucune optimisation identifiée pour l'instant dans ce dossier. Normal en début de
              rendez-vous : revenez sur ce calculateur après avoir réalisé les simulations avec le
              client.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {result.optimizations.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{o.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {KIND_LABELS[o.sourceKind]}
                      {o.details ? ` · ${o.details}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold tabular-nums text-success">
                    +{formatCHF(Math.round(o.monthlyCHF))}/mois
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CalcCard>
      </div>

      <div className="space-y-4 md:col-span-2">
        <div data-guide="budget-current">
          <CalcCard title="Budget actuel">
            <Row>
              <MoneyTile label="Revenus" value={result.totalMonthlyIncomeCHF} hint="CHF/mois" />
              <MoneyTile label="Charges" value={result.totalMonthlyExpensesCHF} hint="CHF/mois" />
            </Row>
            <div className="mt-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Marge actuelle
                <HelpDot tip="Revenus mensuels − charges mensuelles, avant toute optimisation." />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {formatCHF(result.currentMarginCHF)}/mois
              </div>
            </div>
          </CalcCard>
        </div>

        <div data-guide="budget-optimized">
          <CalcCard title="Budget optimisé">
            <div className="rounded-lg border-2 border-success/40 bg-success/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success">
                Marge optimisée
                <HelpDot tip="Marge actuelle + total des optimisations mensuelles récurrentes déjà identifiées dans ce dossier." />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-success">
                {formatCHF(Math.round(result.optimizedMarginCHF))}/mois
              </div>
            </div>
            <div className="mt-3">
              <MoneyTile
                label="Total optimisations"
                value={Math.round(result.totalMonthlyOptimizationCHF)}
                hint="CHF/mois"
                tone={result.totalMonthlyOptimizationCHF > 0 ? "success" : undefined}
              />
            </div>
          </CalcCard>
        </div>

        <div className="flex justify-end" data-guide="budget-save">
          <SaveSimulationButton
            kind="budget"
            inputs={form}
            summary={{
              totalMonthlyIncomeCHF: result.totalMonthlyIncomeCHF,
              totalMonthlyExpensesCHF: result.totalMonthlyExpensesCHF,
              currentMarginCHF: result.currentMarginCHF,
              optimizations: result.optimizations,
              totalMonthlyOptimizationCHF: result.totalMonthlyOptimizationCHF,
              optimizedMarginCHF: result.optimizedMarginCHF,
            }}
            defaultTitle={`Budget · marge ${formatCHF(result.currentMarginCHF)}/mois`}
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
  tip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {tip && <HelpDot tip={tip} />}
      </Label>
      <BaseNumField value={String(value)} onChange={(v) => onChange(Number(v) || 0)} step={1} />
    </div>
  );
}
