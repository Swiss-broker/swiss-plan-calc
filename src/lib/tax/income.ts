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
import { lppCreditRate } from "@/lib/lpp";

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
  /** Âge du contribuable (utilisé pour calculer la part salarié LPP). Défaut 40. */
  age?: number;
  /** Âge du conjoint (pour part salarié LPP conjoint). */
  spouseAge?: number;
  /** Plan LPP appliqué : obligatoire (plafond 90'720), cadres (sur-obligatoire jusqu'à ~362'880), 1e (jusqu'à 860'000). */
  lppPlan?: "mandatory" | "cadres" | "1e";
  /** Idem côté conjoint */
  spouseLppPlan?: "mandatory" | "cadres" | "1e";
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
    ac: number;
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
/** Forfait fédéral assurance maladie (IFD) */
export const HEALTH_INSURANCE_MAX_SINGLE = 1_800;
export const HEALTH_INSURANCE_MAX_MARRIED = 3_600;
export const HEALTH_INSURANCE_PER_CHILD = 700;

/**
 * Forfaits cantonaux 2026 pour primes d'assurance-maladie + LCA (déduction
 * cantonale). Valeurs indicatives publiées par les administrations fiscales
 * cantonales — utilisées si l'utilisateur ne saisit pas ses primes réelles.
 * Format : { single, married, perChild }.
 */
export const HEALTH_INSURANCE_CANTONAL_2026: Record<
  string,
  { single: number; married: number; perChild: number }
> = {
  GE: { single: 2_400, married: 4_800, perChild: 1_200 },
  VD: { single: 2_200, married: 4_400, perChild: 1_300 },
  VS: { single: 2_200, married: 4_400, perChild: 1_100 },
  FR: { single: 2_000, married: 4_000, perChild: 1_000 },
  NE: { single: 2_300, married: 4_600, perChild: 1_200 },
  JU: { single: 2_100, married: 4_200, perChild: 1_100 },
  BE: { single: 2_600, married: 5_200, perChild: 1_400 },
  ZH: { single: 2_600, married: 5_200, perChild: 1_300 },
  BS: { single: 2_400, married: 4_800, perChild: 1_200 },
  BL: { single: 2_400, married: 4_800, perChild: 1_200 },
  TI: { single: 2_300, married: 4_600, perChild: 1_200 },
};
export const CHILDCARE_MAX_FEDERAL_2026 = 25_500;
// Cotisations sociales 2026 (parts salarié)
export const AVS_AI_APG_RATE = 0.053; // AVS 5.3% (AI/APG inclus dans le taux global salarié)
export const AC_RATE = 0.011; // 1.1% jusqu'au plafond AC
export const AC_COMPLEMENTARY_RATE = 0.005; // 0.5% au-delà du plafond
export const AC_CEILING_2026 = 148_200; // Plafond AC 2026

/**
 * Estime les cotisations sociales déductibles part salarié (AVS/AI/APG + AC + LPP).
 * - AVS/AI/APG : 5.3% du salaire brut (sans plafond)
 * - AC : 1.1% jusqu'à 148'200 + 0.5% au-delà (cotisation de solidarité)
 * - LPP : bonification selon âge × salaire coordonné × 50% (part salarié)
 */
export function estimateSocialContributions(
  grossSalary: number,
  age: number = 40,
  plan: "mandatory" | "cadres" | "1e" = "mandatory",
): { avs: number; ac: number; lpp: number } {
  const avs = grossSalary * AVS_AI_APG_RATE;
  const acBase = Math.min(grossSalary, AC_CEILING_2026) * AC_RATE;
  const acComp = Math.max(0, grossSalary - AC_CEILING_2026) * AC_COMPLEMENTARY_RATE;
  const ac = acBase + acComp;

  // LPP : bonification (selon âge) × salaire coordonné, dont 50% part salarié.
  // Plafond du salaire assuré dépend du plan :
  //  - mandatory : LPP_2026.maxInsuredSalary (90'720)
  //  - cadres    : 4× plafond LPP, soit ~362'880 (sur-obligatoire courant)
  //  - 1e        : LPP_2026.oneEPlanCap (860'000)
  const planCap =
    plan === "1e"
      ? LPP_2026.oneEPlanCap
      : plan === "cadres"
        ? LPP_2026.maxInsuredSalary * 4
        : LPP_2026.maxInsuredSalary;
  const cappedSalary = Math.min(grossSalary, planCap);
  const coordinated = Math.max(0, cappedSalary - LPP_2026.coordinationDeduction);
  const creditRate = lppCreditRate(age) || 0.10;
  const lppEmployerEmployee = coordinated * creditRate;
  const lpp = lppEmployerEmployee * 0.5;

  return { avs: Math.round(avs), ac: Math.round(ac), lpp: Math.round(lpp) };
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

  // Cotisations sociales obligatoires part salarié (déductibles à 100%)
  const social = estimateSocialContributions(grossSalary, input.age, input.lppPlan);
  const spouseSocial = isMarried
    ? estimateSocialContributions(spouseSalary, input.spouseAge, input.spouseLppPlan)
    : { avs: 0, ac: 0, lpp: 0 };
  const avsTotal = social.avs + spouseSocial.avs;
  const acTotal = social.ac + spouseSocial.ac;
  const lppTotal = social.lpp + spouseSocial.lpp;

  // 3a (plafonné)
  const pillar3a = Math.min(
    input.pillar3aContributions ?? 0,
    isMarried ? PILLAR_3A_MAX_2026_LPP * 2 : PILLAR_3A_MAX_2026_LPP,
  );

  // Rachat LPP (entièrement déductible)
  const lppBuyback = input.lppBuyback ?? 0;

  // Frais professionnels : 3% du salaire NET (brut - AVS - AC - LPP), bornes 2'000 / 4'000
  let professional = input.professionalExpenses ?? 0;
  if (!input.professionalExpenses) {
    const netSalary = Math.max(
      0,
      grossSalary + spouseSalary - avsTotal - acTotal - lppTotal,
    );
    const forfait = netSalary * PROFESSIONAL_FORFAIT_RATE;
    professional = Math.max(
      PROFESSIONAL_FORFAIT_MIN,
      Math.min(PROFESSIONAL_FORFAIT_MAX, forfait),
    );
  }

  const commuting = Math.min(input.commutingExpenses ?? 0, COMMUTING_MAX_FEDERAL_2026);
  const meals = Math.min(input.mealExpenses ?? 0, MEALS_FORFAIT_ANNUAL);

  const mortgage = input.mortgageInterest ?? 0;
  const realEstate = input.realEstateMaintenance ?? 0;

  // Primes d'assurance maladie : forfait cantonal si dispo, sinon forfait fédéral
  const cantonalForfait = HEALTH_INSURANCE_CANTONAL_2026[input.canton];
  const healthBase = cantonalForfait
    ? isMarried
      ? cantonalForfait.married
      : cantonalForfait.single
    : isMarried
      ? HEALTH_INSURANCE_MAX_MARRIED
      : HEALTH_INSURANCE_MAX_SINGLE;
  const perChild = cantonalForfait ? cantonalForfait.perChild : HEALTH_INSURANCE_PER_CHILD;
  const healthChildren = (input.children ?? 0) * perChild;
  const healthInsurance = input.healthInsurancePremiums
    ? Math.min(input.healthInsurancePremiums, healthBase + healthChildren)
    : healthBase + healthChildren;

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
    acTotal +
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
  // IFD : déduction fédérale supplémentaire par enfant à charge (art. 35 LIFD)
  // 6 700 CHF par enfant + rabais 259 CHF/enfant sur l'impôt après calcul.
  const IFD_CHILD_INCOME_DEDUCTION = 6_700;
  const ifdChildIncomeDed = (input.children ?? 0) * IFD_CHILD_INCOME_DEDUCTION;
  const taxableIncomeIFD = Math.max(0, taxableIncomeCC - ifdChildIncomeDed);

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
      ac: acTotal,
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
