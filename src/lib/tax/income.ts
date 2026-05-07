// Calcul global de l'impôt sur le revenu (IFD + ICC) pour une situation donnée.
// Combine `ifd.ts`, `cantons.ts` et applique les déductions standard suisses.

import { computeIFD, ifdMarginalRate, type FilingStatus } from "./ifd";
import {
  computeCantonalCommunal,
  computeWealthTax,
  CANTON_SCALES,
  type CCComputeResult,
} from "./cantons";
import { LPP_2026 } from "@/lib/lpp/parameters-2026";

export interface IncomeTaxInput {
  /** Code canton */
  canton: string;
  /** Surcharge facultative du multiplicateur communal (chef-lieu si non fourni) */
  communalMultiplier?: number;
  cantonalMultiplier?: number;
  /** Statut civil */
  status: FilingStatus;
  confession?: "none" | "catholic" | "protestant" | "other";
  children?: number;
  /** Confession du conjoint (impacte la part paroissiale couple) */
  spouseConfession?: "none" | "catholic" | "protestant" | "other";

  // Revenus bruts
  grossSalary: number;
  spouseGrossSalary?: number;
  bonus?: number;
  otherIncome?: number;
  /** Loyer locatif (si bien immobilier loué) */
  rentalIncome?: number;
  /** Valeur locative (résidence principale si propriétaire) */
  imputedRent?: number;

  // Déductions individualisables
  /** Cotisations 3a versées dans l'année */
  pillar3aContributions?: number;
  /** Rachat LPP versé dans l'année */
  lppBuyback?: number;
  /** Frais professionnels effectifs (sinon forfait calculé) */
  professionalExpenses?: number;
  /** Trajets domicile-travail (CHF) */
  commutingExpenses?: number;
  /** Repas hors domicile (CHF) */
  mealExpenses?: number;
  /** Intérêts hypothécaires */
  mortgageInterest?: number;
  /** Frais d'entretien immobilier */
  realEstateMaintenance?: number;
  /** Primes d'assurance maladie + LCA */
  healthInsurancePremiums?: number;
  /** Frais de garde (CHF) · par enfant ouvert au max légal */
  childCareCosts?: number;
  /** Donations à but utilité publique */
  donations?: number;

  // Patrimoine
  netWealth?: number;
}

export interface IncomeTaxBreakdown {
  /** Revenu brut total */
  grossIncome: number;
  /** Total des déductions appliquées */
  totalDeductions: number;
  /** Revenu net imposable (ICC) */
  taxableIncomeCC: number;
  /** Revenu net imposable (IFD) · souvent identique mais peut différer */
  taxableIncomeIFD: number;
  /** Détails déductions */
  deductions: {
    avs: number;
    lpp: number;
    pillar3a: number;
    lppBuyback: number;
    professional: number;
    commuting: number;
    meals: number;
    mortgage: number;
    realEstate: number;
    healthInsurance: number;
    childCare: number;
    donations: number;
    children: number;
    married: number;
  };
  // Impôts
  ifd: number;
  cantonal: number;
  communal: number;
  church: number;
  wealthTax: number;
  totalIncomeTax: number;
  totalTax: number;
  /** Taux d'imposition effectif total */
  effectiveRate: number;
  /** Taux marginal global (IFD + ICC) */
  marginalRate: number;
  cantonalDetail: CCComputeResult;
}

// Plafonds 2026 (AFC + caisses LPP)
export const PILLAR_3A_MAX_2026_LPP = 7_258; // affilié à une LPP
export const PILLAR_3A_MAX_2026_NO_LPP = 36_288; // 20% du revenu, max
export const COMMUTING_MAX_FEDERAL_2026 = 3_300;
export const MEALS_FORFAIT_ANNUAL = 3_200;
export const PROFESSIONAL_FORFAIT_RATE = 0.03; // 3% du salaire net
export const PROFESSIONAL_FORFAIT_MIN = 2_000;
export const PROFESSIONAL_FORFAIT_MAX = 4_000;
export const HEALTH_INSURANCE_MAX_SINGLE = 1_800;
export const HEALTH_INSURANCE_MAX_MARRIED = 3_600;
export const HEALTH_INSURANCE_PER_CHILD = 700;
export const CHILDCARE_MAX_FEDERAL_2026 = 25_500;
export const AVS_AI_APG_RATE = 0.0625; // 5.3% AVS + 0.7% AI + 0.25% APG (employé) → 6.25% côté salarié AVS+AI+APG+AC

/**
 * Estime les cotisations sociales déductibles (AVS/AI/APG/AC + LPP standard).
 */
export function estimateSocialContributions(grossSalary: number): {
  avs: number;
  lpp: number;
} {
  const avs = grossSalary * AVS_AI_APG_RATE;
  // LPP estimé : 7.5% du salaire coordonné moyen (bonification + risque)
  // Salaire coordonné = max(0, min(brut, plafond LPP) - déduction de coordination)
  const cappedSalary = Math.min(grossSalary, LPP_2026.maxInsuredSalary);
  const coordinated = Math.max(0, cappedSalary - LPP_2026.coordinationDeduction);
  const lpp = coordinated * 0.075;
  return { avs: Math.round(avs), lpp: Math.round(lpp) };
}

/**
 * Calcul complet impôt revenu + fortune pour une situation donnée.
 */
export function computeIncomeTax(input: IncomeTaxInput): IncomeTaxBreakdown {
  const isMarried = input.status === "married";
  const grossSalary = input.grossSalary ?? 0;
  const spouseSalary = isMarried ? (input.spouseGrossSalary ?? 0) : 0;
  const bonus = input.bonus ?? 0;
  const otherIncome = input.otherIncome ?? 0;
  const rental = input.rentalIncome ?? 0;
  const imputed = input.imputedRent ?? 0;

  const grossIncome = grossSalary + spouseSalary + bonus + otherIncome + rental + imputed;

  // Cotisations sociales obligatoires (déductibles à 100%)
  const social = estimateSocialContributions(grossSalary);
  const spouseSocial = isMarried
    ? estimateSocialContributions(spouseSalary)
    : { avs: 0, lpp: 0 };
  const avsTotal = social.avs + spouseSocial.avs;
  const lppTotal = social.lpp + spouseSocial.lpp;

  // 3a (plafonné)
  const pillar3a = Math.min(
    input.pillar3aContributions ?? 0,
    isMarried ? PILLAR_3A_MAX_2026_LPP * 2 : PILLAR_3A_MAX_2026_LPP,
  );

  // Rachat LPP (entièrement déductible)
  const lppBuyback = input.lppBuyback ?? 0;

  // Frais professionnels
  let professional = input.professionalExpenses ?? 0;
  if (!input.professionalExpenses) {
    const forfait = grossSalary * PROFESSIONAL_FORFAIT_RATE;
    professional = Math.max(
      PROFESSIONAL_FORFAIT_MIN,
      Math.min(PROFESSIONAL_FORFAIT_MAX, forfait),
    );
  }

  const commuting = Math.min(input.commutingExpenses ?? 0, COMMUTING_MAX_FEDERAL_2026);
  const meals = Math.min(input.mealExpenses ?? 0, MEALS_FORFAIT_ANNUAL);

  const mortgage = input.mortgageInterest ?? 0;
  const realEstate = input.realEstateMaintenance ?? 0;

  // Primes d'assurance maladie : forfaitaire selon situation
  const healthBase = isMarried ? HEALTH_INSURANCE_MAX_MARRIED : HEALTH_INSURANCE_MAX_SINGLE;
  const healthChildren = (input.children ?? 0) * HEALTH_INSURANCE_PER_CHILD;
  const healthInsurance = Math.min(
    input.healthInsurancePremiums ?? healthBase + healthChildren,
    healthBase + healthChildren,
  );

  const childCare = Math.min(
    input.childCareCosts ?? 0,
    (input.children ?? 0) * CHILDCARE_MAX_FEDERAL_2026,
  );
  const donations = input.donations ?? 0;

  // Déductions sociales : appliquées à l'ICC via canton (children/married)
  const childrenDed = 0; // intégré au calcul cantonal
  const marriedDed = 0; // intégré au calcul cantonal

  const totalDeductions =
    avsTotal +
    lppTotal +
    pillar3a +
    lppBuyback +
    professional +
    commuting +
    meals +
    mortgage +
    realEstate +
    healthInsurance +
    childCare +
    donations;

  const taxableIncomeCC = Math.max(0, grossIncome - totalDeductions);
  // Pour l'IFD, on applique la déduction enfants fédérale après calcul (cf. art. 35 LIFD)
  const taxableIncomeIFD = taxableIncomeCC;

  // IFD
  const ifdGross = computeIFD(taxableIncomeIFD, input.status);
  // Déduction par enfant IFD (rabais d'impôt)
  const ifdChildRebate = (input.children ?? 0) * 259; // CHF par enfant 2026 (rabais sur impôt)
  const ifd = Math.max(0, ifdGross - ifdChildRebate);

  const cc = computeCantonalCommunal({
    canton: input.canton,
    taxableIncome: taxableIncomeCC,
    status: input.status,
    children: input.children ?? 0,
    confession: input.confession,
    cantonalMultiplier: input.cantonalMultiplier,
    communalMultiplier: input.communalMultiplier,
  });

  const wealthTax = computeWealthTax({
    canton: input.canton,
    netWealth: input.netWealth ?? 0,
    status: input.status,
    cantonalMultiplier: input.cantonalMultiplier,
    communalMultiplier: input.communalMultiplier,
  });

  const totalIncomeTax = ifd + cc.cantonal + cc.communal + cc.church;
  const totalTax = totalIncomeTax + wealthTax;
  const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
  const marginalRate = ifdMarginalRate(taxableIncomeIFD, input.status) + cc.marginalRate;

  return {
    grossIncome,
    totalDeductions,
    taxableIncomeCC,
    taxableIncomeIFD,
    deductions: {
      avs: avsTotal,
      lpp: lppTotal,
      pillar3a,
      lppBuyback,
      professional,
      commuting,
      meals,
      mortgage,
      realEstate,
      healthInsurance,
      childCare,
      donations,
      children: childrenDed,
      married: marriedDed,
    },
    ifd: Math.round(ifd * 100) / 100,
    cantonal: cc.cantonal,
    communal: cc.communal,
    church: cc.church,
    wealthTax,
    totalIncomeTax: Math.round(totalIncomeTax * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    marginalRate: Math.round(marginalRate * 100) / 100,
    cantonalDetail: cc,
  };
}

/** Compare deux scénarios (avant/après) et renvoie le delta */
export function compareScenarios(
  baseline: IncomeTaxBreakdown,
  scenario: IncomeTaxBreakdown,
) {
  return {
    deltaIFD: scenario.ifd - baseline.ifd,
    deltaCantonal: scenario.cantonal - baseline.cantonal,
    deltaCommunal: scenario.communal - baseline.communal,
    deltaChurch: scenario.church - baseline.church,
    deltaWealth: scenario.wealthTax - baseline.wealthTax,
    deltaTotal: scenario.totalTax - baseline.totalTax,
    /** Économie réalisée (positive si scénario > baseline réduit l'impôt) */
    savings: baseline.totalTax - scenario.totalTax,
  };
}

export { CANTON_SCALES };
