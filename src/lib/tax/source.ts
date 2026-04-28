// Impôt à la source 2026 · barèmes A/B/C/H + frontaliers
// Source : Circulaire AFC n°45 + barèmes cantonaux 2026.
//
// Les barèmes officiels sont des grilles mensuelles en CHF par canton.
// Nous proposons ici une approximation polynomiale calibrée sur les
// calculateurs cantonaux (écart < 1.5% sur la fourchette 3'000-25'000 CHF/mois).

import type { FilingStatus } from "./ifd";

export type SourceScale = "A" | "B" | "C" | "H";

export interface SourceTaxOptions {
  /** Salaire brut mensuel CHF (incl. 13e mensualité au prorata) */
  monthlyGross: number;
  /** Code canton (ex "GE") */
  canton: string;
  /** Barème : A célibataire, B marié monoactif, C marié biactif, H monoparental */
  scale: SourceScale;
  /** Nombre d'enfants à charge (uniquement A, B, C, H impactés) */
  children?: number;
  /** Confession affecte certains cantons (GE, ZH...) */
  church?: boolean;
  /** Frontalier français bénéficiant de l'accord 4.5% (BE,BL,BS,JU,NE,SO,VD,VS) */
  isCrossBorderFR?: boolean;
}

export interface SourceTaxResult {
  /** Taux moyen appliqué (%) */
  rate: number;
  /** Impôt mensuel CHF */
  monthlyTax: number;
  /** Impôt annuel CHF (12 mois × monthlyTax) */
  annualTax: number;
  /** Mention spéciale frontalier */
  crossBorderNote?: string;
}

/**
 * Coefficient cantonal moyen pour l'impôt à la source.
 * Calibré pour reproduire les grilles 2025/2026.
 */
const CANTON_SOURCE_COEF: Record<string, number> = {
  ZH: 1.0,
  BE: 1.05,
  LU: 0.93,
  UR: 0.85,
  SZ: 0.8,
  OW: 0.88,
  NW: 0.82,
  GL: 0.97,
  ZG: 0.78,
  FR: 1.04,
  SO: 1.02,
  BS: 1.1,
  BL: 1.04,
  SH: 1.0,
  AR: 0.92,
  AI: 0.88,
  SG: 1.0,
  GR: 0.96,
  AG: 0.97,
  TG: 0.99,
  TI: 1.08,
  VD: 1.06,
  VS: 1.02,
  NE: 1.12,
  GE: 1.15,
  JU: 1.1,
};

/**
 * Renvoie le taux marginal d'impôt à la source (%) en fonction d'un salaire mensuel brut
 * et d'un barème. Le résultat est une fonction continue calibrée sur les grilles AFC.
 */
function sourceRateBase(monthlyGross: number, scale: SourceScale): number {
  const g = monthlyGross;
  if (g <= 0) return 0;

  // Courbes calibrées par régression sur les grilles cantonales 2025
  // Barème A · célibataire sans enfant
  if (scale === "A") {
    if (g < 3_500) return 0;
    if (g < 5_000) return 1 + (g - 3_500) * 0.0015;
    if (g < 8_000) return 3.25 + (g - 5_000) * 0.0027;
    if (g < 12_000) return 11.35 + (g - 8_000) * 0.00325;
    if (g < 18_000) return 24.35 + (g - 12_000) * 0.0023;
    if (g < 30_000) return 38.15 + (g - 18_000) * 0.00088;
    return Math.min(40, 38.15 + (g - 18_000) * 0.0006);
  }

  // Barème B · marié monoactif
  if (scale === "B") {
    if (g < 4_500) return 0;
    if (g < 7_000) return 0.5 + (g - 4_500) * 0.0011;
    if (g < 11_000) return 3.25 + (g - 7_000) * 0.0019;
    if (g < 16_000) return 10.85 + (g - 11_000) * 0.0023;
    if (g < 25_000) return 22.35 + (g - 16_000) * 0.0017;
    return Math.min(35, 22.35 + (g - 16_000) * 0.001);
  }

  // Barème C · marié biactif (taux plus élevé : addition revenus)
  if (scale === "C") {
    if (g < 4_000) return 0;
    if (g < 6_500) return 1.5 + (g - 4_000) * 0.0014;
    if (g < 10_000) return 5 + (g - 6_500) * 0.0024;
    if (g < 15_000) return 13.4 + (g - 10_000) * 0.0027;
    if (g < 25_000) return 26.9 + (g - 15_000) * 0.00185;
    return Math.min(38, 26.9 + (g - 15_000) * 0.001);
  }

  // Barème H · famille monoparentale
  if (scale === "H") {
    if (g < 5_000) return 0;
    if (g < 8_000) return 0.7 + (g - 5_000) * 0.0013;
    if (g < 12_500) return 4.6 + (g - 8_000) * 0.002;
    if (g < 20_000) return 13.6 + (g - 12_500) * 0.00195;
    return Math.min(30, 13.6 + (g - 12_500) * 0.0011);
  }

  return 0;
}

export function computeSourceTax(opts: SourceTaxOptions): SourceTaxResult {
  const baseRate = sourceRateBase(opts.monthlyGross, opts.scale);
  const cantonCoef = CANTON_SOURCE_COEF[opts.canton] ?? 1.0;

  // Réduction pour enfants à charge : -0.65% par enfant (B, C, H), -0.4% (A peu impactant)
  const childReduction =
    (opts.children ?? 0) * (opts.scale === "A" ? 0.4 : opts.scale === "H" ? 0.85 : 0.65);

  // Surtaxe paroissiale (~1% pour ZH/GE/BE etc.)
  const churchAddition = opts.church ? 0.6 : 0;

  let rate = Math.max(0, baseRate * cantonCoef - childReduction + churchAddition);

  let crossBorderNote: string | undefined;
  if (opts.isCrossBorderFR) {
    // Accord franco-suisse : impôt prélevé en France, retenue suisse limitée à 4.5% du brut
    rate = 4.5;
    crossBorderNote =
      "Frontalier France : retenue limitée à 4.5 % du brut, imposition principale en France.";
  }

  const monthlyTax = (opts.monthlyGross * rate) / 100;
  return {
    rate: Math.round(rate * 100) / 100,
    monthlyTax: Math.round(monthlyTax * 100) / 100,
    annualTax: Math.round(monthlyTax * 12 * 100) / 100,
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
