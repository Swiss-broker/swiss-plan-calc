// Panneau de transparence : explique d'où viennent les chiffres affichés
// par le Calculateur Fiscal Global (régime, sources de données, chaîne de
// calcul, hypothèses, limites).
//
// Lecture seule : ne modifie aucun input, n'ajoute aucun calcul nouveau —
// se contente de rendre visibles les valeurs intermédiaires déjà produites
// par le moteur (`result.trace` + `result.income.deductions`).

import { Info, FileSearch, ListChecks, AlertTriangle, BookOpen } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { CalcCard } from "@/components/calculators/CalcUI";
import { formatCHF } from "@/lib/format";
import type { TaxGlobalInput, TaxGlobalResult } from "@/lib/tax-global/types";
import type { Client } from "@/lib/clients/types";

interface Props {
  form: TaxGlobalInput;
  result: TaxGlobalResult;
  client?: Client | null;
}

export function TaxGlobalExplanation({ form, result, client }: Props) {
  const trace = result.trace;
  const inc = result.income;

  return (
    <CalcCard>
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-bold">
                Comment ce résultat est calculé
              </h3>
              <p className="text-xs text-muted-foreground">
                Régime, sources des données, chaîne de calcul, hypothèses et limites
              </p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            Transparence
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-5">
          {/* 1. Régime détecté */}
          <Section icon={<BookOpen className="h-4 w-4" />} title="1. Régime détecté, pourquoi">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-semibold">{result.regimeLabel}</div>
              <p className="mt-1 text-muted-foreground">{trace?.regimeReason}</p>
              {trace?.detection && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <KV k="Canton" v={trace.detection.canton || "—"} />
                  <KV k="Permis" v={trace.detection.permit || "—"} />
                  <KV k="Pays résidence" v={trace.detection.countryOfResidence || "—"} />
                  <KV
                    k="% revenu CH / mondial"
                    v={`${trace.detection.swissShareOfWorldwide ?? 100}%`}
                  />
                </div>
              )}
            </div>
          </Section>

          {/* 2. Origine des données */}
          <Section icon={<Info className="h-4 w-4" />} title="2. Origine de chaque donnée">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left font-medium">Champ</th>
                    <th className="py-2 text-right font-medium">Valeur</th>
                    <th className="py-2 text-right font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <DataRow label="Salaire brut" value={formatCHF(form.grossSalary)} source={client ? "✅ fiche client" : "⚠️ saisie"} />
                  <DataRow label="Bonus" value={formatCHF(form.bonus)} source={client ? "✅ fiche client" : "⚠️ saisie"} />
                  {form.spouseGrossSalary > 0 && (
                    <DataRow label="Salaire conjoint" value={formatCHF(form.spouseGrossSalary)} source={client ? "✅ fiche client" : "⚠️ saisie"} />
                  )}
                  {form.otherIncome > 0 && (
                    <DataRow label="Autres revenus" value={formatCHF(form.otherIncome)} source={client ? "✅ fiche client" : "⚠️ saisie"} />
                  )}
                  {form.rentalIncome > 0 && (
                    <DataRow label="Loyers perçus" value={formatCHF(form.rentalIncome)} source="✅ patrimoine client" />
                  )}
                  {form.imputedRent > 0 && (
                    <DataRow label="Valeur locative" value={formatCHF(form.imputedRent)} source="✅ patrimoine client" />
                  )}
                  {form.foreignIncome > 0 && (
                    <DataRow label="Revenu étranger" value={formatCHF(form.foreignIncome)} source="⚠️ saisie (non persisté)" />
                  )}
                  {form.netWealth > 0 && (
                    <DataRow label="Fortune nette" value={formatCHF(form.netWealth)} source="✅ Σ patrimoine client − dettes" />
                  )}
                  <DataRow label="3e pilier A versé" value={formatCHF(form.pillar3aContributions)} source={client ? "✅ prévoyance client" : "⚠️ saisie"} />
                  <DataRow label="Rachat LPP (effectué + planifié)" value={formatCHF(form.lppBuyback)} source={client ? "✅ prévoyance client" : "⚠️ saisie"} />
                  {form.mortgageInterest > 0 && (
                    <DataRow label="Intérêts hypothécaires" value={formatCHF(form.mortgageInterest)} source="✅ patrimoine client" />
                  )}
                  {form.realEstateMaintenance > 0 && (
                    <DataRow label="Entretien immobilier" value={formatCHF(form.realEstateMaintenance)} source="✅ patrimoine client" />
                  )}
                  {form.healthInsurancePremiums > 0 && (
                    <DataRow label="Primes maladie" value={formatCHF(form.healthInsurancePremiums)} source="⚠️ saisie (non persisté)" />
                  )}
                  {form.childCareCosts > 0 && (
                    <DataRow label="Frais de garde" value={formatCHF(form.childCareCosts)} source="⚠️ saisie (non persisté)" />
                  )}
                  {form.pillar3bContributions > 0 && (
                    <DataRow label="3e pilier B" value={formatCHF(form.pillar3bContributions)} source="⚠️ saisie (non persisté)" />
                  )}
                  {form.donations > 0 && (
                    <DataRow label="Dons" value={formatCHF(form.donations)} source="⚠️ saisie (non persisté)" />
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 3. Chaîne de calcul (résident ordinaire uniquement) */}
          {inc && (
            <Section icon={<ListChecks className="h-4 w-4" />} title="3. Chaîne de calcul exposée">
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
                <CalcLine label="Revenu brut total" value={inc.grossIncome} />
                <CalcLine label="− AVS/AI/APG (5.3%)" value={-inc.deductions.avs} />
                <CalcLine label="− AC (1.1% jusqu'à 148 200, +0.5% au-delà)" value={-inc.deductions.ac} />
                <CalcLine label="− LPP part salarié (selon âge et plan)" value={-inc.deductions.lpp} />
                <CalcLine label="− 3e pilier A" value={-inc.deductions.pillar3a} />
                {inc.deductions.lppBuyback > 0 && (
                  <CalcLine label="− Rachat LPP" value={-inc.deductions.lppBuyback} />
                )}
                <CalcLine label="− Frais pro (forfait 3% net, min 2 000 / max 4 000)" value={-inc.deductions.professional} />
                {inc.deductions.commuting > 0 && (
                  <CalcLine label="− Trajets (max 3 300 IFD)" value={-inc.deductions.commuting} />
                )}
                {inc.deductions.meals > 0 && (
                  <CalcLine label="− Repas (max 3 200)" value={-inc.deductions.meals} />
                )}
                {inc.deductions.mortgage > 0 && (
                  <CalcLine label="− Intérêts hypothécaires" value={-inc.deductions.mortgage} />
                )}
                {inc.deductions.realEstate > 0 && (
                  <CalcLine label="− Entretien immobilier" value={-inc.deductions.realEstate} />
                )}
                <CalcLine label="− Primes santé (forfait cantonal / IFD)" value={-inc.deductions.healthInsurance} />
                {inc.deductions.childCare > 0 && (
                  <CalcLine label="− Frais de garde" value={-inc.deductions.childCare} />
                )}
                {inc.deductions.donations > 0 && (
                  <CalcLine label="− Dons" value={-inc.deductions.donations} />
                )}
                <div className="my-2 border-t" />
                <CalcLine label="= Revenu imposable ICC" value={inc.taxableIncomeCC} bold />
                <CalcLine label="= Revenu imposable IFD (après déduction enfants 6 700/ea)" value={inc.taxableIncomeIFD} bold />
                <div className="my-2 border-t" />
                <CalcLine label={`IFD (barème art. 36 LIFD) − rabais enfants`} value={inc.ifd} />
                <CalcLine label={`Cantonal ${form.canton}`} value={inc.cantonal} />
                <CalcLine label={`Communal (multiplicateur ${form.canton} chef-lieu)`} value={inc.communal} />
                {inc.church > 0 && (
                  <CalcLine label={`Impôt église (${form.confession})`} value={inc.church} />
                )}
                {inc.wealthTax > 0 && (
                  <CalcLine label="Impôt fortune" value={inc.wealthTax} />
                )}
                <div className="my-2 border-t" />
                <CalcLine label="TOTAL impôt" value={inc.totalTax} bold tone="warning" />
              </div>
            </Section>
          )}

          {/* 3bis. Source : décomposition succincte */}
          {result.source && (
            <Section icon={<ListChecks className="h-4 w-4" />} title="3. Chaîne de calcul (impôt à la source)">
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
                <CalcLine label={`Salaire mensuel brut`} value={Math.round((form.grossSalary + form.bonus) / 12)} />
                <CalcLine label={`Barème IS appliqué`} value={NaN} text={result.source.scaleUsed ?? "—"} />
                <CalcLine label={`Taux IS (moyen)`} value={NaN} text={`${result.source.rate}%`} />
                <div className="my-2 border-t" />
                <CalcLine label="Impôt à la source annuel" value={result.source.annualTax} bold tone="warning" />
                {result.touComparison && (
                  <CalcLine
                    label="Impôt ordinaire si TOU"
                    value={result.touComparison.ordinaryTax}
                    text={result.touEligibility?.eligibleForTOU ? "(éligible)" : "(non éligible)"}
                  />
                )}
              </div>
            </Section>
          )}

          {/* 3ter. Frontalier */}
          {result.crossBorder && (
            <Section icon={<ListChecks className="h-4 w-4" />} title="3. Chaîne de calcul (frontalier)">
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
                <CalcLine label={`Salaire brut annuel`} value={form.grossSalary + form.bonus} />
                <CalcLine label={`Taux EUR→CHF utilisé`} value={NaN} text={form.eurChfRate.toFixed(4)} />
                <div className="my-2 border-t" />
                <CalcLine label="Part suisse (IS canton de travail)" value={result.crossBorder.swissTax} text={`${result.crossBorder.swissRate}%`} />
                <CalcLine label="Part étrangère (résidu après crédit, estimation)" value={result.crossBorder.foreignTax} text={`${result.crossBorder.foreignRate}%`} />
                <div className="my-2 border-t" />
                <CalcLine label="TOTAL impôt" value={result.crossBorder.totalTax} bold tone="warning" />
                {result.health && (
                  <CalcLine
                    label={`Santé (recommandé : ${result.health.recommended})`}
                    value={result.health.recommendedAnnualCHF}
                  />
                )}
              </div>
            </Section>
          )}

          {/* 4. Hypothèses */}
          {trace && trace.assumptions.length > 0 && (
            <Section icon={<Info className="h-4 w-4" />} title="4. Hypothèses et défauts appliqués">
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {trace.assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 5. Limites */}
          {trace && trace.limits.length > 0 && (
            <Section
              icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              title="5. Limites du modèle"
            >
              <ul className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                {trace.limits.map((l, i) => (
                  <li key={i} className="flex gap-2 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </CollapsibleContent>
      </Collapsible>
    </CalcCard>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function DataRow({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <tr>
      <td className="py-1.5 text-foreground">{label}</td>
      <td className="py-1.5 text-right font-mono tabular-nums">{value}</td>
      <td className="py-1.5 text-right text-muted-foreground">{source}</td>
    </tr>
  );
}

function CalcLine({
  label,
  value,
  bold,
  tone,
  text,
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: "warning";
  text?: string;
}) {
  const display = text ?? (Number.isFinite(value) ? formatCHF(value) : "—");
  return (
    <div
      className={`flex items-center justify-between gap-3 py-0.5 ${
        bold ? "font-bold" : ""
      } ${tone === "warning" ? "text-amber-700 dark:text-amber-400" : ""}`}
    >
      <span className="text-foreground/80">{label}</span>
      <span className="tabular-nums">{display}</span>
    </div>
  );
}
