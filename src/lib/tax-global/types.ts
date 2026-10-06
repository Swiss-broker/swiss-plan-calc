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

/** Statuts civils complets, alignés avec l'enum DB + concubinage (non persisté). */
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
  /** Surcharge facultative du multiplicateur communal (chef-lieu si non fourni). */
  communalMultiplier?: number;
  /** VS uniquement : indexation communale réelle (%, ex. 166 pour 166%) —
   *  voir CCComputeOptions.vsIndexationPercent dans src/lib/tax/cantons.ts. */
  vsIndexationPercent?: number;
  countryOfResidence: string; // "CH", "FR", ...
  permit: "swiss" | "C" | "B" | "L" | "G" | "Ci" | "F" | "other";
  civilStatus: GlobalCivilStatus;
  spouseEmployed: boolean;
  children: number;
  /** Âge de chaque enfant. Utilisée uniquement par VS (déduction pour
   *  enfant dépendante de l'âge, Art. 31 al. 1 let. b LF). */
  childrenAges?: Array<number | null>;
  confession: "none" | "catholic" | "protestant" | "other";
  age?: number;
  /** Plan LPP appliqué (fiche client) : obligatoire, cadres (sur-obligatoire), 1e. */
  lppPlan?: "mandatory" | "cadres" | "1e";
  /** Salaire assuré LPP exact (certificat de prévoyance, fiche client) —
   *  remplace l'estimation par formule quand fourni. */
  lppInsuredSalary?: number;
  /** Statut d'activité (fiche client) — utilisé uniquement pour décider du
   *  traitement de `familyAllowances` (voir ce champ). */
  workStatus?: "employee" | "self_employed" | "mixed" | "retired" | "unemployed" | "student" | "director";

  // === Revenus ===
  grossSalary: number;
  bonus: number;
  spouseGrossSalary: number;
  otherIncome: number;
  rentalIncome: number;
  imputedRent: number;
  foreignIncome: number;
  /** Allocations familiales annuelles déclarées par le client (CHF/an),
   *  saisies telles quelles par le courtier pendant l'entretien. Pour un
   *  salarié, légalement déjà comprises dans le salaire brut (chiffre 1 du
   *  certificat de salaire, confirmé ESTV) : affichées à titre de repère,
   *  JAMAIS rajoutées au revenu imposable (sinon double-comptage). Pour un
   *  indépendant (pas de certificat de salaire), elles sont un revenu
   *  distinct et réel : ajoutées au revenu imposable. Voir `workStatus`. */
  familyAllowances: number;

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
  medicalExpenses: number;
  /** Frais de déplacement domicile-travail effectifs (sinon forfait implicite). */
  commutingExpenses?: number;
  /** Frais de repas hors domicile effectifs (sinon forfait implicite). */
  mealExpenses?: number;
  /** Frais professionnels effectifs, si supérieurs au forfait 3%/2'000-4'000. */
  professionalExpenses?: number;

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
  /** Impôt total (CH + étranger), n'inclut PAS les charges sociales / santé */
  totalTaxCHF: number;
  /** Charges sociales hors impôt (LAMal / CMU), séparé pour clarté */
  socialChargesCHF: number;
  /** Revenu brut de référence utilisé pour les taux */
  grossIncomeCHF: number;
  /** Net annuel = brut − impôt − charges sociales */
  netAnnualCHF: number;
  /** Part suisse (impôt CH retenu) */
  swissShareCHF: number;
  /** Part étrangère (impôt pays de résidence) */
  foreignShareCHF: number;
  /** Allocations familiales annuelles saisies sur la fiche client (CHF),
   *  affichées à titre de repère quel que soit le statut du client. */
  familyAllowancesCHF: number;
  /** true si `familyAllowancesCHF` a été ajouté au revenu imposable
   *  (indépendant, pas de salaire qui les inclurait déjà) ; false si
   *  seulement informatif (salarié, déjà compris dans le salaire brut). */
  familyAllowancesIncludedInIncome: boolean;
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
