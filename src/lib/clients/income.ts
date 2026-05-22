// Source unique de vérité pour le revenu brut d'un client.
//
// Pourquoi ce module :
// - Plusieurs calculateurs n'ont qu'un seul champ "Salaire brut" (LPP, AVS,
//   source-tax, pillar3a, cross-border, comparateur cantonal).
// - Sans agrégation, ils ignoraient bonus / 13e / autres revenus présents
//   dans la fiche client → écart entre l'écran "fiche" et l'écran "résultat".
// - Centraliser ici garantit une formule unique partout.
//
// L'income-tax classique conserve les 3 champs séparés (salaire / bonus /
// autres) car son formulaire les expose distinctement et applique des règles
// par type. Pour TOUS les autres calculateurs, utiliser getTotalGrossIncome.

import type { Client } from "./types";

/** Salaire brut de base (sans bonus ni autres revenus). */
export function getBaseGrossSalary(c: Pick<Client, "gross_annual_salary">): number {
  return Number(c.gross_annual_salary ?? 0) || 0;
}

/** Bonus / 13e / part variable. */
export function getBonus(c: Pick<Client, "bonus">): number {
  return Number(c.bonus ?? 0) || 0;
}

/** Autres revenus annuels (loyers nets de la fiche, jetons, indemnités...). */
export function getOtherIncome(c: Pick<Client, "other_income">): number {
  return Number(c.other_income ?? 0) || 0;
}

/**
 * Revenu brut TOTAL du contribuable principal :
 * salaire + bonus/13e + autres revenus.
 *
 * À utiliser comme "grossSalary" dans tous les calculateurs qui n'ont
 * qu'un seul champ revenu (LPP, AVS, comparateur cantonal, source-tax,
 * pillar3a, cross-border).
 */
export function getTotalGrossIncome(
  c: Pick<Client, "gross_annual_salary" | "bonus" | "other_income">,
): number {
  return getBaseGrossSalary(c) + getBonus(c) + getOtherIncome(c);
}

/** Variante "undefined si zéro", pratique pour les mappers qui mergent
 *  des Partial sans écraser les défauts du formulaire. */
export function getTotalGrossIncomeOrUndef(
  c: Pick<Client, "gross_annual_salary" | "bonus" | "other_income">,
): number | undefined {
  const n = getTotalGrossIncome(c);
  return n > 0 ? n : undefined;
}
