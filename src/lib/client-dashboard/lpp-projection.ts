// Source UNIQUE de vérité pour les projections LPP / 3a au niveau "fiche client".
//
// Pourquoi ce module :
// - Avant, 3 endroits calculaient le "capital LPP projeté à la retraite" avec
//   3 résultats différents (page LPP, dashboard client, comparateur cantons
//   qui lisait l'historique des simulations). Incohérence inacceptable pour
//   livrer un dossier client.
// - Désormais : TOUTE valeur "d'après la fiche client" passe par ces fonctions.
//   Les pages-calculateur restent libres de faire des "what-if" avec leur
//   propre formulaire ; mais la valeur de référence affichée ailleurs vient
//   d'ici.
//
// Les rachats planifiés (`client_pension.lpp_planned_buybacks`) et les
// hypothèses personnalisées (`client_pension.lpp_assumptions`) sont
// automatiquement intégrés : appliquer un rachat dans l'onglet LPP via le
// bouton « Appliquer à la fiche client » suffit à synchroniser la projection
// affichée partout dans l'app.

import type { ClientBundle } from "@/lib/clients/to-calculator-input";
import { sumAccountBalances } from "@/lib/clients/to-calculator-input";
import { ageFromDob } from "@/lib/clients/types";
import { projectLPP, type LPPProjectionResult } from "@/lib/lpp";
import { projectPillar3a, type Pillar3aProjectionResult } from "@/lib/pillar3";
import { getWorkStatusRules } from "@/lib/clients/work-status-rules";

export const RETIREMENT_AGE_DEFAULT = 65;

/** Hypothèses de projection LPP "fiche client". Identiques partout.
 *  Alignées sur les défauts du formulaire LPP pour cohérence au franc près. */
export const DASHBOARD_LPP_DEFAULTS = {
  expectedReturnRate: 1.25, // % — taux minimum LPP 2026
  feeRate: 0.6, // % — frais TER+admin moyens caisses LPP suisses
  salaryGrowthRate: 1, // %
  conversionRate: 6.0, // % — taux minimum légal LPP 2026 (prudent)
} as const;

/** Hypothèses de projection 3a "fiche client". */
export const DASHBOARD_3A_DEFAULTS = {
  expectedReturnRate: 2, // %
} as const;

// ────────────────────────────────────────────────────────────
// Rachats planifiés / hypothèses personnalisées (lus depuis client_pension)
// ────────────────────────────────────────────────────────────

export interface PlannedBuyback {
  /** Année du rachat (ex. 2027) */
  year: number;
  /** Montant CHF */
  amount: number;
  label?: string;
}

export function parsePlannedBuybacks(value: unknown): PlannedBuyback[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      year: Number(v.year ?? 0),
      amount: Number(v.amount ?? 0),
      label: typeof v.label === "string" ? v.label : undefined,
    }))
    .filter((b) => b.year > 0 && b.amount > 0);
}

export interface LppAssumptions {
  expectedReturnRate: number;
  feeRate: number;
  salaryGrowthRate: number;
  conversionRate: number;
}

export function parseLppAssumptions(value: unknown): Partial<LppAssumptions> {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const out: Partial<LppAssumptions> = {};
  if (Number.isFinite(Number(v.expectedReturnRate)))
    out.expectedReturnRate = Number(v.expectedReturnRate);
  if (Number.isFinite(Number(v.feeRate))) out.feeRate = Number(v.feeRate);
  if (Number.isFinite(Number(v.salaryGrowthRate)))
    out.salaryGrowthRate = Number(v.salaryGrowthRate);
  if (Number.isFinite(Number(v.conversionRate)))
    out.conversionRate = Number(v.conversionRate);
  return out;
}

export interface ClientLppProjection {
  currentCapital: number;
  projectedCapitalAt65: number;
  buybackCapacity: number;
  /** Total CHF des rachats planifiés intégrés à la projection */
  plannedBuybacksTotal: number;
  annualPension: number;
  monthlyPension: number;
  /** Hypothèses utilisées (pour affichage transparent dans l'UI). */
  assumptions: {
    expectedReturnRate: number;
    feeRate: number;
    salaryGrowthRate: number;
    conversionRate: number;
    retirementAge: number;
  };
}

/**
 * Projection LPP "officielle" du dossier client.
 *
 * Inclut les rachats planifiés (`lpp_planned_buybacks`) et les hypothèses
 * personnalisées (`lpp_assumptions`) si présents.
 */
export function projectClientLPP(b: ClientBundle): ClientLppProjection | null {
  const rules = getWorkStatusRules(b.client.work_status);
  const currentCapital = Number(b.pension?.lpp_current_balance ?? 0);
  const insuredSalary = Number(b.pension?.lpp_insured_salary ?? 0);
  const buybackCapacity = Number(b.pension?.lpp_max_buyback ?? 0);
  const customAssumptions = parseLppAssumptions(
    (b.pension as { lpp_assumptions?: unknown } | null | undefined)?.lpp_assumptions,
  );
  const plannedBuybacks = parsePlannedBuybacks(
    (b.pension as { lpp_planned_buybacks?: unknown } | null | undefined)
      ?.lpp_planned_buybacks,
  );
  const plannedBuybacksTotal = plannedBuybacks.reduce((s, r) => s + r.amount, 0);

  const conversionRate = Number(
    b.pension?.lpp_conversion_rate ??
      customAssumptions.conversionRate ??
      DASHBOARD_LPP_DEFAULTS.conversionRate,
  );

  if (!rules.hasLPP && currentCapital <= 0) return null;

  const age = ageFromDob(b.client.date_of_birth);
  const assumptions = {
    expectedReturnRate:
      customAssumptions.expectedReturnRate ?? DASHBOARD_LPP_DEFAULTS.expectedReturnRate,
    feeRate: customAssumptions.feeRate ?? DASHBOARD_LPP_DEFAULTS.feeRate,
    salaryGrowthRate:
      customAssumptions.salaryGrowthRate ?? DASHBOARD_LPP_DEFAULTS.salaryGrowthRate,
    conversionRate,
    retirementAge: RETIREMENT_AGE_DEFAULT,
  };

  if (age === null) {
    return {
      currentCapital,
      projectedCapitalAt65: currentCapital,
      buybackCapacity,
      plannedBuybacksTotal,
      annualPension: 0,
      monthlyPension: 0,
      assumptions,
    };
  }

  if (age >= RETIREMENT_AGE_DEFAULT) {
    const annualPension = currentCapital * (conversionRate / 100);
    return {
      currentCapital,
      projectedCapitalAt65: currentCapital,
      buybackCapacity,
      plannedBuybacksTotal,
      annualPension: Math.round(annualPension),
      monthlyPension: Math.round(annualPension / 12),
      assumptions,
    };
  }

  // Étalement linéaire des rachats planifiés sur la période restante.
  const yearsToRetire = Math.max(1, RETIREMENT_AGE_DEFAULT - age);
  const yearlyBuyback =
    plannedBuybacksTotal > 0
      ? Math.round(plannedBuybacksTotal / yearsToRetire)
      : 0;

  let proj: LPPProjectionResult;
  try {
    proj = projectLPP({
      currentAge: age,
      retirementAge: RETIREMENT_AGE_DEFAULT,
      currentBalance: currentCapital,
      insuredSalary:
        insuredSalary > 0
          ? insuredSalary
          : Math.max(0, Number(b.client.gross_annual_salary ?? 0)),
      conversionRate,
      expectedReturnRate: assumptions.expectedReturnRate,
      feeRate: assumptions.feeRate,
      salaryGrowthRate: assumptions.salaryGrowthRate,
      yearlyBuyback,
      buybackYears: yearsToRetire,
    });
  } catch {
    return null;
  }

  return {
    currentCapital,
    projectedCapitalAt65: proj.projectedBalance,
    buybackCapacity,
    plannedBuybacksTotal,
    annualPension: proj.annualPension,
    monthlyPension: proj.monthlyPension,
    assumptions,
  };
}

export interface ClientPillar3aProjection {
  currentBalance: number;
  yearlyContribution: number;
  projectedCapitalAt65: number;
  assumptions: typeof DASHBOARD_3A_DEFAULTS & { retirementAge: number };
}

/**
 * Projection 3a "officielle" du dossier client.
 */
export function projectClient3a(b: ClientBundle): ClientPillar3aProjection | null {
  const currentBalance = sumAccountBalances(b.pension?.pillar_3a_accounts);
  const yearlyContribution = Number(
    b.pension?.pillar_3a_annual_contribution ?? 0,
  );
  if (currentBalance <= 0 && yearlyContribution <= 0) return null;

  const age = ageFromDob(b.client.date_of_birth);
  const assumptions = {
    ...DASHBOARD_3A_DEFAULTS,
    retirementAge: RETIREMENT_AGE_DEFAULT,
  };

  const yearsToRetire =
    age !== null ? Math.max(0, RETIREMENT_AGE_DEFAULT - age) : 0;

  if (yearsToRetire === 0) {
    return {
      currentBalance,
      yearlyContribution,
      projectedCapitalAt65: Math.round(currentBalance),
      assumptions,
    };
  }

  let proj: Pillar3aProjectionResult;
  try {
    proj = projectPillar3a({
      currentBalance,
      yearlyContribution,
      years: yearsToRetire,
      expectedReturnRate: DASHBOARD_3A_DEFAULTS.expectedReturnRate,
    });
  } catch {
    return {
      currentBalance,
      yearlyContribution,
      projectedCapitalAt65: Math.round(
        currentBalance + yearlyContribution * yearsToRetire,
      ),
      assumptions,
    };
  }

  return {
    currentBalance,
    yearlyContribution,
    projectedCapitalAt65: proj.finalBalance,
    assumptions,
  };
}
