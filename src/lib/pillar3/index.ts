// Pilier 3a · calculs cotisations max, économies fiscales, projections, retraits étalés.
import { computeIncomeTax, type IncomeTaxInput } from "../tax/income";
import { capitalWithdrawalTax } from "../lpp";

export const PILLAR_3A_MAX_LPP_2026 = 7_258;
export const PILLAR_3A_MAX_NO_LPP_2026 = 36_288;
export const PILLAR_3A_NO_LPP_RATE = 0.2; // 20% du revenu, plafonné

export interface Pillar3aMaxInput {
  hasLPP: boolean;
  netSelfEmploymentIncome?: number;
}

export function pillar3aMaxContribution(input: Pillar3aMaxInput): number {
  if (input.hasLPP) return PILLAR_3A_MAX_LPP_2026;
  const ratio = (input.netSelfEmploymentIncome ?? 0) * PILLAR_3A_NO_LPP_RATE;
  return Math.min(PILLAR_3A_MAX_NO_LPP_2026, Math.round(ratio));
}

export interface Pillar3aSavingsInput {
  taxInput: IncomeTaxInput;
  contribution: number;
}

export interface Pillar3aSavingsResult {
  taxSavings: number;
  effectiveCost: number;
  marginalRate: number;
}

export function pillar3aTaxSavings(input: Pillar3aSavingsInput): Pillar3aSavingsResult {
  const baseline = computeIncomeTax(input.taxInput);
  const scenario = computeIncomeTax({
    ...input.taxInput,
    pillar3aContributions: (input.taxInput.pillar3aContributions ?? 0) + input.contribution,
  });
  const taxSavings = baseline.totalTax - scenario.totalTax;
  return {
    taxSavings: Math.round(taxSavings),
    effectiveCost: Math.round(input.contribution - taxSavings),
    marginalRate: baseline.marginalRate,
  };
}

export interface Pillar3aProjectionInput {
  currentBalance: number;
  yearlyContribution: number;
  years: number;
  /** Rendement net annuel (%) */
  expectedReturnRate?: number;
}

export interface Pillar3aProjectionResult {
  finalBalance: number;
  totalContributions: number;
  totalReturns: number;
  yearly: Array<{ year: number; contribution: number; interest: number; balance: number }>;
}

export function projectPillar3a(input: Pillar3aProjectionInput): Pillar3aProjectionResult {
  const r = (input.expectedReturnRate ?? 2) / 100;
  let balance = input.currentBalance;
  const yearly: Pillar3aProjectionResult["yearly"] = [];

  for (let i = 0; i < input.years; i++) {
    const interest = balance * r;
    balance += interest + input.yearlyContribution;
    yearly.push({
      year: i + 1,
      contribution: input.yearlyContribution,
      interest: Math.round(interest),
      balance: Math.round(balance),
    });
  }

  const totalContributions = input.yearlyContribution * input.years;
  return {
    finalBalance: Math.round(balance),
    totalContributions,
    totalReturns: Math.round(balance - input.currentBalance - totalContributions),
    yearly,
  };
}

/**
 * Stratégie de retrait étalé du 3a sur N années (avant la retraite légale).
 * Permet de lisser l'impôt grâce à plusieurs comptes 3a.
 */
export interface StaggeredWithdrawalInput {
  totalCapital: number;
  numberOfAccounts: number; // 3 à 5 comptes recommandé
  canton: string;
  status: "single" | "married" | "single_with_children";
}

export interface StaggeredWithdrawalResult {
  perAccount: number;
  taxPerAccount: number;
  totalTaxSeparated: number;
  totalTaxSingle: number;
  /** Économie en CHF grâce au fractionnement */
  savings: number;
  /** Économie en % du capital */
  savingsRate: number;
}

export function staggeredWithdrawal(
  input: StaggeredWithdrawalInput,
): StaggeredWithdrawalResult {
  const perAccount = input.totalCapital / input.numberOfAccounts;
  const taxPerAccount = capitalWithdrawalTax({
    capital: perAccount,
    canton: input.canton,
    status: input.status,
  }).total;
  const totalTaxSeparated = taxPerAccount * input.numberOfAccounts;
  const totalTaxSingle = capitalWithdrawalTax({
    capital: input.totalCapital,
    canton: input.canton,
    status: input.status,
  }).total;
  const savings = totalTaxSingle - totalTaxSeparated;

  return {
    perAccount: Math.round(perAccount),
    taxPerAccount: Math.round(taxPerAccount),
    totalTaxSeparated: Math.round(totalTaxSeparated),
    totalTaxSingle: Math.round(totalTaxSingle),
    savings: Math.round(savings),
    savingsRate: input.totalCapital > 0
      ? Math.round((savings / input.totalCapital) * 1000) / 10
      : 0,
  };
}
