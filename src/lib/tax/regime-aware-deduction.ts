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
import { checkQuasiResident } from "./tou";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { detectRegime, createDefaultInput, isCoupleStatus } from "@/lib/tax-global/profile";
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
   *  "conditional" = effective uniquement après démarche TOU (quasi-résident
   *  éligible) — tant que la démarche n'est pas faite, la retenue à la source
   *  s'applique sans aucune déduction.
   *  "no" = aucune économie réelle possible (non quasi-résident, ou
   *  frontalier accord 1983 : imposition exclusive en France). */
  applicable: "yes" | "conditional" | "no";
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
    return { ...result, applicable: "yes", note: null };
  }

  if (det.regime === "cross_border_fr_1983") {
    return {
      ...result,
      applicable: "no",
      note: `Frontalier sous l'accord franco-suisse de 1983 (travail ${g.canton}) : ce client est imposé exclusivement en France. Un versement 3e pilier A ou un rachat LPP suisse n'ouvre aucun droit à déduction, ni côté suisse ni côté français — aucune économie réelle ici.`,
    };
  }

  // source_taxed / tou / cross_border_ge / cross_border_other : retenue à la
  // source par défaut, jamais affectée par un 3a/rachat LPP. L'économie
  // ci-dessus (computeTaxGlobal) ne devient non nulle que si la taxation
  // ordinaire/TOU avec cette déduction devient plus avantageuse que la
  // retenue — exactement la même règle d'affichage que Fiscal Global.
  const couple = isCoupleStatus(g.civilStatus);
  const swissIncome =
    g.grossSalary + g.bonus + (couple ? g.spouseGrossSalary : 0) + g.otherIncome + g.rentalIncome;
  const worldwide = swissIncome + g.foreignIncome;
  const touEligibility = checkQuasiResident({
    worldwideIncome: worldwide,
    swissIncome,
    isEUEFTAResident: true,
  });

  if (touEligibility.eligibleForTOU) {
    return {
      ...result,
      applicable: "conditional",
      note: `Économie estimée en cas de Taxation Ordinaire Ultérieure (TOU) : client quasi-résident éligible (${touEligibility.swissShare}% du revenu mondial en CH, seuil 90%). Elle ne devient réelle qu'après demande de TOU auprès du canton (délai : 31 mars ${g.taxYear + 1}). Tant que la TOU n'est pas demandée, la retenue à la source s'applique sans aucune déduction.`,
    };
  }

  return {
    ...result,
    taxSavings: 0,
    effectiveCost: deductionAmount,
    applicable: "no",
    note: `Client non quasi-résident (${touEligibility.swissShare}% du revenu mondial en CH, seuil 90%) : la retenue à la source ne tient pas compte des cotisations 3e pilier A ni des rachats LPP. Aucune économie réelle sans Taxation Ordinaire Ultérieure (TOU), inaccessible dans sa situation actuelle.`,
  };
}
