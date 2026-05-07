// Comparateur dividende / salaire / bénéfices — fonctions de calcul pures.
// Phase 4.1.

import { computeIFD } from "@/lib/tax/ifd";
import { computeCantonalCommunal } from "@/lib/tax/cantons";
import {
  SOCIAL_RATES_2026 as SR,
  FAMILY_ALLOWANCE_RATE,
  CORPORATE_TAX_RATE,
  DIVIDEND_TAXABLE,
  LPP_PARAMS_2026,
  ageCreditRate,
  coordinatedSalary,
} from "./parameters-2026";
import type {
  CompensationResult,
  CompensationStrategy,
  CompanySideResult,
  DirectorInputs,
  DirectorSideResult,
  EmployeeCharges,
  EmployerCharges,
} from "./types";
import { DEFAULT_PRESETS } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Charges sociales
// ─────────────────────────────────────────────────────────────────────────────

export function computeEmployerCharges(
  grossSalary: number,
  inputs: Pick<DirectorInputs, "companyCanton" | "age" | "lppPlan">,
): EmployerCharges {
  if (grossSalary <= 0) {
    return { avs: 0, ac: 0, familyAllowance: 0, laaProfessional: 0, lpp: 0, total: 0 };
  }
  const avs = grossSalary * SR.avsEmployer;
  const ac = Math.min(grossSalary, SR.acCeiling) * SR.acEmployer;
  const familyAllowance = grossSalary * FAMILY_ALLOWANCE_RATE[inputs.companyCanton];
  const laaProfessional = grossSalary * SR.laaProfessionalDefault;

  // LPP : (bonification âge + risque/admin) × salaire coordonné × part employeur
  const coord = coordinatedSalary(grossSalary, inputs.lppPlan);
  const lppRateTotal = ageCreditRate(inputs.age) + LPP_PARAMS_2026.riskAndAdmin;
  const lpp = coord * lppRateTotal * LPP_PARAMS_2026.employerShare;

  const total = avs + ac + familyAllowance + laaProfessional + lpp;
  return {
    avs: round(avs),
    ac: round(ac),
    familyAllowance: round(familyAllowance),
    laaProfessional: round(laaProfessional),
    lpp: round(lpp),
    total: round(total),
  };
}

export function computeEmployeeCharges(
  grossSalary: number,
  inputs: Pick<DirectorInputs, "age" | "lppPlan">,
): EmployeeCharges {
  if (grossSalary <= 0) {
    return { avs: 0, ac: 0, laaNonProfessional: 0, lpp: 0, total: 0 };
  }
  const avs = grossSalary * SR.avsEmployee;
  const ac = Math.min(grossSalary, SR.acCeiling) * SR.acEmployee;
  const laaNonProfessional = grossSalary * SR.laaNonProfessionalDefault;
  const coord = coordinatedSalary(grossSalary, inputs.lppPlan);
  const lppRateTotal = ageCreditRate(inputs.age) + LPP_PARAMS_2026.riskAndAdmin;
  const lpp = coord * lppRateTotal * (1 - LPP_PARAMS_2026.employerShare);
  const total = avs + ac + laaNonProfessional + lpp;
  return {
    avs: round(avs),
    ac: round(ac),
    laaNonProfessional: round(laaNonProfessional),
    lpp: round(lpp),
    total: round(total),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Imposition partielle dividendes
// ─────────────────────────────────────────────────────────────────────────────

export function dividendTaxableFractions(
  canton: DirectorInputs["directorCanton"],
  qualified: boolean,
): { federal: number; cantonal: number } {
  if (!qualified) return { federal: 1, cantonal: 1 };
  return {
    federal: DIVIDEND_TAXABLE.federal,
    cantonal: DIVIDEND_TAXABLE.cantonal[canton],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Calcul d'une stratégie complète
// ─────────────────────────────────────────────────────────────────────────────

export function computeStrategy(
  inputs: DirectorInputs,
  strategy: CompensationStrategy,
): CompensationResult {
  const warnings: string[] = [];
  validateStrategy(strategy, warnings);

  const totalProfit = Math.max(0, inputs.totalProfit);

  // ── Côté société ────────────────────────────────────────────────────────
  // On résout le salaire de manière à ce que :
  //   salaire_brut + charges_employeur(salaire_brut) = pct_salaire × bénéfice_total
  // Comme charges_employeur est ~linéaire en grossSalary (sauf plafonds AC/LPP),
  // on inverse approximativement par itération (2 passes suffisent).
  const salaryBudget = totalProfit * (strategy.salaryPct / 100);
  const grossSalary = solveGrossSalaryFromBudget(salaryBudget, inputs);
  const employerCharges = computeEmployerCharges(grossSalary, inputs);
  const totalSalaryCost = grossSalary + employerCharges.total;

  const profitBeforeCorporateTax = Math.max(0, totalProfit - totalSalaryCost);
  const corporateTax = profitBeforeCorporateTax * CORPORATE_TAX_RATE[inputs.companyCanton];
  const netProfitAfterTax = profitBeforeCorporateTax - corporateTax;

  const dividendsTargeted = totalProfit * (strategy.dividendPct / 100);
  const retainedTargeted = totalProfit * (strategy.retainedPct / 100);

  let dividendsPaid = dividendsTargeted;
  let retainedActual = retainedTargeted;
  let dividendShortfall = false;

  // Vérif : dividendes + réserves doivent tenir dans le bénéfice net société.
  const distributable = dividendsTargeted + retainedTargeted;
  if (distributable > netProfitAfterTax + 1) {
    dividendShortfall = true;
    warnings.push(
      `Distribution impossible : bénéfice net société (${round(netProfitAfterTax)} CHF) ` +
        `< dividendes + réserves visés (${round(distributable)} CHF). ` +
        `Cap appliqué proportionnellement.`,
    );
    if (distributable > 0) {
      const ratio = netProfitAfterTax / distributable;
      dividendsPaid = Math.max(0, dividendsTargeted * ratio);
      retainedActual = Math.max(0, retainedTargeted * ratio);
    } else {
      dividendsPaid = 0;
      retainedActual = 0;
    }
  }

  if (strategy.salaryPct < 50 && grossSalary > 0) {
    warnings.push(
      "Salaire < 50% de la rémunération : risque de requalification fiscale " +
        "(théorie du dividende dissimulé). Le salaire doit rester usuel pour la branche.",
    );
  }

  const company: CompanySideResult = {
    grossSalary: round(grossSalary),
    employerCharges,
    totalSalaryCost: round(totalSalaryCost),
    profitBeforeCorporateTax: round(profitBeforeCorporateTax),
    corporateTax: round(corporateTax),
    netProfitAfterTax: round(netProfitAfterTax),
    dividendsTargeted: round(dividendsTargeted),
    retainedTargeted: round(retainedTargeted),
    dividendShortfall,
    dividendsPaid: round(dividendsPaid),
    retainedActual: round(retainedActual),
  };

  // ── Côté dirigeant ──────────────────────────────────────────────────────
  const employeeCharges = computeEmployeeCharges(grossSalary, inputs);
  const netSalary = grossSalary - employeeCharges.total;

  const fractions = dividendTaxableFractions(inputs.directorCanton, inputs.qualifiedHolding);
  // Cotisations sociales = déduction du revenu imposable (AVS+AC+LAA+LPP salarié)
  const socialDeductible = employeeCharges.total;

  // Base imposable = salaire NET de cotisations + dividende imposable partiel
  const taxableSalaryBase = Math.max(0, grossSalary - socialDeductible);
  const taxableIncomeIFD = taxableSalaryBase + dividendsPaid * fractions.federal;
  const taxableIncomeICC = taxableSalaryBase + dividendsPaid * fractions.cantonal;

  const ifd = computeIFD(taxableIncomeIFD, inputs.status);
  const cc = computeCantonalCommunal({
    canton: inputs.directorCanton,
    taxableIncome: taxableIncomeICC,
    status: inputs.status,
    children: inputs.children ?? 0,
    confession: inputs.confession,
    communalMultiplier: inputs.directorCommunalMultiplier,
  });

  const totalIncomeTax = ifd + cc.cantonal + cc.communal + cc.church;
  const netCash = netSalary + dividendsPaid - totalIncomeTax;

  const director: DirectorSideResult = {
    grossSalary: round(grossSalary),
    employeeCharges,
    netSalary: round(netSalary),
    dividendsReceived: round(dividendsPaid),
    taxableIncomeIFD: round(taxableIncomeIFD),
    taxableIncomeICC: round(taxableIncomeICC),
    dividendFederalFraction: fractions.federal,
    dividendCantonalFraction: fractions.cantonal,
    ifd: round(ifd),
    cantonal: round(cc.cantonal),
    communal: round(cc.communal),
    church: round(cc.church),
    totalIncomeTax: round(totalIncomeTax),
    netCash: round(netCash),
  };

  const totalTaxAndCharges =
    employerCharges.total + corporateTax + employeeCharges.total + totalIncomeTax;

  const reconciliation =
    director.netCash + company.retainedActual + totalTaxAndCharges - totalProfit;

  return {
    strategy,
    inputs,
    company,
    director,
    totalTaxAndCharges: round(totalTaxAndCharges),
    directorNet: round(director.netCash),
    retainedInCompany: round(company.retainedActual),
    reconciliation: round(reconciliation),
    warnings,
  };
}

export function computeAllStrategies(
  inputs: DirectorInputs,
  customStrategy?: CompensationStrategy,
): CompensationResult[] {
  const list: CompensationStrategy[] = [...DEFAULT_PRESETS];
  if (customStrategy) {
    list.push({ ...customStrategy, label: customStrategy.label ?? "Personnalisée" });
  }
  return list.map((s) => computeStrategy(inputs, s));
}

export function recommendBestStrategy(results: CompensationResult[]): {
  best: CompensationResult;
  reason: string;
} {
  // Critère = maximiser le net dirigeant (à bénéfice total constant).
  const sorted = [...results].sort((a, b) => b.directorNet - a.directorNet);
  const best = sorted[0];
  const reason =
    `Net dirigeant maximal (${round(best.directorNet)} CHF) parmi ${results.length} ` +
    `stratégies évaluées. Coût fiscal et social total : ${round(best.totalTaxAndCharges)} CHF.`;
  return { best, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function validateStrategy(s: CompensationStrategy, warnings: string[]): void {
  const sum = s.salaryPct + s.dividendPct + s.retainedPct;
  if (Math.abs(sum - 100) > 0.5) {
    warnings.push(`Stratégie invalide : la somme fait ${sum}% au lieu de 100%.`);
  }
}

/**
 * Inverse approximative : trouver le salaire brut tel que
 *   grossSalary + employerCharges(grossSalary) ≈ budget
 * Convergence rapide car les charges sont quasi-linéaires (sauf plafonds).
 */
function solveGrossSalaryFromBudget(
  budget: number,
  inputs: Pick<DirectorInputs, "companyCanton" | "age" | "lppPlan">,
): number {
  if (budget <= 0) return 0;
  // Estimation initiale : 87% du budget (charges ~13%)
  let gross = budget / 1.15;
  for (let i = 0; i < 6; i++) {
    const charges = computeEmployerCharges(gross, inputs).total;
    const totalCost = gross + charges;
    const error = totalCost - budget;
    if (Math.abs(error) < 1) break;
    // Ajustement proportionnel
    gross = gross - error * (gross / totalCost);
    if (gross < 0) gross = 0;
  }
  return gross;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export { DEFAULT_PRESETS } from "./types";
