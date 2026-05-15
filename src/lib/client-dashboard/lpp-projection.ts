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
// Hypothèses par défaut (constantes exportées) : conservatrices et explicites.

import type { ClientBundle } from "@/lib/clients/to-calculator-input";
import { sumAccountBalances } from "@/lib/clients/to-calculator-input";
import { ageFromDob } from "@/lib/clients/types";
import {
  projectLPP,
  LPP_CONVERSION_RATE_2026,
  type LPPProjectionResult,
} from "@/lib/lpp";
import { projectPillar3a, type Pillar3aProjectionResult } from "@/lib/pillar3";
import { getWorkStatusRules } from "@/lib/clients/work-status-rules";

export const RETIREMENT_AGE_DEFAULT = 65;

/** Hypothèses de projection LPP "fiche client". Identiques partout. */
export const DASHBOARD_LPP_DEFAULTS = {
  expectedReturnRate: 1.25, // % — référence officielle 2026 (courtier)
  feeRate: 0, // %
  salaryGrowthRate: 1, // %
} as const;

/** Hypothèses de projection 3a "fiche client". */
export const DASHBOARD_3A_DEFAULTS = {
  expectedReturnRate: 2, // %
} as const;

export interface ClientLppProjection {
  currentCapital: number;
  projectedCapitalAt65: number;
  buybackCapacity: number;
  annualPension: number;
  monthlyPension: number;
  /** Hypothèses utilisées (pour affichage transparent dans l'UI). */
  assumptions: typeof DASHBOARD_LPP_DEFAULTS & {
    conversionRate: number;
    retirementAge: number;
  };
}

/**
 * Projection LPP "officielle" du dossier client.
 *
 * Retourne null si la projection n'a pas de sens (pas affilié + pas d'avoir,
 * date de naissance manquante).
 */
export function projectClientLPP(b: ClientBundle): ClientLppProjection | null {
  const rules = getWorkStatusRules(b.client.work_status);
  const currentCapital = Number(b.pension?.lpp_current_balance ?? 0);
  const insuredSalary = Number(b.pension?.lpp_insured_salary ?? 0);
  const buybackCapacity = Number(b.pension?.lpp_max_buyback ?? 0);
  const conversionRate = Number(
    b.pension?.lpp_conversion_rate ?? LPP_CONVERSION_RATE_2026,
  );

  if (!rules.hasLPP && currentCapital <= 0) return null;

  const age = ageFromDob(b.client.date_of_birth);
  const assumptions = {
    ...DASHBOARD_LPP_DEFAULTS,
    conversionRate,
    retirementAge: RETIREMENT_AGE_DEFAULT,
  };

  if (age === null) {
    return {
      currentCapital,
      projectedCapitalAt65: currentCapital,
      buybackCapacity,
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
      annualPension: Math.round(annualPension),
      monthlyPension: Math.round(annualPension / 12),
      assumptions,
    };
  }

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
      expectedReturnRate: DASHBOARD_LPP_DEFAULTS.expectedReturnRate,
      feeRate: DASHBOARD_LPP_DEFAULTS.feeRate,
      salaryGrowthRate: DASHBOARD_LPP_DEFAULTS.salaryGrowthRate,
      // NB : pas de rachat injecté ici. La projection "fiche" est la photo
      // *sans* what-if. Si le courtier veut intégrer un rachat planifié, il
      // le fait dans la page LPP.
    });
  } catch {
    return null;
  }

  return {
    currentCapital,
    projectedCapitalAt65: proj.projectedBalance,
    buybackCapacity,
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
 * Cumule le solde existant des comptes 3a + versement annuel projeté
 * jusqu'à 65 ans.
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
