// Calculs LPP (2e pilier) · rachats, retraits, conversion en rente, projections.
// Bases : LPP / OPP2 valables 2026.

import { computeIncomeTax, type IncomeTaxInput } from "../tax/income";

// Constantes 2026
export const LPP_COORDINATION_DEDUCTION_2026 = 26_460;
export const LPP_MAX_INSURED_SALARY_2026 = 90_720; // 7.5x rente AVS max
export const LPP_MIN_ANNUAL_SALARY_2026 = 22_680;
export const LPP_CONVERSION_RATE_2026 = 6.8; // taux légal LPP
export const LPP_INTEREST_MIN_2026 = 1.25; // taux minimal LPP 2026

/** Bonifications de vieillesse LPP · barème légal */
export const LPP_AGE_CREDITS: Record<string, number> = {
  // Tranches d'âge → % du salaire coordonné
  "25-34": 0.07,
  "35-44": 0.1,
  "45-54": 0.15,
  "55-65": 0.18,
};

export function lppCreditRate(age: number): number {
  if (age < 25) return 0;
  if (age <= 34) return LPP_AGE_CREDITS["25-34"];
  if (age <= 44) return LPP_AGE_CREDITS["35-44"];
  if (age <= 54) return LPP_AGE_CREDITS["45-54"];
  if (age <= 65) return LPP_AGE_CREDITS["55-65"];
  return 0;
}

export interface LPPProjectionInput {
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  insuredSalary: number;
  /** Taux de croissance annuel attendu de la caisse, brut (default 1.5%) */
  expectedReturnRate?: number;
  /** Frais annuels (TER + frais admin) appliqués sur le capital, en % (default 0) */
  feeRate?: number;
  /** Croissance salariale annuelle (default 1%) */
  salaryGrowthRate?: number;
  /** Taux de conversion à la retraite (default 6.8 ou propre à la caisse) */
  conversionRate?: number;
  /** Bonifications additionnelles plan sur-obligatoire (% sup.) */
  extraCreditRate?: number;
  /** Rachat annuel additionnel injecté chaque année (CHF) */
  yearlyBuyback?: number;
  /** Nombre d'années sur lesquelles s'applique le rachat (default = jusqu'à la retraite) */
  buybackYears?: number;
  /** Plafond du salaire coordonné assuré. Default = LPP_MAX_INSURED_SALARY_2026 (90 720). Augmenter pour plans 1e / surobligatoires (cadres). */
  insuredSalaryCap?: number;
}

export interface LPPProjectionResult {
  /** Capital projeté à la retraite */
  projectedBalance: number;
  /** Capital projeté SANS rendement (référence) */
  projectedBalanceNoYield: number;
  /** Capital projeté SANS frais (rendement brut uniquement) */
  projectedBalanceGross: number;
  /** Rente annuelle estimée */
  annualPension: number;
  /** Rente mensuelle */
  monthlyPension: number;
  /** Taux net effectivement appliqué (%) = brut - frais */
  netReturnRate: number;
  /** Total des frais cumulés sur la période (CHF) */
  totalFees: number;
  /** Total des rachats injectés (CHF) */
  totalBuybacks: number;
  /** Détail année par année */
  yearly: Array<{
    age: number;
    salary: number;
    coordinated: number;
    credit: number;
    interest: number;
    fees: number;
    buyback: number;
    balance: number;
    balanceNoYield: number;
  }>;
}

export function projectLPP(input: LPPProjectionInput): LPPProjectionResult {
  const yearsToRetire = Math.max(0, input.retirementAge - input.currentAge);
  const grossReturn = (input.expectedReturnRate ?? 1.5) / 100;
  const fee = (input.feeRate ?? 0) / 100;
  const netReturn = grossReturn - fee;
  const salaryGrowth = (input.salaryGrowthRate ?? 1) / 100;
  const conversionRate = (input.conversionRate ?? LPP_CONVERSION_RATE_2026) / 100;
  const extraCredit = (input.extraCreditRate ?? 0) / 100;
  const yearlyBuyback = Math.max(0, input.yearlyBuyback ?? 0);
  const buybackYears = Math.max(0, input.buybackYears ?? yearsToRetire);

  let balance = input.currentBalance;
  let balanceNoYield = input.currentBalance;
  let balanceGross = input.currentBalance;
  let salary = input.insuredSalary;
  let totalFees = 0;
  let totalBuybacks = 0;
  const yearly: LPPProjectionResult["yearly"] = [];

  const insuredCap = Math.max(0, input.insuredSalaryCap ?? LPP_MAX_INSURED_SALARY_2026);

  for (let i = 0; i < yearsToRetire; i++) {
    const age = input.currentAge + i;
    const coordinated = Math.max(
      0,
      Math.min(salary - LPP_COORDINATION_DEDUCTION_2026, insuredCap),
    );
    const creditRate = lppCreditRate(age) + extraCredit;
    const credit = coordinated * creditRate;
    const grossInterest = balance * grossReturn;
    const fees = balance * fee;
    const interest = grossInterest - fees;
    const buyback = i < buybackYears ? yearlyBuyback : 0;

    balance = balance + credit + interest + buyback;
    balanceNoYield = balanceNoYield + credit + buyback;
    balanceGross = balanceGross + credit + grossInterest + buyback;
    totalFees += fees;
    totalBuybacks += buyback;

    yearly.push({
      age: age + 1,
      salary,
      coordinated,
      credit: Math.round(credit),
      interest: Math.round(interest),
      fees: Math.round(fees),
      buyback: Math.round(buyback),
      balance: Math.round(balance),
      balanceNoYield: Math.round(balanceNoYield),
    });
    salary *= 1 + salaryGrowth;
  }

  const annualPension = balance * conversionRate;
  return {
    projectedBalance: Math.round(balance),
    projectedBalanceNoYield: Math.round(balanceNoYield),
    projectedBalanceGross: Math.round(balanceGross),
    annualPension: Math.round(annualPension),
    monthlyPension: Math.round(annualPension / 12),
    netReturnRate: Math.round(netReturn * 10000) / 100,
    totalFees: Math.round(totalFees),
    totalBuybacks: Math.round(totalBuybacks),
    yearly,
  };
}

export interface LPPBuybackPlanInput {
  /** Capacité de rachat totale (CHF) */
  buybackCapacity: number;
  /** Sur combien d'années étaler */
  years: number;
  /** Situation fiscale du contribuable */
  taxInput: IncomeTaxInput;
}

export interface LPPBuybackPlanResult {
  /** Versement annuel prévu */
  yearlyAmount: number;
  /** Économie d'impôt totale sur la période */
  totalTaxSavings: number;
  /** Détail année par année */
  yearly: Array<{
    year: number;
    amount: number;
    taxSavings: number;
    effectiveCost: number;
  }>;
  /** ROI fiscal moyen (savings / total versé) */
  averageReturn: number;
}

/**
 * Simule un plan de rachat LPP étalé.
 * Pour chaque année, on calcule l'impôt avec et sans rachat.
 */
export function simulateBuybackPlan(input: LPPBuybackPlanInput): LPPBuybackPlanResult {
  const yearlyAmount = Math.round(input.buybackCapacity / input.years);
  const baseline = computeIncomeTax(input.taxInput);
  let totalSavings = 0;

  const yearly = Array.from({ length: input.years }, (_, i) => {
    const scenario = computeIncomeTax({
      ...input.taxInput,
      lppBuyback: yearlyAmount,
    });
    const taxSavings = baseline.totalTax - scenario.totalTax;
    totalSavings += taxSavings;
    return {
      year: i + 1,
      amount: yearlyAmount,
      taxSavings: Math.round(taxSavings),
      effectiveCost: Math.round(yearlyAmount - taxSavings),
    };
  });

  return {
    yearlyAmount,
    totalTaxSavings: Math.round(totalSavings),
    yearly,
    averageReturn:
      input.buybackCapacity > 0
        ? Math.round((totalSavings / input.buybackCapacity) * 1000) / 10
        : 0,
  };
}

/**
 * Compare rente vs capital à la retraite.
 * Hypothèse : impôt unique sur capital (1/5 du barème) ou rente annuelle au barème.
 */
export interface AnnuityVsLumpSumInput {
  capital: number;
  conversionRate?: number;
  /** Espérance de vie résiduelle en années */
  yearsAlive: number;
  /** Taux de placement net du capital si retiré (%) */
  selfReturnRate?: number;
  /** Taux marginal d'impôt sur la rente (%) */
  rentMarginalRate: number;
  /** Impôt unique sur le capital (CHF) déjà calculé */
  lumpSumTax: number;
}

export interface AnnuityVsLumpSumResult {
  totalRente: number;
  totalCapital: number;
  /** Solde total perçu sur la période */
  netAnnuity: number;
  netLumpSum: number;
  /** Recommandation textuelle */
  recommendation: "annuity" | "lump_sum" | "mixed";
}

export function annuityVsLumpSum(input: AnnuityVsLumpSumInput): AnnuityVsLumpSumResult {
  const cr = (input.conversionRate ?? LPP_CONVERSION_RATE_2026) / 100;
  const annualPension = input.capital * cr;
  const totalRente = annualPension * input.yearsAlive;
  const totalRenteAfterTax = totalRente * (1 - input.rentMarginalRate / 100);

  const r = (input.selfReturnRate ?? 1.5) / 100;
  const netCapital = input.capital - input.lumpSumTax;
  // Annuité fictive si capital placé : rendement annuel + ponction progressive
  const totalCapital = netCapital * Math.pow(1 + r, input.yearsAlive);

  let recommendation: "annuity" | "lump_sum" | "mixed";
  const diff = totalCapital - totalRenteAfterTax;
  if (Math.abs(diff) < input.capital * 0.05) recommendation = "mixed";
  else if (diff > 0) recommendation = "lump_sum";
  else recommendation = "annuity";

  return {
    totalRente: Math.round(totalRente),
    totalCapital: Math.round(totalCapital),
    netAnnuity: Math.round(totalRenteAfterTax),
    netLumpSum: Math.round(totalCapital),
    recommendation,
  };
}

/** Impôt unique sur prestation en capital (1/5 du barème, séparé du revenu) */
export function capitalWithdrawalTax(opts: {
  capital: number;
  canton: string;
  status: "single" | "married" | "single_with_children";
  /** Taux fédéral réduit appliqué */
}): { ifd: number; cantonal: number; total: number } {
  if (opts.capital <= 0) return { ifd: 0, cantonal: 0, total: 0 };
  // IFD : 1/5 du barème ordinaire
  const ifdFull = computeIncomeTax({
    canton: opts.canton,
    status: opts.status,
    grossSalary: opts.capital,
  }).ifd;
  const ifdReduced = ifdFull / 5;
  // Cantonal : approximation 4-7% selon canton
  const cantonalApprox = opts.capital * 0.045;
  return {
    ifd: Math.round(ifdReduced),
    cantonal: Math.round(cantonalApprox),
    total: Math.round(ifdReduced + cantonalApprox),
  };
}
