// Types — Comparateur dividende/salaire/bénéfices pour dirigeants de société
// Phase 4.1 — Module de logique pure.

import type { SelectableCantonCode } from "@/lib/swiss/cantons";
import type { FilingStatus } from "@/lib/tax/ifd";

export type LppPlanKind = "mandatory" | "executive_1e";

export interface CompensationStrategy {
  /** Pourcentage du bénéfice total versé en SALAIRE (0-100) */
  salaryPct: number;
  /** Pourcentage versé en DIVIDENDES (0-100) */
  dividendPct: number;
  /** Pourcentage laissé en réserves dans la société (0-100) */
  retainedPct: number;
  /** Libellé optionnel (ex: "70% salaire / 30% dividendes") */
  label?: string;
}

export interface DirectorInputs {
  /** Bénéfice annuel total à répartir (CHF, AVANT charges sociales et impôt société) */
  totalProfit: number;
  /** Canton du siège social = canton de l'impôt société */
  companyCanton: SelectableCantonCode;
  /** Canton de domicile fiscal du dirigeant (impôt revenu) */
  directorCanton: SelectableCantonCode;
  /** Surcharge éventuelle multiplicateur communal du dirigeant */
  directorCommunalMultiplier?: number;
  /** Statut civil du dirigeant */
  status: FilingStatus;
  /** Nombre d'enfants à charge */
  children?: number;
  /** Confession (impôt paroissial) */
  confession?: "none" | "catholic" | "protestant" | "other";
  /** Âge du dirigeant (impacte les bonifications LPP) */
  age: number;
  /** Plan LPP appliqué */
  lppPlan: LppPlanKind;
  /** Détention qualifiée (≥10%) → imposition partielle dividendes */
  qualifiedHolding: boolean;
}

export interface EmployerCharges {
  avs: number;
  ac: number;
  familyAllowance: number;
  laaProfessional: number;
  lpp: number;
  total: number;
}

export interface EmployeeCharges {
  avs: number;
  ac: number;
  laaNonProfessional: number;
  lpp: number;
  total: number;
}

export interface CompanySideResult {
  grossSalary: number;
  employerCharges: EmployerCharges;
  totalSalaryCost: number;
  profitBeforeCorporateTax: number;
  corporateTax: number;
  netProfitAfterTax: number;
  dividendsTargeted: number;
  retainedTargeted: number;
  /** Vrai si le bénéfice net société ne couvre PAS les dividendes ciblés */
  dividendShortfall: boolean;
  /** Dividendes effectivement versables (cappés au net société) */
  dividendsPaid: number;
  retainedActual: number;
}

export interface DirectorSideResult {
  grossSalary: number;
  employeeCharges: EmployeeCharges;
  netSalary: number;
  dividendsReceived: number;
  /** Base imposable IFD (salaire + part fédérale dividende) */
  taxableIncomeIFD: number;
  /** Base imposable ICC (salaire + part cantonale dividende) */
  taxableIncomeICC: number;
  /** Fraction fédérale appliquée au dividende */
  dividendFederalFraction: number;
  /** Fraction cantonale appliquée au dividende */
  dividendCantonalFraction: number;
  ifd: number;
  cantonal: number;
  communal: number;
  church: number;
  totalIncomeTax: number;
  /** Net dans la poche : salaire net + dividendes - impôt revenu */
  netCash: number;
}

export interface CompensationResult {
  strategy: CompensationStrategy;
  inputs: DirectorInputs;
  company: CompanySideResult;
  director: DirectorSideResult;
  /** Total impôts + cotisations (société + dirigeant) */
  totalTaxAndCharges: number;
  /** Net dans la poche du dirigeant */
  directorNet: number;
  /** Réserves effectivement conservées en société */
  retainedInCompany: number;
  /** Vérif : directorNet + retainedInCompany + totalTaxAndCharges ≈ totalProfit */
  reconciliation: number;
  warnings: string[];
}

export const DEFAULT_PRESETS: CompensationStrategy[] = [
  { salaryPct: 100, dividendPct: 0, retainedPct: 0, label: "100% salaire" },
  { salaryPct: 70, dividendPct: 30, retainedPct: 0, label: "70/30" },
  { salaryPct: 50, dividendPct: 50, retainedPct: 0, label: "50/50" },
  { salaryPct: 30, dividendPct: 70, retainedPct: 0, label: "30/70" },
];
