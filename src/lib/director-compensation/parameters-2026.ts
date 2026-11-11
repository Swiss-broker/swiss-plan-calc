// Paramètres 2026, Comparateur dirigeant.
//
// Sources principales :
//  - OFAS : cotisations sociales 2024-2026 (stables).
//    https://www.bsv.admin.ch
//  - AFC : imposition partielle des dividendes (RFFA, art. 20 al. 1bis LIFD).
//    https://www.estv.admin.ch
//  - KPMG Swiss Tax Report 2024 + AFC barèmes IS cantonaux 2024-2025
//    (multiplicateurs chef-lieu).
//
// Les valeurs marquées « approximation » doivent être confirmées au millésime
// fiscal du dossier. Le calculateur affiche un disclaimer permanent.

import type { SelectableCantonCode } from "@/lib/swiss/cantons";
import type { LppPlanKind } from "./types";
import { computeLppInsuredSalary, lppCreditRate } from "@/lib/lpp";
import { LPP_2026 } from "@/lib/lpp/parameters-2026";
import {
  AVS_AI_APG_RATE,
  AC_RATE,
  AC_CEILING_2026,
  ANP_RATE,
  ANP_CEILING_2026,
} from "@/lib/tax/income";

/**
 * Cotisations sociales 2026, stables depuis 2024.
 * Source : OFAS (bsv.admin.ch).
 */
export const SOCIAL_RATES_2026 = {
  /** AVS/AI/APG part employeur (% salaire brut, sans plafond) */
  avsEmployer: AVS_AI_APG_RATE,
  /** AVS/AI/APG part employé — même constante que l'impôt sur le revenu */
  avsEmployee: AVS_AI_APG_RATE,
  /** Assurance chômage employeur (jusqu'au plafond) */
  acEmployer: AC_RATE,
  /** Assurance chômage employé */
  acEmployee: AC_RATE,
  /** Plafond AC 2026 (CHF) = gain assuré maximal LAA */
  acCeiling: AC_CEILING_2026,
  /** LAA professionnel, défaut courant tertiaire (employeur, à charge entreprise) */
  laaProfessionalDefault: 0.01,
  /** LAA non professionnel (employé) — même taux que l'impôt sur le revenu
   *  (ANP_RATE), pour qu'un même salaire brut donne le même salaire net
   *  dans tous les calculateurs. */
  laaNonProfessionalDefault: ANP_RATE,
  /** Gain assuré maximal LAA : les primes accidents ne sont dues que jusque-là. */
  laaCeiling: ANP_CEILING_2026,
} as const;

/**
 * Allocations familiales, taux employeur 2026 par canton (approximation chef-lieu).
 * Sources : caisses cantonales d'allocations familiales.
 */
export const FAMILY_ALLOWANCE_RATE: Record<SelectableCantonCode, number> = {
  GE: 0.0245,
  VD: 0.0216,
  VS: 0.027,
  FR: 0.034,
  NE: 0.021,
  JU: 0.03,
};

/**
 * Taux EFFECTIF d'impôt sur le bénéfice (IFD + ICC + commune chef-lieu) 2026.
 * Approximation basée sur KPMG Swiss Tax Report 2024, RFFA harmonisée.
 *
 * À noter : depuis RFFA (2020), tous les cantons ont convergé entre ~12% et ~17%.
 */
export const CORPORATE_TAX_RATE: Record<SelectableCantonCode, number> = {
  GE: 0.140, // Genève chef-lieu
  VD: 0.140, // Lausanne
  VS: 0.170, // Sion
  FR: 0.139, // Fribourg
  NE: 0.136, // Neuchâtel
  JU: 0.160, // Delémont
};

/**
 * Imposition partielle des dividendes, participation qualifiée (≥10%).
 *
 * - Part fédérale : 70% imposable (art. 20 al. 1bis LIFD, post-RFFA 2020,
 *   uniforme tous cantons).
 * - Part cantonale : minimum légal 50% (art. 7 al. 1 LHID), chaque canton
 *   fixe son taux. Valeurs post-RFFA :
 *     GE 70%, VD 70%, VS 70%, FR 70%, NE 60%, JU 70%.
 *   Sources : barèmes cantonaux AFC + sites cantonaux (vérification
 *   indicative, à reconfirmer pour millésime fiscal final).
 *
 * Pour participation NON qualifiée : 100% imposable (pas d'abattement).
 */
export const DIVIDEND_TAXABLE = {
  federal: 0.70,
  cantonal: {
    GE: 0.70,
    VD: 0.70,
    VS: 0.70,
    FR: 0.70,
    NE: 0.60,
    JU: 0.70,
  } as Record<SelectableCantonCode, number>,
} as const;

/**
 * LPP, paramètres simplifiés.
 * Référence officielle déjà dans src/lib/lpp/parameters-2026.ts.
 */
export const LPP_PARAMS_2026 = {
  coordinationDeduction: LPP_2026.coordinationDeduction,
  /** Plafond salaire assuré régime obligatoire */
  maxInsuredMandatory: LPP_2026.maxInsuredSalary,
  /** Plafond salaire assuré plan cadres / 1e (référence) */
  maxInsuredExecutive: 132_300,
  /** Bonifications de vieillesse (% du salaire coordonné) */
  ageCredits: [
    { from: 25, to: 34, rate: 0.07 },
    { from: 35, to: 44, rate: 0.10 },
    { from: 45, to: 54, rate: 0.15 },
    { from: 55, to: 65, rate: 0.18 },
  ],
  /** Cotisation risque + frais d'administration approximatifs (% sal. coord.) */
  riskAndAdmin: 0.02,
  /** Répartition employeur/employé : par défaut 50/50 (LPP min légal) */
  employerShare: 0.5,
} as const;

/** Renvoie le taux de bonification LPP applicable selon l'âge */
export function ageCreditRate(age: number): number {
  // Barème légal partagé (src/lib/lpp) : 0 avant 25 ans et après 65 ans.
  return lppCreditRate(age);
}

/** Plafond salaire assuré selon plan */
export function lppMaxInsured(plan: LppPlanKind): number {
  return plan === "executive_1e"
    ? LPP_PARAMS_2026.maxInsuredExecutive
    : LPP_PARAMS_2026.maxInsuredMandatory;
}

/**
 * Salaire coordonné (= salaire assuré LPP) selon plan.
 */
export function coordinatedSalary(grossSalary: number, plan: LppPlanKind): number {
  // Même fonction que LPP / impôt sur le revenu : seuil d'entrée LPP
  // (aucune cotisation en dessous) et salaire coordonné minimal légal.
  return computeLppInsuredSalary(grossSalary, lppMaxInsured(plan));
}
