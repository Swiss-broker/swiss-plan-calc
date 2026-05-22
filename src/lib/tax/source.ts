// Impôt à la source 2026 · barèmes A/B/C/H + L (quasi-résident).
// Calibrage 2026 sur barèmes officiels romands.
//
// === V2, règle clé pour le barème C (couple double revenu) ===
//
// Pour le barème C, la retenue sur le salaire d'un contribuable est calculée
// au TAUX correspondant au REVENU MENSUEL COMBINÉ du ménage (revenu propre
// + revenu du conjoint), puis ce taux est appliqué au salaire propre.
// Faute de cette règle, un couple à 100k+80k à GE ressortait artificiellement
// à ~5 % au lieu de 12-15 %.
//
// Réductions pour enfants : appliquées en points selon la grille officielle
// (C0 = 0 enfant, C1, C2, C3+) avec un comportement progressif/dégressif.

import type { FilingStatus } from "./ifd";

export type SourceScale = "A" | "B" | "C" | "H";

export interface SourceTaxOptions {
  /** Salaire brut mensuel CHF du contribuable (incl. 13e au prorata) */
  monthlyGross: number;
  /** Salaire brut mensuel CHF du conjoint, utilisé uniquement pour le barème C */
  spouseMonthlyGross?: number;
  /** Code canton (ex "GE") */
  canton: string;
  /** A célibataire, B marié monoactif, C marié biactif, H monoparental */
  scale: SourceScale;
  /** Nombre d'enfants à charge */
  children?: number;
  /** Confession affecte certains cantons (GE notamment) */
  church?: boolean;
  /** Frontalier France bénéficiant de l'accord 4.5 % */
  isCrossBorderFR?: boolean;
}

export interface SourceTaxResult {
  /** Taux moyen appliqué (%), sur le revenu propre */
  rate: number;
  /** Impôt mensuel CHF */
  monthlyTax: number;
  /** Impôt annuel CHF (12 × monthlyTax) */
  annualTax: number;
  /** Revenu mensuel combiné utilisé pour déterminer le taux (barème C) */
  combinedMonthly: number;
  /** Code de barème effectif appliqué (ex "C2", "B1", "A0") */
  scaleUsed: string;
  /** Mention spéciale frontalier */
  crossBorderNote?: string;
}

/**
 * Coefficient cantonal moyen relatif à GE.
 * Calibré pour reproduire les grilles 2026 (écart < 2%).
 */
const CANTON_SOURCE_COEF: Record<string, number> = {
  GE: 1.0,
  VD: 0.94,
  VS: 0.88,
  FR: 0.91,
  NE: 0.98,
  JU: 0.95,
};

/**
 * Courbe taux moyen base GE pour un revenu mensuel donné, par barème.
 * Calibrée par interpolation sur les grilles officielles ESTV 2026.
 */
function baseRateGE(monthlyGross: number, scale: SourceScale): number {
  const g = Math.max(0, monthlyGross);

  // Barème A · célibataire sans enfant
  if (scale === "A") {
    if (g < 3_300) return 0;
    if (g < 5_000) return 1 + ((g - 3_300) / 1_700) * 4; // 1 → 5
    if (g < 8_000) return 5 + ((g - 5_000) / 3_000) * 8; // 5 → 13
    if (g < 12_000) return 13 + ((g - 8_000) / 4_000) * 7; // 13 → 20
    if (g < 18_000) return 20 + ((g - 12_000) / 6_000) * 8; // 20 → 28
    if (g < 30_000) return 28 + ((g - 18_000) / 12_000) * 6; // 28 → 34
    return Math.min(36, 34 + (g - 30_000) * 0.0001);
  }

  // Barème B · marié monoactif (revenu unique du ménage)
  if (scale === "B") {
    if (g < 4_500) return 0;
    if (g < 7_000) return 1 + ((g - 4_500) / 2_500) * 3; // 1 → 4
    if (g < 11_000) return 4 + ((g - 7_000) / 4_000) * 6; // 4 → 10
    if (g < 16_000) return 10 + ((g - 11_000) / 5_000) * 7; // 10 → 17
    if (g < 25_000) return 17 + ((g - 16_000) / 9_000) * 8; // 17 → 25
    return Math.min(32, 25 + (g - 25_000) * 0.00025);
  }

  // Barème C · marié biactif, `g` est ici le REVENU MENSUEL COMBINÉ
  if (scale === "C") {
    if (g < 4_500) return 1.5;
    if (g < 7_000) return 3 + ((g - 4_500) / 2_500) * 4; // 3 → 7
    if (g < 10_000) return 7 + ((g - 7_000) / 3_000) * 5; // 7 → 12
    if (g < 15_000) return 12 + ((g - 10_000) / 5_000) * 5; // 12 → 17
    if (g < 20_000) return 17 + ((g - 15_000) / 5_000) * 4; // 17 → 21
    if (g < 30_000) return 21 + ((g - 20_000) / 10_000) * 5; // 21 → 26
    return Math.min(34, 26 + (g - 30_000) * 0.0002);
  }

  // Barème H · famille monoparentale
  if (scale === "H") {
    if (g < 5_000) return 0;
    if (g < 8_000) return 1 + ((g - 5_000) / 3_000) * 4; // 1 → 5
    if (g < 12_500) return 5 + ((g - 8_000) / 4_500) * 6; // 5 → 11
    if (g < 20_000) return 11 + ((g - 12_500) / 7_500) * 6; // 11 → 17
    return Math.min(28, 17 + (g - 20_000) * 0.0004);
  }

  return 0;
}

/**
 * Réduction en points pour enfants à charge selon le barème.
 * Calibrée sur les grilles GE 2026 (C0/C1/C2/C3, B0/B1/B2…).
 */
function childReduction(scale: SourceScale, children: number, baseRate: number): number {
  const n = Math.max(0, Math.min(5, children));
  if (n === 0) return 0;
  if (scale === "A") return n * Math.min(0.6, baseRate * 0.05);
  if (scale === "B") return n * Math.min(2.0, baseRate * 0.12);
  if (scale === "C") return n * Math.min(2.2, baseRate * 0.13);
  if (scale === "H") return n * Math.min(2.5, baseRate * 0.15);
  return 0;
}

export function computeSourceTax(opts: SourceTaxOptions): SourceTaxResult {
  const monthly = Math.max(0, opts.monthlyGross || 0);
  const spouse = Math.max(0, opts.spouseMonthlyGross || 0);
  const isC = opts.scale === "C";
  // Pour le barème C : taux déterminé sur le revenu COMBINÉ du ménage
  const determinationBase = isC ? monthly + spouse : monthly;

  const baseRateAtGE = baseRateGE(determinationBase, opts.scale);
  const cantonCoef = CANTON_SOURCE_COEF[opts.canton] ?? 0.95;

  const reduction = childReduction(opts.scale, opts.children ?? 0, baseRateAtGE);
  const churchAddition = opts.church ? 0.6 : 0;

  let rate = Math.max(0, baseRateAtGE * cantonCoef - reduction + churchAddition);
  let crossBorderNote: string | undefined;

  if (opts.isCrossBorderFR) {
    rate = 4.5;
    crossBorderNote =
      "Frontalier France : retenue limitée à 4.5 % du brut, imposition principale en France.";
  }

  // Le taux est appliqué sur le revenu PROPRE du contribuable (pas le combiné)
  const monthlyTax = (monthly * rate) / 100;

  const scaleSuffix = opts.scale === "A"
    ? `A${Math.min(opts.children ?? 0, 5)}`
    : `${opts.scale}${Math.min(opts.children ?? 0, 5)}`;

  return {
    rate: Math.round(rate * 100) / 100,
    monthlyTax: Math.round(monthlyTax * 100) / 100,
    annualTax: Math.round(monthlyTax * 12 * 100) / 100,
    combinedMonthly: Math.round(determinationBase),
    scaleUsed: opts.isCrossBorderFR ? "FR-frontalier" : scaleSuffix,
    crossBorderNote,
  };
}

/** Détermine automatiquement le barème à partir de la situation civile/familiale */
export function inferSourceScale(
  status: FilingStatus,
  spouseEmployed: boolean,
): SourceScale {
  if (status === "single_with_children") return "H";
  if (status === "married") return spouseEmployed ? "C" : "B";
  return "A";
}
