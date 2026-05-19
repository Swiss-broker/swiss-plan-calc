// Orchestrateur — appelle les moteurs existants selon le régime détecté.
// AUCUN calcul n'est réécrit : on délègue à income/source/cross-border/tou/health-france.

import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { computeSourceTax, inferSourceScale } from "@/lib/tax/source";
import { computeCrossBorder } from "@/lib/tax/cross-border";
import { checkQuasiResident, compareTOUvsSource } from "@/lib/tax/tou";
import { computeHealthFrance } from "@/lib/health-france";
import { detectRegime, toTaxStatus, toFrenchStatus, isCoupleStatus } from "./profile";
import type { TaxGlobalInput, TaxGlobalResult, Regime } from "./types";

/** Revenu brut de référence selon le régime — utilisé pour effective rate & net. */
function computeGrossForRegime(g: TaxGlobalInput, regime: Regime): number {
  const couple = isCoupleStatus(g.civilStatus);
  switch (regime) {
    case "resident_ordinary":
      return (
        g.grossSalary +
        g.bonus +
        (couple ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome +
        g.imputedRent
      );
    case "source_taxed":
    case "tou":
      return (
        g.grossSalary +
        g.bonus +
        (couple && g.spouseEmployed ? g.spouseGrossSalary : 0)
      );
    case "cross_border_ge":
    case "cross_border_fr_1983":
      return g.grossSalary + g.bonus;
    default:
      return g.grossSalary + g.bonus;
  }
}

export function toIncomeTaxInput(g: TaxGlobalInput): IncomeTaxInput {
  return {
    canton: g.canton,
    status: toTaxStatus(g.civilStatus, g.children),
    confession: g.confession,
    children: g.children,
    age: g.age,
    grossSalary: g.grossSalary + g.bonus,
    spouseGrossSalary: isCoupleStatus(g.civilStatus) ? g.spouseGrossSalary : 0,
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

function rate(num: number, base: number): number {
  return base > 0 ? Math.round((num / base) * 1000) / 10 : 0;
}

export function computeTaxGlobal(g: TaxGlobalInput): TaxGlobalResult {
  const det = detectRegime(g);
  const notes: string[] = [det.reason];
  if (g.civilStatus === "cohabiting") {
    notes.push(
      "Concubinage : imposition séparée en Suisse, chaque partenaire déclare seul (barème célibataire).",
    );
  }

  // ─────────────────────── RÉSIDENT ORDINAIRE ───────────────────────
  if (det.regime === "resident_ordinary") {
    const income = computeIncomeTax(toIncomeTaxInput(g));
    const gross = computeGrossForRegime(g, det.regime);
    if (g.foreignIncome > 0) {
      notes.push(
        "Revenu étranger : exonéré en CH (convention) mais retenu pour le taux effectif — à reporter en déclaration.",
      );
    }
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      income,
      totalTaxCHF: income.totalTax,
      socialChargesCHF: 0,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - income.totalTax),
      swissShareCHF: income.totalTax,
      foreignShareCHF: 0,
      effectiveRate: income.effectiveRate,
      marginalRate: income.marginalRate,
      notes,
    };
  }

  // ─────────────────────── SOURCE / QUASI-RÉSIDENT ───────────────────────
  if (det.regime === "source_taxed" || det.regime === "tou") {
    const status = toTaxStatus(g.civilStatus, g.children);
    const couple = isCoupleStatus(g.civilStatus);
    const scale = inferSourceScale(status, couple && g.spouseEmployed);
    const source = computeSourceTax({
      monthlyGross: Math.round((g.grossSalary + g.bonus) / 12),
      spouseMonthlyGross:
        couple && g.spouseEmployed
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
      (couple ? g.spouseGrossSalary : 0) +
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
    const gross = computeGrossForRegime(g, det.regime);
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      source,
      touEligibility,
      touComparison,
      totalTaxCHF: total,
      socialChargesCHF: 0,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - total),
      swissShareCHF: total,
      foreignShareCHF: 0,
      effectiveRate: rate(total, gross),
      marginalRate: touComparison.marginalRate,
      notes,
    };
  }

  // ─────────────────────── FRONTALIER FR (GE ou accord 1983) ───────────────────────
  if (det.regime === "cross_border_ge" || det.regime === "cross_border_fr_1983") {
    const frStatus = toFrenchStatus(g.civilStatus);
    const couple = isCoupleStatus(g.civilStatus);
    const crossBorder = computeCrossBorder({
      workCanton: g.canton,
      grossAnnualSalary: g.grossSalary + g.bonus,
      status: frStatus,
      children: g.children,
      spouseEmployed: couple && g.spouseEmployed,
      spouseGrossSalary: couple ? g.spouseGrossSalary : 0,
      eurChfRate: g.eurChfRate,
    });

    // Couche santé : CMU vs LAMal — SÉPARÉE de l'impôt
    const health = computeHealthFrance({
      swissGrossSalaryCHF: g.grossSalary + g.bonus,
      civilStatus: couple ? "married" : "single",
      childrenCount: g.children,
      chfToEurRate: g.chfToEurRate,
      taxYear: g.taxYear,
      lamalAdultMonthlyCHF: g.lamalAdultMonthlyCHF,
      lamalChildMonthlyCHF: g.lamalChildMonthlyCHF,
    });

    const gross = computeGrossForRegime(g, det.regime);
    const totalTax = crossBorder.totalTax; // impôt uniquement
    const social = health.recommendedAnnualCHF;
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      crossBorder,
      health,
      totalTaxCHF: totalTax,
      socialChargesCHF: social,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - totalTax - social),
      swissShareCHF: crossBorder.swissTax,
      foreignShareCHF: crossBorder.foreignTax,
      effectiveRate: rate(totalTax, gross),
      marginalRate: crossBorder.marginalRate,
      notes: [...notes, ...crossBorder.notes],
    };
  }

  // ─────────────────────── INCONNU ───────────────────────
  return {
    regime: "unknown",
    regimeLabel: det.regimeLabel,
    totalTaxCHF: 0,
    socialChargesCHF: 0,
    grossIncomeCHF: 0,
    netAnnualCHF: 0,
    swissShareCHF: 0,
    foreignShareCHF: 0,
    effectiveRate: 0,
    marginalRate: 0,
    notes: [
      det.reason,
      "Précisez canton, permis et pays de résidence pour activer le calcul automatique.",
    ],
  };
}
