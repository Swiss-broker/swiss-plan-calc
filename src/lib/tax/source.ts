// Impôt à la source 2026 · barèmes A/B/C/H + L (quasi-résident).
// Calibrage 2026 sur barèmes officiels romands.
//
// === Barème C (couple à deux revenus) ===
//
// Le taux du barème C se lit sur le salaire PROPRE du contribuable. Le
// revenu du conjoint n'est pas ajouté : le barème officiel C intègre déjà
// un revenu théorique du conjoint (circulaire AFC n° 45). L'ajouter une
// seconde fois surestimait la retenue.
//
// === Enfants ===
//
// Barèmes B, C et H : le sous-indice suit le nombre d'enfants à charge
// (B1, C2, H1…), appliqué d'office par l'employeur d'après la déclaration
// du salarié. Barème A : toujours A0 — une personne non mariée avec enfants
// reste en A0 tant qu'elle n'a pas obtenu le barème H par rectification.

import type { FilingStatus } from "./ifd";
import { geSourceRate } from "./cross-border";
import { officialSourceRate } from "./source-tables";

export type SourceScale = "A" | "B" | "C" | "H";

export interface SourceTaxOptions {
  /** Salaire brut mensuel CHF du contribuable (incl. 13e au prorata) */
  monthlyGross: number;
  /** Salaire brut mensuel CHF du conjoint. Informatif : il détermine le choix
   *  du barème (C plutôt que B) mais n'entre pas dans le calcul du taux. */
  spouseMonthlyGross?: number;
  /** Code canton (ex "GE") */
  canton: string;
  /** A célibataire, B marié monoactif, C marié biactif, H monoparental */
  scale: SourceScale;
  /** Nombre d'enfants à charge */
  children?: number;
  /** Confession affecte certains cantons (GE notamment) */
  church?: boolean;
  /** Frontalier France sous l'accord de 1983 (VD, VS, NE, JU…) : salaire
   *  imposé en France uniquement, aucune retenue suisse. */
  isCrossBorderFR?: boolean;
  /** Sans effet : conservé pour relire les simulations enregistrées avant
   *  la prise en compte d'office des enfants dans les barèmes B, C et H. */
  useRectifiedScale?: boolean;
}

export interface SourceTaxResult {
  /** Taux moyen appliqué (%), sur le revenu propre */
  rate: number;
  /** Taux marginal (%) : pente réelle de la courbe de barème au niveau de
   *  revenu actuel (dérivée numérique, voir calcul ci-dessous) — distinct
   *  du taux moyen `rate` dès qu'on est dans un palier croissant du barème
   *  (cas normal), jamais identique sauf palier plat (taux à 0 ou plafond
   *  du barème) ou frontalier France sous l'accord de 1983 (aucune retenue). */
  marginalRate: number;
  /** Impôt mensuel CHF */
  monthlyTax: number;
  /** Impôt annuel CHF (12 × monthlyTax) */
  annualTax: number;
  /** Revenu mensuel sur lequel le taux est lu : le salaire propre, pour tous
   *  les barèmes (nom historique conservé). */
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

  // Barème C : pas de courbe approchée ici. Les cantons sans table propre
  // reprennent la table officielle genevoise C (sur le salaire propre),
  // ajustée du coefficient cantonal — voir computeSourceTaxCore.

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
  // Barème A : jamais de réduction pour enfant (voir en-tête du fichier).
  if (scale === "B") return n * Math.min(2.0, baseRate * 0.12);
  if (scale === "H") return n * Math.min(2.5, baseRate * 0.15);
  return 0;
}

function computeSourceTaxCore(opts: SourceTaxOptions): Omit<SourceTaxResult, "marginalRate"> {
  const monthly = Math.max(0, opts.monthlyGross || 0);
  // Le taux se lit toujours sur le salaire propre, y compris en barème C
  // (voir en-tête du fichier).
  const determinationBase = monthly;
  // Enfants : d'office pour B, C et H ; jamais pour A.
  const children = opts.scale === "A" ? 0 : Math.max(0, Math.floor(opts.children ?? 0));

  const churchAddition = opts.church ? 0.6 : 0;
  let rate: number;

  const official = officialSourceRate(opts.canton, monthly * 12, opts.scale, children);
  if (official !== null) {
    // Barème officiel du canton (source-tables.ts : Genève, Vaud, Fribourg,
    // Jura, Valais A/B), le même que pour les frontaliers. Pas de supplément ecclésiastique : ces
    // barèmes sont publiés en une seule version, quelle que soit la confession.
    rate = Math.max(0, official);
  } else if (opts.scale === "C") {
    // Autres cantons, barème C : table officielle genevoise C ajustée du
    // coefficient cantonal (pas de table propre disponible).
    const cantonCoef = CANTON_SOURCE_COEF[opts.canton] ?? 0.95;
    rate = Math.max(0, geSourceRate(monthly * 12, "C", children) * cantonCoef + churchAddition);
  } else {
    const baseRateAtGE = baseRateGE(monthly, opts.scale);
    const cantonCoef = CANTON_SOURCE_COEF[opts.canton] ?? 0.95;
    const reduction = childReduction(opts.scale, children, baseRateAtGE);
    rate = Math.max(0, baseRateAtGE * cantonCoef - reduction + churchAddition);
  }

  let crossBorderNote: string | undefined;

  if (opts.isCrossBorderFR && opts.canton !== "GE" && opts.canton !== "FR") {
    // Accord franco-suisse du 11.04.1983 : le salaire n'est imposable que
    // dans l'État de résidence. Aucun impôt à la source n'est retenu sur le
    // salaire (sur remise de l'attestation de résidence fiscale française) ;
    // les 4,5 % sont une compensation versée par la France au canton, pas un
    // impôt du salarié. Genève (accord de 1973) et Fribourg (hors accord)
    // imposent au contraire le salaire à la source au barème ordinaire.
    rate = 0;
    crossBorderNote =
      "Frontalier France (accord de 1983) : aucune retenue suisse sur le salaire, imposition en France uniquement (attestation de résidence fiscale 2041-AS à remettre chaque année à l'employeur).";
  }

  // Le taux est appliqué sur le revenu PROPRE du contribuable (pas le combiné)
  const monthlyTax = (monthly * rate) / 100;

  const scaleSuffix = `${opts.scale}${Math.min(children, 5)}`;

  return {
    rate: Math.round(rate * 100) / 100,
    monthlyTax: Math.round(monthlyTax * 100) / 100,
    annualTax: Math.round(monthlyTax * 12 * 100) / 100,
    combinedMonthly: Math.round(determinationBase),
    scaleUsed: crossBorderNote ? "FR-frontalier" : scaleSuffix,
    crossBorderNote,
  };
}

// Granularité (CHF/mois) de la dérivée numérique du taux marginal — assez
// fine pour capter un changement de palier du barème sans être sensible au
// bruit d'arrondi (Math.round à 2 décimales dans computeSourceTaxCore).
const MARGINAL_RATE_DELTA_CHF = 100;

export function computeSourceTax(opts: SourceTaxOptions): SourceTaxResult {
  const base = computeSourceTaxCore(opts);
  // Taux marginal = pente réelle de la courbe de barème (impôt mensuel en
  // fonction du revenu mensuel) au niveau de revenu actuel, PAS le taux
  // moyen `rate` : le barème source est une courbe par paliers (voir
  // baseRateGE, barèmes officiels), donc gagner 1 CHF de
  // plus coûte en général PLUS que le taux moyen actuel tant qu'on est dans
  // un palier croissant — exactement comme un barème progressif classique.
  // Calculée par dérivée numérique (bump de MARGINAL_RATE_DELTA_CHF CHF/mois)
  // plutôt qu'analytiquement : le barème combine plusieurs sources (courbes
  // interpolées, barèmes officiels, coefficient cantonal), pas une
  // seule formule dont on pourrait dériver le taux directement.
  const bumped = computeSourceTaxCore({
    ...opts,
    monthlyGross: (opts.monthlyGross || 0) + MARGINAL_RATE_DELTA_CHF,
  });
  const marginalRate =
    Math.round(((bumped.monthlyTax - base.monthlyTax) / MARGINAL_RATE_DELTA_CHF) * 100 * 100) / 100;
  return { ...base, marginalRate };
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
 * Barème après demande de rectification, pour une personne non mariée avec
 * au moins un enfant à charge : l'employeur applique A0 par défaut (voir
 * inferSourceScale) ; la rectification fait passer au barème H (famille
 * monoparentale) avec le sous-indice du nombre d'enfants (H1, H2…).
 *
 * Les couples (B, C) n'ont rien à rectifier : leurs enfants sont déjà dans
 * le barème appliqué par l'employeur. Le sous-indice A1/A2… lié à une
 * pension alimentaire versée n'est pas modélisé.
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
      reason: `${children} enfant${children > 1 ? "s" : ""} à charge dans le ménage : le barème par défaut (A0, sans enfant) ne reflète pas la situation réelle. Sur demande de rectification auprès de l'administration cantonale (avant le 31 mars de l'année suivante), le barème H (famille monoparentale) s'applique, à condition de vivre seul avec ${children > 1 ? "les enfants" : "l'enfant"} et d'en assurer l'essentiel de l'entretien.`,
    };
  }
  return {
    defaultScale,
    rectifiedScale: defaultScale,
    rectificationApplicable: false,
    reason: "",
  };
}
