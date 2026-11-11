// Comparateur dividende / salaire / bénéfices, fonctions de calcul pures.
// Phase 4.1.

import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { formatCHF } from "@/lib/format";
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
  const laaProfessional = Math.min(grossSalary, SR.laaCeiling) * SR.laaProfessionalDefault;

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
  const laaNonProfessional = Math.min(grossSalary, SR.laaCeiling) * SR.laaNonProfessionalDefault;
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
//  Impôt sur le revenu du dirigeant
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectorIncomeTax {
  taxableIncomeIFD: number;
  taxableIncomeICC: number;
  ifd: number;
  cantonal: number;
  communal: number;
  church: number;
  total: number;
}

/**
 * Impôt sur le revenu du dirigeant (salaire + dividendes), calculé par le
 * MÊME moteur que Fiscal global (computeIncomeTax) : mêmes cotisations
 * sociales déduites, mêmes forfaits (frais professionnels, primes
 * d'assurance), mêmes déductions pour enfants et couple. Avant, ce
 * comparateur taxait le salaire net sans aucune de ces déductions : pour la
 * même personne, il affichait un impôt plus élevé que Fiscal global.
 *
 * Les dividendes entrent comme autre revenu, pour leur seule part imposable
 * (imposition partielle). Cette part pouvant différer entre la
 * Confédération et le canton (ex. NE 60 %), l'IFD et l'impôt
 * cantonal/communal sont tirés de deux calculs distincts.
 */
export function computeDirectorIncomeTax(
  inputs: DirectorInputs,
  grossSalary: number,
  dividendsPaid: number,
): DirectorIncomeTax {
  if (grossSalary <= 0 && dividendsPaid <= 0) {
    return {
      taxableIncomeIFD: 0,
      taxableIncomeICC: 0,
      ifd: 0,
      cantonal: 0,
      communal: 0,
      church: 0,
      total: 0,
    };
  }
  const fractions = dividendTaxableFractions(inputs.directorCanton, inputs.qualifiedHolding);
  const base: IncomeTaxInput = {
    canton: inputs.directorCanton,
    communalMultiplier: inputs.directorCommunalMultiplier,
    vsIndexationPercent: inputs.directorVsIndexationPercent,
    status: inputs.status,
    confession: inputs.confession,
    children: inputs.children ?? 0,
    age: inputs.age,
    // Même salaire coordonné LPP que les charges sociales affichées ici.
    lppPlan: inputs.lppPlan === "executive_1e" ? "cadres" : "mandatory",
    lppInsuredSalary: coordinatedSalary(grossSalary, inputs.lppPlan) || undefined,
    workStatus: "director",
    grossSalary,
  };
  const federal = computeIncomeTax({ ...base, otherIncome: dividendsPaid * fractions.federal });
  const cantonalRun =
    fractions.cantonal === fractions.federal
      ? federal
      : computeIncomeTax({ ...base, otherIncome: dividendsPaid * fractions.cantonal });
  // Impôt personnel (taxe fixe, GE) : rattaché à la part cantonale.
  const cantonal = cantonalRun.cantonal + cantonalRun.personalTax;
  return {
    taxableIncomeIFD: federal.taxableIncomeIFD,
    taxableIncomeICC: cantonalRun.taxableIncomeCC,
    ifd: federal.ifd,
    cantonal,
    communal: cantonalRun.communal,
    church: cantonalRun.church,
    total: federal.ifd + cantonal + cantonalRun.communal + cantonalRun.church,
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
  const reserveTarget = Math.max(0, inputs.reserveTarget ?? 0);
  let availableProfit = totalProfit;
  if (reserveTarget > 0) {
    if (reserveTarget >= totalProfit) {
      warnings.push(
        `Réserve cible (${formatCHF(reserveTarget)}) supérieure ou égale au bénéfice ` +
          `total (${formatCHF(totalProfit)}) : aucune répartition salaire/dividende possible.`,
      );
      availableProfit = 0;
    } else {
      availableProfit = totalProfit - reserveTarget;
    }
  }

  // ── Côté société ────────────────────────────────────────────────────────
  const salaryBudget = availableProfit * (strategy.salaryPct / 100);
  const grossSalary = solveGrossSalaryFromBudget(salaryBudget, inputs);
  const employerCharges = computeEmployerCharges(grossSalary, inputs);
  const totalSalaryCost = grossSalary + employerCharges.total;

  const profitBeforeCorporateTax = Math.max(0, availableProfit - totalSalaryCost);
  const corporateTax = profitBeforeCorporateTax * CORPORATE_TAX_RATE[inputs.companyCanton];
  const netProfitAfterTax = profitBeforeCorporateTax - corporateTax;

  const dividendsTargeted = availableProfit * (strategy.dividendPct / 100);
  const retainedTargeted = availableProfit * (strategy.retainedPct / 100);

  let dividendsPaid = dividendsTargeted;
  let retainedActual = retainedTargeted;
  let dividendShortfall = false;

  if (dividendsTargeted > netProfitAfterTax + 1) {
    dividendShortfall = true;
    const delta = dividendsTargeted - netProfitAfterTax;
    dividendsPaid = Math.max(0, netProfitAfterTax);
    retainedActual = 0;
    warnings.push(
      `Dividendes ciblés (${formatCHF(dividendsTargeted)}) supérieurs au bénéfice ` +
        `net après IS (${formatCHF(netProfitAfterTax)}). Cappés à ` +
        `${formatCHF(dividendsPaid)} (delta ${formatCHF(delta)} absorbé par les ` +
        `charges sociales et l'impôt société).`,
    );
  } else if (dividendsTargeted + retainedTargeted > netProfitAfterTax + 1) {
    retainedActual = Math.max(0, netProfitAfterTax - dividendsTargeted);
  }

  // Réserve cible ajoutée à la réserve effective.
  retainedActual += reserveTarget;

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
    retainedTargeted: round(retainedTargeted + reserveTarget),
    dividendShortfall,
    dividendsPaid: round(dividendsPaid),
    retainedActual: round(retainedActual),
  };

  // ── Côté dirigeant ──────────────────────────────────────────────────────
  const employeeCharges = computeEmployeeCharges(grossSalary, inputs);
  const netSalary = grossSalary - employeeCharges.total;

  const fractions = dividendTaxableFractions(inputs.directorCanton, inputs.qualifiedHolding);
  const tax = computeDirectorIncomeTax(inputs, grossSalary, dividendsPaid);
  const { taxableIncomeIFD, taxableIncomeICC, ifd } = tax;
  const cc = { cantonal: tax.cantonal, communal: tax.communal, church: tax.church };
  const totalIncomeTax = tax.total;
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

/**
 * Calcule un résultat à partir d'une répartition ABSOLUE en CHF
 * (modélise la situation actuelle réelle d'un dirigeant).
 */
export function computeStrategyFromAbsolute(
  inputs: DirectorInputs,
  abs: import("./types").AbsoluteAllocation,
  label = "Situation actuelle",
): CompensationResult {
  const warnings: string[] = [];
  const totalProfit = Math.max(0, inputs.totalProfit);
  // Même base que computeStrategy : la réserve cible est déduite du bénéfice
  // disponible AVANT l'impôt société, pour que "situation actuelle" et
  // stratégies testées soient comparables à armes égales.
  const reserveTarget = Math.max(0, inputs.reserveTarget ?? 0);
  const availableProfit = reserveTarget >= totalProfit ? 0 : totalProfit - reserveTarget;
  const grossSalary = Math.max(0, abs.grossSalary);
  const dividendsTargeted = Math.max(0, abs.dividends);

  const employerCharges = computeEmployerCharges(grossSalary, inputs);
  const totalSalaryCost = grossSalary + employerCharges.total;

  const profitBeforeCorporateTax = Math.max(0, availableProfit - totalSalaryCost);
  const corporateTax = profitBeforeCorporateTax * CORPORATE_TAX_RATE[inputs.companyCanton];
  const netProfitAfterTax = profitBeforeCorporateTax - corporateTax;

  let dividendsPaid = dividendsTargeted;
  let dividendShortfall = false;
  if (dividendsTargeted > netProfitAfterTax + 1) {
    dividendShortfall = true;
    dividendsPaid = Math.max(0, netProfitAfterTax);
    warnings.push(
      `Situation actuelle : dividendes saisis (${formatCHF(dividendsTargeted)}) ` +
        `supérieurs au bénéfice net après IS (${formatCHF(netProfitAfterTax)}). ` +
        `Cappés à ${formatCHF(dividendsPaid)}.`,
    );
  }
  const retainedActual =
    (abs.retained != null
      ? Math.max(0, abs.retained)
      : Math.max(0, netProfitAfterTax - dividendsPaid)) + reserveTarget;

  const employeeCharges = computeEmployeeCharges(grossSalary, inputs);
  const netSalary = grossSalary - employeeCharges.total;
  const fractions = dividendTaxableFractions(inputs.directorCanton, inputs.qualifiedHolding);
  const tax = computeDirectorIncomeTax(inputs, grossSalary, dividendsPaid);
  const { taxableIncomeIFD, taxableIncomeICC, ifd } = tax;
  const cc = { cantonal: tax.cantonal, communal: tax.communal, church: tax.church };
  const totalIncomeTax = tax.total;
  const netCash = netSalary + dividendsPaid - totalIncomeTax;
  const totalTaxAndCharges =
    employerCharges.total + corporateTax + employeeCharges.total + totalIncomeTax;

  return {
    strategy: { salaryPct: 0, dividendPct: 0, retainedPct: 0, label },
    inputs,
    company: {
      grossSalary: round(grossSalary),
      employerCharges,
      totalSalaryCost: round(totalSalaryCost),
      profitBeforeCorporateTax: round(profitBeforeCorporateTax),
      corporateTax: round(corporateTax),
      netProfitAfterTax: round(netProfitAfterTax),
      dividendsTargeted: round(dividendsTargeted),
      retainedTargeted: round(retainedActual),
      dividendShortfall,
      dividendsPaid: round(dividendsPaid),
      retainedActual: round(retainedActual),
    },
    director: {
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
    },
    totalTaxAndCharges: round(totalTaxAndCharges),
    directorNet: round(netCash),
    retainedInCompany: round(retainedActual),
    reconciliation: round(netCash + retainedActual + totalTaxAndCharges - totalProfit),
    warnings,
  };
}

export function recommendBestStrategy(results: CompensationResult[]): {
  best: CompensationResult;
  reason: string;
} {
  // Critère = maximiser le net dirigeant (à bénéfice total constant).
  const sorted = [...results].sort((a, b) => b.directorNet - a.directorNet);
  const best = sorted[0];
  const reason =
    `Net dirigeant maximal (${formatCHF(best.directorNet)}) parmi ${results.length} ` +
    `stratégies évaluées. Coût fiscal et social total : ${formatCHF(best.totalTaxAndCharges)}.`;
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
