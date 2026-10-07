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
import { interpolateGERate } from "./cross-border";

export type SourceScale = "A" | "B" | "C" | "H";

// =====================================================================
// Barèmes IS Jura 2026 — officiels (jura.ch, Service des contributions,
// "Barème B" / "Barème C", édition 2026)
// [revenu_brut_mensuel_CHF, taux_%] — interpolation linéaire, même
// mécanique que GE_IS_RATES_2026 (cross-border.ts), mais directement sur
// le revenu MENSUEL (le barème jurassien est publié mois par mois, pas
// annualisé). Limité à B0-B2/C0-C2 comme GE — au-delà de 2 enfants, la
// réduction générique childReduction() prend le relais (voir
// computeSourceTax). N'existe que pour B (marié monoactif) et C (marié
// biactif) : le Jura ne nous a pas fourni de barème A (célibataire) ni H
// (monoparental) — ceux-ci restent sur l'approximation générique.
// =====================================================================
const JU_IS_RATES_2026: Record<string, [number, number][]> = {
  B0: [
    [1_000, 0],
    [2_000, 0],
    [3_000, 1.51],
    [4_000, 3.75],
    [5_000, 5.85],
    [6_000, 7.34],
    [7_000, 8.89],
    [8_000, 10.2],
    [10_000, 12.12],
    [12_000, 14.07],
    [15_000, 16.72],
    [18_000, 19.2],
    [20_000, 20.55],
    [25_000, 23.62],
    [30_000, 25.8],
  ],
  B1: [
    [1_000, 0],
    [2_000, 0],
    [3_000, 0.22],
    [4_000, 1.85],
    [5_000, 3.82],
    [6_000, 5.42],
    [7_000, 6.81],
    [8_000, 8.21],
    [10_000, 10.48],
    [12_000, 12.5],
    [15_000, 15.33],
    [18_000, 17.88],
    [20_000, 19.36],
    [25_000, 22.56],
    [30_000, 24.92],
  ],
  B2: [
    [1_000, 0],
    [2_000, 0],
    [3_000, 0],
    [4_000, 0.45],
    [5_000, 2.06],
    [6_000, 3.89],
    [7_000, 5.23],
    [8_000, 6.61],
    [10_000, 8.89],
    [12_000, 10.92],
    [15_000, 13.96],
    [18_000, 16.56],
    [20_000, 18.17],
    [25_000, 21.51],
    [30_000, 24.04],
  ],
  C0: [
    [1_000, 0],
    [2_000, 2.28],
    [3_000, 5.81],
    [4_000, 8.68],
    [5_000, 10.71],
    [6_000, 12.44],
    [7_000, 13.42],
    [8_000, 14.39],
    [10_000, 16.06],
    [12_000, 17.57],
    [15_000, 19.9],
    [18_000, 22.05],
    [20_000, 23.26],
    [25_000, 25.57],
    [30_000, 27.2],
  ],
  C1: [
    [1_000, 0],
    [2_000, 0.75],
    [3_000, 4.27],
    [4_000, 7.01],
    [5_000, 9.14],
    [6_000, 10.92],
    [7_000, 12.06],
    [8_000, 13.13],
    [10_000, 14.96],
    [12_000, 16.55],
    [15_000, 18.98],
    [18_000, 21.17],
    [20_000, 22.48],
    [25_000, 24.95],
    [30_000, 26.69],
  ],
  C2: [
    [1_000, 0],
    [2_000, 0.04],
    [3_000, 2.77],
    [4_000, 5.55],
    [5_000, 7.83],
    [6_000, 9.45],
    [7_000, 10.71],
    [8_000, 11.89],
    [10_000, 13.9],
    [12_000, 15.55],
    [15_000, 18.04],
    [18_000, 20.28],
    [20_000, 21.69],
    [25_000, 24.33],
    [30_000, 26.18],
  ],
};

function interpolateJURate(monthlyGross: number, scaleKey: string): number {
  const pts = JU_IS_RATES_2026[scaleKey];
  if (!pts) return 0;
  if (monthlyGross <= pts[0][0]) return 0;
  if (monthlyGross >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (monthlyGross <= x1) {
      return y0 + ((monthlyGross - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

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
  /** true pour le scénario "après rectification" : pour GE, utilise le vrai
   *  sous-indice par enfant (H1, H2…) au lieu du sous-indice "0" toujours
   *  appliqué par défaut par l'employeur (voir inferSourceRectification).
   *  Sans effet pour les cantons hors GE : le sous-indice par enfant y est
   *  déjà dérivé de `children` ailleurs dans cette fonction. */
  useRectifiedScale?: boolean;
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
  // Barème A (célibataire) : AUCUNE réduction automatique pour enfant(s) à
  // charge, contrairement à B/C/H. C'est le seul barème sans sous-indice
  // piloté par le nombre d'enfants — son sous-indice (A1, A2…) dépend d'une
  // pension alimentaire versée atteignant des seuils précis (12'000 CHF/an
  // → A1, 24'000 → A2, etc.), pas du nombre d'enfants à charge du
  // contribuable lui-même. Un célibataire avec 1 enfant à charge reste sur
  // A0 jusqu'à une démarche de rectification qui le fait basculer sur le
  // barème H (monoparental), jamais automatiquement vers "A1" (confirmé par
  // Sarah, recoupé avec les directives AFC/GE — même principe déjà appliqué
  // à GE ci-dessus via scaleKey = `${opts.scale}0` systématique). Le seuil
  // de pension alimentaire n'est pas encore modélisé ici (pas de champ
  // "pension alimentaire versée" dans SourceTaxOptions) : pas de réduction
  // du tout plutôt qu'une approximation non vérifiée.
  if (scale === "A") return 0;
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

  const churchAddition = opts.church ? 0.6 : 0;
  let rate: number;

  if (opts.canton === "GE") {
    // Genève : utilise les vraies tables officielles tar26GE (mêmes tables
    // que le module frontalier cross-border.ts) au lieu d'une courbe
    // approximative.
    // Barème "0 enfant" (A0/B0/C0/H0) par défaut : c'est le barème appliqué
    // par défaut par l'employeur. La prise en compte des enfants ne se fait
    // qu'après une démarche de rectification (DRIS) l'année suivante, avant
    // le 31 mars, jamais automatiquement (directives officielles AFC/ge.ch).
    // opts.useRectifiedScale (scénario "après rectification" explicite,
    // voir inferSourceRectification) utilise le vrai sous-indice par
    // enfant — plafonné à 2, les tables officielles GE_IS_RATES_2026
    // (cross-border.ts) ne couvrant que 0/1/2 enfants pour GE.
    const scaleKey = opts.useRectifiedScale
      ? `${opts.scale}${Math.min(opts.children ?? 0, 2)}`
      : `${opts.scale}0`;
    const determinationAnnual = determinationBase * 12;
    const baseRate = interpolateGERate(determinationAnnual, scaleKey);
    rate = Math.max(0, baseRate + churchAddition);
  } else if (opts.canton === "JU" && (opts.scale === "B" || opts.scale === "C")) {
    // Jura, barèmes B et C : vraies tables officielles jura.ch 2026
    // (JU_IS_RATES_2026, directement sur le revenu mensuel, pas annualisé)
    // au lieu de l'approximation générique courbe GE × coefficient 0.95.
    // Barèmes A et H : pas de table officielle fournie pour le Jura, reste
    // sur l'approximation générique (voir branche else ci-dessous).
    const n = Math.min(opts.children ?? 0, 2);
    const scaleKey = `${opts.scale}${n}`;
    const baseRate = interpolateJURate(determinationBase, scaleKey);
    rate = Math.max(0, baseRate + churchAddition);
  } else {
    const baseRateAtGE = baseRateGE(determinationBase, opts.scale);
    const cantonCoef = CANTON_SOURCE_COEF[opts.canton] ?? 0.95;
    const reduction = childReduction(opts.scale, opts.children ?? 0, baseRateAtGE);
    rate = Math.max(0, baseRateAtGE * cantonCoef - reduction + churchAddition);
  }

  let crossBorderNote: string | undefined;

  if (opts.isCrossBorderFR) {
    rate = 4.5;
    crossBorderNote =
      "Frontalier France : retenue limitée à 4.5 % du brut, imposition principale en France.";
  }

  // Le taux est appliqué sur le revenu PROPRE du contribuable (pas le combiné)
  const monthlyTax = (monthly * rate) / 100;

  // A0 systématique, jamais piloté par le nombre d'enfants (voir
  // childReduction() ci-dessus). Les autres barèmes affichent le vrai
  // sous-indice par enfant UNIQUEMENT pour le scénario explicite "après
  // rectification" (opts.useRectifiedScale) — sinon "X0", cohérent avec le
  // taux réellement appliqué par défaut (voir scaleKey ci-dessus pour GE).
  const scaleSuffix =
    opts.scale === "A"
      ? "A0"
      : opts.useRectifiedScale
        ? `${opts.scale}${Math.min(opts.children ?? 0, 5)}`
        : `${opts.scale}0`;

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
export function inferSourceScale(status: FilingStatus, spouseEmployed: boolean): SourceScale {
  if (status === "single_with_children") return "H";
  if (status === "married") return spouseEmployed ? "C" : "B";
  return "A";
}

export interface SourceRectificationResult {
  /** Barème par défaut appliqué par l'employeur, sans tenir compte des
   *  enfants (voir inferSourceScale, toujours appelé avec children=0). */
  defaultScale: SourceScale;
  /** Barème qui doit réellement être attribué après démarche de
   *  rectification IS, compte tenu de la situation familiale réelle. */
  rectifiedScale: SourceScale;
  /** true si rectifiedScale diffère de defaultScale : il y a une démarche
   *  à faire pour obtenir le barème correct. */
  rectificationApplicable: boolean;
  /** Explication en langage clair de la bascule (vide si inapplicable). */
  reason: string;
}

/**
 * Barème après démarche de rectification IS, pour la seule situation
 * aujourd'hui documentée avec certitude : un célibataire avec au moins un
 * enfant à charge. Le barème par défaut appliqué par l'employeur est
 * toujours A (jamais H automatiquement, voir inferSourceScale), même si le
 * contribuable a des enfants — la prise en compte de l'enfant ne se fait
 * qu'après une démarche de rectification, qui fait alors basculer sur le
 * barème H (famille monoparentale), avec le sous-indice correspondant au
 * nombre d'enfants (H1, H2…).
 *
 * Volontairement limité à ce seul cas : contrairement à A, les barèmes B/C
 * (couples) intègrent déjà les enfants dans leur sous-indice ailleurs dans
 * ce fichier (voir scaleKey dans computeSourceTax) sans qu'un mécanisme de
 * rectification équivalent n'ait été vérifié ici — ne pas l'étendre sans
 * un cas de référence confirmé. Le sous-indice A1/A2… pour pension
 * alimentaire versée (12'000 CHF/an → A1, 24'000 → A2…) n'est pas non plus
 * modélisé ici, faute de champ "pension alimentaire versée" dans le moteur
 * source (voir childReduction ci-dessus) — pas de bascule devinée plutôt
 * qu'une approximation non vérifiée.
 */
export function inferSourceRectification(
  status: FilingStatus,
  spouseEmployed: boolean,
  children: number,
): SourceRectificationResult {
  const defaultScale = inferSourceScale(
    status === "single_with_children" ? "single" : status,
    spouseEmployed,
  );
  if (defaultScale === "A" && children > 0) {
    return {
      defaultScale,
      rectifiedScale: "H",
      rectificationApplicable: true,
      reason: `${children} enfant${children > 1 ? "s" : ""} à charge dans le ménage : le barème par défaut (A, sans enfant) ne reflète pas la situation réelle. Après dépôt d'une demande de rectification auprès de l'AFC/du canton, le barème H (famille monoparentale) s'applique.`,
    };
  }
  return {
    defaultScale,
    rectifiedScale: defaultScale,
    rectificationApplicable: false,
    reason: "",
  };
}
