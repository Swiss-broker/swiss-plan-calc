// Types pour le Calculateur Fiscal Global.
// Unifie les inputs des 4 moteurs (income, source, cross-border, tou, health-france)
// dans une seule structure, et expose un résultat consolidé.

import type { IncomeTaxBreakdown } from "@/lib/tax/income";
import type { SourceTaxResult } from "@/lib/tax/source";
import type { CrossBorderResult } from "@/lib/tax/cross-border";
import type { QuasiResidentResult, TOUComparisonResult } from "@/lib/tax/tou";
import type { HealthFranceResult } from "@/lib/health-france";

export type Regime =
  | "resident_ordinary" // permis C ou suisse, résident CH
  | "source_taxed" // permis B/L, résident CH
  | "cross_border_ge" // frontalier travaillant à GE
  | "cross_border_fr_1983" // frontalier accord 1983
  | "cross_border_other" // frontalier hors GE/accord 1983
  | "tou" // quasi-résident éligible TOU
  | "unknown";

/** Statuts civils complets — alignés avec l'enum DB + concubinage (non persisté). */
export type GlobalCivilStatus =
  | "single"
  | "married"
  | "registered_partnership"
  | "cohabiting" // concubinage : imposition séparée en CH
  | "divorced"
  | "separated"
  | "widowed";

export interface TaxGlobalInput {
  // === Identité & ménage ===
  canton: string;
  countryOfResidence: string; // "CH", "FR", ...
  permit: "swiss" | "C" | "B" | "L" | "G" | "Ci" | "F" | "other";
  civilStatus: GlobalCivilStatus;
  spouseEmployed: boolean;
  children: number;
  confession: "none" | "catholic" | "protestant" | "other";
  age?: number;

  // === Revenus ===
  grossSalary: number;
  bonus: number;
  spouseGrossSalary: number;
  otherIncome: number;
  rentalIncome: number;
  imputedRent: number;
  foreignIncome: number;

  // === Patrimoine ===
  netWealth: number;

  // === Optimisations / déductions ===
  pillar3aContributions: number;
  /** Cotisations 3e pilier B (assurance-vie / épargne libre). */
  pillar3bContributions: number;
  lppBuyback: number;
  /** Capacité maximale de rachat LPP encore disponible (issue de la fiche client). */
  lppBuybackCapacity?: number;
  mortgageInterest: number;
  realEstateMaintenance: number;
  healthInsurancePremiums: number;
  childCareCosts: number;
  donations: number;

  // === Frontaliers ===
  eurChfRate: number;
  chfToEurRate: number;
  taxYear: number;
  lamalAdultMonthlyCHF: number;
  lamalChildMonthlyCHF: number;
}

export interface TaxGlobalResult {
  regime: Regime;
  regimeLabel: string;
  /** Tous les champs sont remplis selon le régime applicable */
  income?: IncomeTaxBreakdown;
  source?: SourceTaxResult;
  crossBorder?: CrossBorderResult;
  touEligibility?: QuasiResidentResult;
  touComparison?: TOUComparisonResult;
  health?: HealthFranceResult;

  // KPI consolidés
  /** Impôt total (CH + étranger) — n'inclut PAS les charges sociales / santé */
  totalTaxCHF: number;
  /** Charges sociales hors impôt (LAMal / CMU) — séparé pour clarté */
  socialChargesCHF: number;
  /** Revenu brut de référence utilisé pour les taux */
  grossIncomeCHF: number;
  /** Net annuel = brut − impôt − charges sociales */
  netAnnualCHF: number;
  /** Part suisse (impôt CH retenu) */
  swissShareCHF: number;
  /** Part étrangère (impôt pays de résidence) */
  foreignShareCHF: number;
  effectiveRate: number;
  marginalRate: number;
  notes: string[];
  /** Trace pédagogique (origine régime, valeurs intermédiaires, hypothèses). */
  trace?: TaxGlobalTrace;
}

/** Trace pédagogique pour le panneau "comment ce résultat est calculé". */
export interface TaxGlobalTrace {
  /** Pourquoi ce régime a été détecté. */
  regimeReason: string;
  /** Inputs clés utilisés pour la détection. */
  detection: {
    canton: string;
    permit: string;
    countryOfResidence: string;
    swissShareOfWorldwide?: number; // en %, pour TOU
  };
  /** Hypothèses appliquées par le moteur. */
  assumptions: string[];
  /** Limites connues du calcul pour ce régime. */
  limits: string[];
}
