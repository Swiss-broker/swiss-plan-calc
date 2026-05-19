// Orchestrateur — appelle les moteurs existants selon le régime détecté.
// AUCUN calcul n'est réécrit : on délègue à income/source/cross-border/tou/health-france.

import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { computeSourceTax, inferSourceScale } from "@/lib/tax/source";
import { computeCrossBorder } from "@/lib/tax/cross-border";
import { checkQuasiResident, compareTOUvsSource } from "@/lib/tax/tou";
import { computeHealthFrance } from "@/lib/health-france";
import { detectRegime } from "./profile";
import type { TaxGlobalInput, TaxGlobalResult } from "./types";

export function toIncomeTaxInput(g: TaxGlobalInput): IncomeTaxInput {
  const status =
    g.civilStatus === "married"
      ? "married"
      : g.children > 0
        ? "single_with_children"
        : "single";
  return {
    canton: g.canton,
    status,
    confession: g.confession,
    children: g.children,
    age: g.age,
    grossSalary: g.grossSalary + g.bonus,
    spouseGrossSalary: g.civilStatus === "married" ? g.spouseGrossSalary : 0,
    otherIncome: g.otherIncome,
    rentalIncome: g.rentalIncome,
    imputedRent: g.imputedRent,
    pillar3aContributions: g.pillar3aContributions,
    lppBuyback: g.lppBuyback,
    mortgageInterest: g.mortgageInterest,
    realEstateMaintenance: g.realEstateMaintenance,
    healthInsurancePremiums: g.healthInsurancePremiums || undefined,
    childCareCosts: g.childCareCosts,
    donations: g.donations,
    netWealth: g.netWealth,
  };
}

export function computeTaxGlobal(g: TaxGlobalInput): TaxGlobalResult {
  const det = detectRegime(g);
  const notes: string[] = [det.reason];

  // ─────────────────────── RÉSIDENT ORDINAIRE ───────────────────────
  if (det.regime === "resident_ordinary") {
    const income = computeIncomeTax(toIncomeTaxInput(g));
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      income,
      totalTaxCHF: income.totalTax,
      netAnnualCHF: Math.max(0, income.grossIncome - income.totalTax),
      effectiveRate: income.effectiveRate,
      marginalRate: income.marginalRate,
      notes,
    };
  }

  // ─────────────────────── SOURCE / QUASI-RÉSIDENT ───────────────────────
  if (det.regime === "source_taxed" || det.regime === "tou") {
    const status =
      g.civilStatus === "married"
        ? "married"
        : g.children > 0
          ? "single_with_children"
          : "single";
    const scale = inferSourceScale(status, g.spouseEmployed);
    const source = computeSourceTax({
      monthlyGross: Math.round((g.grossSalary + g.bonus) / 12),
      spouseMonthlyGross:
        g.civilStatus === "married" && g.spouseEmployed
          ? Math.round(g.spouseGrossSalary / 12)
          : undefined,
      canton: g.canton,
      scale,
      children: g.children,
      church: g.confession !== "none",
    });

    const swissIncome =
      g.grossSalary +
      g.bonus +
      g.spouseGrossSalary +
      g.otherIncome +
      g.rentalIncome;
    const worldwide = swissIncome + g.foreignIncome;
    const touEligibility = checkQuasiResident({
      worldwideIncome: worldwide,
      swissIncome,
      isEUEFTAResident: true,
    });

    const touComparison = compareTOUvsSource({
      sourceTaxAnnual: source.annualTax,
      taxInput: toIncomeTaxInput(g),
      eligible: touEligibility.eligibleForTOU,
    });

    // KPI : prend le minimum (source ou TOU si éligible et avantageuse)
    const useTOU =
      touEligibility.eligibleForTOU && touComparison.ordinaryTax < source.annualTax;
    const total = useTOU ? touComparison.ordinaryTax : source.annualTax;
    const gross = g.grossSalary + g.bonus + g.spouseGrossSalary + g.otherIncome;
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      source,
      touEligibility,
      touComparison,
      totalTaxCHF: total,
      netAnnualCHF: Math.max(0, gross - total),
      effectiveRate: gross > 0 ? Math.round((total / gross) * 1000) / 10 : 0,
      marginalRate: touComparison.marginalRate,
      notes,
    };
  }

  // ─────────────────────── FRONTALIER FR (GE ou accord 1983) ───────────────────────
  if (det.regime === "cross_border_ge" || det.regime === "cross_border_fr_1983") {
    const crossBorder = computeCrossBorder({
      workCanton: g.canton,
      grossAnnualSalary: g.grossSalary + g.bonus,
      status: g.civilStatus,
      children: g.children,
      spouseEmployed: g.spouseEmployed,
      spouseGrossSalary: g.spouseGrossSalary,
      eurChfRate: g.eurChfRate,
    });

    // Couche santé : CMU vs LAMal
    const health = computeHealthFrance({
      swissGrossSalaryCHF: g.grossSalary + g.bonus,
      civilStatus: g.civilStatus,
      childrenCount: g.children,
      chfToEurRate: g.chfToEurRate,
      taxYear: g.taxYear,
      lamalAdultMonthlyCHF: g.lamalAdultMonthlyCHF,
      lamalChildMonthlyCHF: g.lamalChildMonthlyCHF,
    });

    const total = crossBorder.totalTax + health.recommendedAnnualCHF;
    const gross = g.grossSalary + g.bonus;
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      crossBorder,
      health,
      totalTaxCHF: total,
      netAnnualCHF: Math.max(0, gross - total),
      effectiveRate: gross > 0 ? Math.round((total / gross) * 1000) / 10 : 0,
      marginalRate: 0,
      notes: [...notes, ...crossBorder.notes],
    };
  }

  // ─────────────────────── INCONNU ───────────────────────
  return {
    regime: "unknown",
    regimeLabel: det.regimeLabel,
    totalTaxCHF: 0,
    netAnnualCHF: 0,
    effectiveRate: 0,
    marginalRate: 0,
    notes: [
      det.reason,
      "Précisez canton, permis et pays de résidence pour activer le calcul automatique.",
    ],
  };
}
