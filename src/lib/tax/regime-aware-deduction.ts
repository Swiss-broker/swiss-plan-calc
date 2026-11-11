// Économie fiscale d'une déduction (3e pilier A, rachat LPP) tenant compte du
// RÉGIME FISCAL réel du client lié (résident ordinaire, imposé à la source,
// quasi-résident TOU, frontalier GE, frontalier accord franco-suisse 1983…).
//
// Pourquoi ce module : pillar3a.tsx et lpp.tsx calculaient jusqu'ici
// l'économie d'impôt d'une cotisation/rachat avec `computeIncomeTax` (barème
// ORDINAIRE) quel que soit le régime réel du client — correct pour un
// résident ordinaire, mais faux pour un frontalier ou un imposé à la source :
// la retenue à la source ne tient JAMAIS compte d'une cotisation 3e pilier ou
// d'un rachat LPP, et un frontalier sous l'accord franco-suisse de 1983 est
// imposé exclusivement en France (un versement suisse n'y ouvre aucun droit à
// déduction). Même refonte déjà appliquée à la fiche client (voir
// buildPillar3a dans @/lib/client-dashboard) : on réutilise ICI le même
// moteur multi-régimes (`computeTaxGlobal`) avec les mêmes données de fiche
// (`toTaxGlobalInput`) et les mêmes valeurs par défaut (`createDefaultInput`),
// pour que le chiffre affiché ici soit TOUJOURS identique à celui de Fiscal
// Global et de la fiche client pour un même client — jamais un troisième
// calcul qui diverge.

import { computeIncomeTax, type IncomeTaxInput } from "./income";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { detectRegime, createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput, Regime } from "@/lib/tax-global/types";
import {
  toTaxGlobalInput,
  stripUndefined,
  type ClientBundle,
} from "@/lib/clients/to-calculator-input";

export type DeductionField = "pillar3aContributions" | "lppBuyback";

export interface RegimeAwareDeductionInput {
  /** Dossier client lié (null/undefined = calculateur en mode autonome, sans fiche liée). */
  bundle: ClientBundle | null | undefined;
  /** Base de calcul ordinaire (canton/statut/salaire/communalMultiplier…) utilisée
   *  quand aucune fiche client n'est liée. */
  fallbackTaxInput: IncomeTaxInput;
  /** Montant testé (cotisation 3a ou rachat LPP de l'année). */
  deductionAmount: number;
  deductionField: DeductionField;
}

export interface RegimeAwareDeductionResult {
  taxSavings: number;
  effectiveCost: number;
  marginalRate: number;
  regime: Regime;
  regimeLabel: string;
  /** "yes" = déduction automatiquement effective (résident ordinaire).
   *  "conditional" = effective uniquement après démarche — TOU (quasi-résident
   *  éligible) ou rectification IS auprès du canton (non éligible TOU) —
   *  tant que la démarche n'est pas faite, la retenue à la source s'applique
   *  sans aucune déduction.
   *  "no" = aucune économie réelle possible (frontalier accord 1983 :
   *  imposition exclusive en France, un versement suisse n'ouvre aucun
   *  droit à déduction nulle part). */
  applicable: "yes" | "conditional" | "no";
  /** true dès que taxSavings > 0 (la démarche vaut le coup) — sert à choisir
   *  la couleur du bandeau côté UI (vert/rouge) sans dupliquer la logique. */
  beneficial: boolean;
  note: string | null;
}

export function computeRegimeAwareDeduction(
  input: RegimeAwareDeductionInput,
): RegimeAwareDeductionResult {
  const { bundle, fallbackTaxInput, deductionAmount, deductionField } = input;

  if (!bundle) {
    const baseline = computeIncomeTax(fallbackTaxInput);
    const scenario = computeIncomeTax({
      ...fallbackTaxInput,
      [deductionField]: (fallbackTaxInput[deductionField] ?? 0) + deductionAmount,
    });
    const taxSavings = Math.round(baseline.totalTax - scenario.totalTax);
    return {
      taxSavings,
      effectiveCost: Math.round(deductionAmount - taxSavings),
      marginalRate: baseline.marginalRate,
      regime: "resident_ordinary",
      regimeLabel: "Résident, taxation ordinaire",
      applicable: "yes",
      beneficial: taxSavings > 0,
      note: null,
    };
  }

  // Même construction que buildTaxGlobalInput (client-dashboard) : fiche
  // client + défauts du calculateur Fiscal Global pour ce qui n'est pas
  // renseigné sur la fiche (taux de change, forfaits LAMal frontalier…).
  const partial = toTaxGlobalInput(bundle);
  const g: TaxGlobalInput = {
    ...createDefaultInput(),
    ...stripUndefined(partial as unknown as Record<string, unknown>),
  } as TaxGlobalInput;
  const det = detectRegime(g);

  const existing = g[deductionField] || 0;
  const baseline = computeTaxGlobal({ ...g, [deductionField]: existing });
  const scenario = computeTaxGlobal({ ...g, [deductionField]: existing + deductionAmount });
  const taxSavings = Math.round(baseline.totalTaxCHF - scenario.totalTaxCHF);
  const result = {
    taxSavings,
    effectiveCost: Math.round(deductionAmount - taxSavings),
    marginalRate: baseline.marginalRate,
    regime: det.regime,
    regimeLabel: det.regimeLabel,
  };

  if (det.regime === "resident_ordinary") {
    return { ...result, applicable: "yes", beneficial: taxSavings > 0, note: null };
  }

  if (det.regime === "cross_border_fr_1983") {
    return {
      ...result,
      applicable: "no",
      beneficial: false,
      note: `Frontalier sous l'accord franco-suisse de 1983 (travail ${g.canton}) : ce client est imposé exclusivement en France. Un versement 3e pilier A ou un rachat LPP suisse n'ouvre aucun droit à déduction, ni côté suisse ni côté français, donc aucune économie réelle ici.`,
    };
  }

  // source_taxed / tou / cross_border_ge / cross_border_other : retenue à la
  // source par défaut, jamais affectée par un 3a/rachat LPP. `scenario`
  // (computeTaxGlobal avec la déduction testée) expose déjà touComparison —
  // même objet, même texte explicatif (recommendationText) que ce que
  // Fiscal Global affiche pour le même client/la même déduction : un seul
  // endroit qui rédige "pourquoi", jamais un second texte qui diverge.
  const tou = scenario.touComparison;
  if (!tou) {
    // Ne devrait pas arriver (tous les régimes restants exposent
    // touComparison) — repli sûr plutôt qu'un crash.
    return {
      ...result,
      applicable: "conditional",
      beneficial: taxSavings > 0,
      note: null,
    };
  }
  if (tou.mandatory) {
    // Taxation ordinaire ultérieure obligatoire (salaire brut ≥ 120'000 CHF) :
    // la déduction s'applique d'office dans la déclaration, sans démarche.
    return {
      ...result,
      applicable: "yes",
      beneficial: taxSavings > 0,
      note: "Imposé à la source avec un salaire brut d'au moins 120 000 CHF : taxation ordinaire ultérieure obligatoire. La déduction s'applique d'office dans la déclaration d'impôt, sans démarche particulière.",
    };
  }
  const beneficial = taxSavings > 0;
  const deadlineNote = tou.recommendation === "tou"
    ? ` Démarche : demander la TOU auprès du canton avant le 31 mars ${g.taxYear + 1}.`
    : "";
  return {
    ...result,
    applicable: "conditional",
    beneficial,
    note: `${tou.recommendationText}${deadlineNote} Tant que la démarche n'est pas faite, la retenue à la source s'applique sans aucune déduction.`,
  };
}
