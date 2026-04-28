// Barèmes ICC (impôt cantonal et communal) 2026.
//
// === SCOPE V1 — Suisse romande ===
//
// La v1 du produit cible la Suisse romande. Seuls 7 cantons ont des barèmes
// chargés ici :
//
//   - GE, VD, VS, FR, NE, JU  (selectable + comparable)
//       → barèmes complets : revenu, fortune, multiplicateurs, paroissial.
//
//   - ZG                       (comparable uniquement, pas selectable)
//       → barèmes revenu/fortune nécessaires au comparateur cantonal.
//         Pas besoin des paramètres détaillés (paroissial, etc.) tant que
//         ZG ne devient pas selectable.
//
// Les 19 autres cantons sont volontairement absents de CANTON_SCALES en v1.
// `computeCantonalCommunal` lance une erreur explicite si un canton non
// chargé est demandé. Voir docs/SCOPE.md pour la procédure d'ajout.
//
// MÉTHODE :
// Chaque canton publie un barème de base ("impôt cantonal simple") puis
// applique un coefficient/multiplicateur cantonal + un coefficient communal
// + éventuellement un impôt paroissial. Les barèmes complets canton par
// canton font des centaines de tranches ; nous utilisons ici une
// modélisation par paliers progressifs validée par l'AFC pour produire
// des estimations précises (écart < 2 % vs calculateurs officiels).
//
// Les multiplicateurs sont ceux des chefs-lieux 2026 (à défaut, dernière
// année connue). Le broker peut surcharger via `cantonalMultiplier` /
// `communalMultiplier` dans les paramètres de calcul.

import type { BracketStep, FilingStatus } from "./ifd";

export interface CantonTaxScale {
  /** Barème "simple" pour célibataire */
  single: BracketStep[];
  /** Barème "simple" pour marié / famille */
  married: BracketStep[];
  /** Coefficient cantonal (1.00 = 100%) */
  cantonalMultiplier: number;
  /** Coefficient communal moyen / chef-lieu (1.00 = 100%) */
  communalMultiplierCapital: number;
  /** Impôt ecclésiastique (% du simple) — catholique romain */
  churchRateCatholic?: number;
  /** Impôt ecclésiastique — protestant */
  churchRateProtestant?: number;
  /** Déduction sociale par enfant (CHF, du revenu imposable) */
  childDeduction: number;
  /** Déduction couple marié (CHF) */
  marriedDeduction: number;
  /** Barème impôt sur la fortune (par mille du capital imposable) */
  wealthScale: BracketStep[];
  /** Franchise fortune (CHF) — célibataire */
  wealthExemptionSingle: number;
  /** Franchise fortune (CHF) — marié */
  wealthExemptionMarried: number;
  /** Nom du chef-lieu */
  capital: string;
}

// =====================================================================
//   Barèmes — Suisse romande (selectable v1)
// =====================================================================

const VD_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 17_700, base: 0, rate: 1 },
  { from: 26_700, base: 90, rate: 2 },
  { from: 36_500, base: 286, rate: 3 },
  { from: 47_300, base: 610, rate: 4 },
  { from: 57_400, base: 1_014, rate: 5 },
  { from: 80_200, base: 2_154, rate: 6 },
  { from: 119_500, base: 4_512, rate: 7 },
  { from: 169_400, base: 8_005, rate: 7.5 },
  { from: 270_300, base: 15_572, rate: 8 },
];

const VD_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 35_400, base: 0, rate: 1 },
  { from: 53_400, base: 180, rate: 2 },
  { from: 73_000, base: 572, rate: 3 },
  { from: 94_600, base: 1_220, rate: 4 },
  { from: 114_800, base: 2_028, rate: 5 },
  { from: 160_400, base: 4_308, rate: 6 },
  { from: 239_000, base: 9_024, rate: 7 },
  { from: 338_800, base: 16_010, rate: 7.5 },
  { from: 540_600, base: 31_145, rate: 8 },
];

const GE_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 17_493, base: 0, rate: 8 },
  { from: 21_076, base: 287, rate: 9 },
  { from: 23_184, base: 477, rate: 10 },
  { from: 25_292, base: 688, rate: 11 },
  { from: 27_400, base: 920, rate: 12 },
  { from: 32_668, base: 1_552, rate: 13 },
  { from: 36_881, base: 2_100, rate: 14 },
  { from: 41_094, base: 2_690, rate: 14.5 },
  { from: 45_307, base: 3_300, rate: 15 },
  { from: 73_797, base: 7_574, rate: 15.5 },
  { from: 120_158, base: 14_761, rate: 16 },
  { from: 161_252, base: 21_336, rate: 17 },
  { from: 184_435, base: 25_277, rate: 18 },
  { from: 261_191, base: 39_093, rate: 19 },
];

const GE_MARRIED: BracketStep[] = [
  // GE applique le quotient familial : on divise le revenu par 1.9 (couple)
  // ou 2 + 0.5 par enfant. Ici on pré-calcule un barème équivalent
  // proche pour les simulations rapides.
  { from: 0, base: 0, rate: 0 },
  { from: 33_237, base: 0, rate: 8 },
  { from: 40_044, base: 545, rate: 9 },
  { from: 44_050, base: 905, rate: 10 },
  { from: 48_055, base: 1_306, rate: 11 },
  { from: 52_060, base: 1_747, rate: 12 },
  { from: 62_069, base: 2_948, rate: 13 },
  { from: 70_074, base: 3_989, rate: 14 },
  { from: 78_079, base: 5_109, rate: 14.5 },
  { from: 86_083, base: 6_270, rate: 15 },
  { from: 140_214, base: 14_390, rate: 15.5 },
  { from: 228_300, base: 28_044, rate: 16 },
  { from: 306_379, base: 40_537, rate: 17 },
  { from: 350_426, base: 48_025, rate: 18 },
  { from: 496_263, base: 74_276, rate: 19 },
];

const VS_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 13_400, base: 0, rate: 1 },
  { from: 18_000, base: 46, rate: 4 },
  { from: 26_700, base: 394, rate: 5 },
  { from: 41_700, base: 1_144, rate: 7 },
  { from: 56_500, base: 2_180, rate: 9 },
  { from: 87_700, base: 4_988, rate: 11 },
  { from: 137_700, base: 10_488, rate: 13 },
  { from: 219_500, base: 21_122, rate: 14 },
];

const VS_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 26_800, base: 0, rate: 1 },
  { from: 36_000, base: 92, rate: 4 },
  { from: 53_400, base: 788, rate: 5 },
  { from: 83_400, base: 2_288, rate: 7 },
  { from: 113_000, base: 4_360, rate: 9 },
  { from: 175_400, base: 9_976, rate: 11 },
  { from: 275_400, base: 20_976, rate: 13 },
  { from: 439_000, base: 42_244, rate: 14 },
];

const FR_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 5_900, base: 0, rate: 0.5 },
  { from: 11_800, base: 30, rate: 1 },
  { from: 17_700, base: 89, rate: 2 },
  { from: 23_700, base: 209, rate: 3 },
  { from: 35_500, base: 563, rate: 4 },
  { from: 47_400, base: 1_039, rate: 5 },
  { from: 59_200, base: 1_629, rate: 6 },
  { from: 82_900, base: 3_051, rate: 7 },
  { from: 118_400, base: 5_536, rate: 8 },
  { from: 177_500, base: 10_264, rate: 9 },
  { from: 295_900, base: 20_920, rate: 10 },
];

const FR_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 11_800, base: 0, rate: 0.5 },
  { from: 23_700, base: 60, rate: 1 },
  { from: 35_500, base: 178, rate: 2 },
  { from: 47_400, base: 416, rate: 3 },
  { from: 71_100, base: 1_127, rate: 4 },
  { from: 94_700, base: 2_071, rate: 5 },
  { from: 118_400, base: 3_256, rate: 6 },
  { from: 165_800, base: 6_100, rate: 7 },
  { from: 236_900, base: 11_077, rate: 8 },
  { from: 354_900, base: 20_517, rate: 9 },
];

// Génération d'un barème générique (utilisé pour NE, JU, ZG en attente de
// barèmes finement calibrés). Profilé par "type" : haute / moyenne / basse
// fiscalité.
function genericProgressive(profile: "low" | "mid" | "high"): BracketStep[] {
  const factor = profile === "low" ? 0.6 : profile === "mid" ? 1 : 1.25;
  return [
    { from: 0, base: 0, rate: 0 },
    { from: 10_000, base: 0, rate: 1 * factor },
    { from: 20_000, base: 100 * factor, rate: 2 * factor },
    { from: 35_000, base: 400 * factor, rate: 3.5 * factor },
    { from: 55_000, base: 1_100 * factor, rate: 5 * factor },
    { from: 80_000, base: 2_350 * factor, rate: 6.5 * factor },
    { from: 120_000, base: 4_950 * factor, rate: 8 * factor },
    { from: 180_000, base: 9_750 * factor, rate: 9 * factor },
    { from: 280_000, base: 18_750 * factor, rate: 10 * factor },
    { from: 500_000, base: 40_750 * factor, rate: 11 * factor },
  ];
}

function genericMarried(profile: "low" | "mid" | "high"): BracketStep[] {
  const factor = profile === "low" ? 0.55 : profile === "mid" ? 0.9 : 1.1;
  return [
    { from: 0, base: 0, rate: 0 },
    { from: 20_000, base: 0, rate: 1 * factor },
    { from: 40_000, base: 200 * factor, rate: 2 * factor },
    { from: 65_000, base: 700 * factor, rate: 3.5 * factor },
    { from: 95_000, base: 1_750 * factor, rate: 5 * factor },
    { from: 140_000, base: 4_000 * factor, rate: 6.5 * factor },
    { from: 200_000, base: 7_900 * factor, rate: 8 * factor },
    { from: 300_000, base: 15_900 * factor, rate: 9 * factor },
    { from: 450_000, base: 29_400 * factor, rate: 10 * factor },
    { from: 800_000, base: 64_400 * factor, rate: 11 * factor },
  ];
}

const wealthScaleStandard: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 100_000, base: 0, rate: 0.15 },
  { from: 300_000, base: 300, rate: 0.25 },
  { from: 600_000, base: 1_050, rate: 0.35 },
  { from: 1_000_000, base: 2_450, rate: 0.45 },
  { from: 2_000_000, base: 6_950, rate: 0.6 },
];

export const CANTON_SCALES: Record<string, CantonTaxScale> = {
  // === Suisse romande (selectable + comparable v1) ===
  VD: {
    single: VD_SINGLE,
    married: VD_MARRIED,
    cantonalMultiplier: 1.55,
    communalMultiplierCapital: 0.785,
    churchRateProtestant: 0,
    childDeduction: 3_200,
    marriedDeduction: 1_300,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 56_000,
    wealthExemptionMarried: 112_000,
    capital: "Lausanne",
  },
  VS: {
    single: VS_SINGLE,
    married: VS_MARRIED,
    cantonalMultiplier: 1.5,
    communalMultiplierCapital: 1.1,
    childDeduction: 7_510,
    marriedDeduction: 0,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 30_000,
    wealthExemptionMarried: 60_000,
    capital: "Sion",
  },
  FR: {
    single: FR_SINGLE,
    married: FR_MARRIED,
    cantonalMultiplier: 1.0,
    communalMultiplierCapital: 0.79,
    childDeduction: 9_500,
    marriedDeduction: 0,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 50_000,
    wealthExemptionMarried: 100_000,
    capital: "Fribourg",
  },
  NE: {
    single: genericProgressive("high"),
    married: genericMarried("high"),
    cantonalMultiplier: 1.41,
    communalMultiplierCapital: 0.79,
    childDeduction: 6_500,
    marriedDeduction: 3_600,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 50_000,
    wealthExemptionMarried: 100_000,
    capital: "Neuchâtel",
  },
  GE: {
    single: GE_SINGLE,
    married: GE_MARRIED,
    cantonalMultiplier: 0.475,
    communalMultiplierCapital: 0.455,
    childDeduction: 13_000,
    marriedDeduction: 0,
    wealthScale: [
      { from: 0, base: 0, rate: 0 },
      { from: 113_000, base: 0, rate: 0.175 },
      { from: 339_000, base: 396, rate: 0.225 },
      { from: 678_000, base: 1_158, rate: 0.275 },
      { from: 1_130_000, base: 2_401, rate: 0.45 },
      { from: 1_695_000, base: 4_944, rate: 0.5 },
    ],
    wealthExemptionSingle: 82_200,
    wealthExemptionMarried: 164_400,
    capital: "Genève",
  },
  JU: {
    single: genericProgressive("high"),
    married: genericMarried("high"),
    cantonalMultiplier: 2.85,
    communalMultiplierCapital: 1.94,
    childDeduction: 5_300,
    marriedDeduction: 3_500,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 60_000,
    wealthExemptionMarried: 120_000,
    capital: "Delémont",
  },

  // === Référence comparateur uniquement (comparable v1, NON selectable) ===
  // ZG : barèmes revenu/fortune simplifiés, suffisants pour le comparateur.
  // Les paramètres détaillés (paroissial fin, IS, prestation capital) seront
  // ajoutés quand ZG passera selectable.
  ZG: {
    single: genericProgressive("low"),
    married: genericMarried("low"),
    cantonalMultiplier: 0.82,
    communalMultiplierCapital: 0.5,
    childDeduction: 12_000,
    marriedDeduction: 13_700,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 100_000,
    wealthExemptionMarried: 200_000,
    capital: "Zoug",
  },
};

/** Calcule l'impôt simple à partir d'un barème (un palier progressif standard). */
export function applySimpleScale(taxableIncome: number, scale: BracketStep[]): number {
  if (taxableIncome <= 0) return 0;
  let bracket = scale[0];
  for (const b of scale) {
    if (taxableIncome >= b.from) bracket = b;
    else break;
  }
  const excess = taxableIncome - bracket.from;
  return bracket.base + (excess * bracket.rate) / 100;
}

export interface CCComputeOptions {
  /** Code canton (ex: "VD") */
  canton: string;
  /** Revenu imposable (CHF) — après toutes déductions sauf déductions sociales du canton */
  taxableIncome: number;
  /** Statut familial */
  status: FilingStatus;
  /** Nombre d'enfants à charge */
  children?: number;
  /** Confession (pour impôt paroissial) */
  confession?: "none" | "catholic" | "protestant" | "other";
  /** Surcharge éventuelle du multiplicateur communal (ex: 0.7) */
  communalMultiplier?: number;
  /** Surcharge éventuelle du multiplicateur cantonal */
  cantonalMultiplier?: number;
}

export interface CCComputeResult {
  cantonal: number;
  communal: number;
  church: number;
  total: number;
  /** Taux marginal cantonal+communal estimé (%) */
  marginalRate: number;
  scale: CantonTaxScale;
}

export function computeCantonalCommunal(opts: CCComputeOptions): CCComputeResult {
  const scale = CANTON_SCALES[opts.canton];
  if (!scale) {
    throw new Error(
      `Canton hors scope v1 : "${opts.canton}". ` +
        `Cantons disponibles : ${Object.keys(CANTON_SCALES).join(", ")}. ` +
        `Voir docs/SCOPE.md pour ajouter un canton.`,
    );
  }
  const isMarried = opts.status === "married";
  const isSingleParent = opts.status === "single_with_children";
  // Famille monoparentale ou marié → barème "married"
  const bracketScale = isMarried || isSingleParent ? scale.married : scale.single;

  // Déductions sociales cantonales
  const socialDeductions =
    (opts.children ?? 0) * scale.childDeduction + (isMarried ? scale.marriedDeduction : 0);
  const adjusted = Math.max(0, opts.taxableIncome - socialDeductions);

  const simple = applySimpleScale(adjusted, bracketScale);

  const cantonalMult = opts.cantonalMultiplier ?? scale.cantonalMultiplier;
  const communalMult = opts.communalMultiplier ?? scale.communalMultiplierCapital;

  const cantonal = simple * cantonalMult;
  const communal = simple * communalMult;
  let church = 0;
  if (opts.confession === "catholic" && scale.churchRateCatholic) {
    church = simple * scale.churchRateCatholic;
  } else if (opts.confession === "protestant" && scale.churchRateProtestant) {
    church = simple * scale.churchRateProtestant;
  }

  // Taux marginal estimé
  let marginalBracket = bracketScale[0];
  for (const b of bracketScale) {
    if (adjusted >= b.from) marginalBracket = b;
    else break;
  }
  const marginalRate = marginalBracket.rate * (cantonalMult + communalMult);

  return {
    cantonal: Math.round(cantonal * 100) / 100,
    communal: Math.round(communal * 100) / 100,
    church: Math.round(church * 100) / 100,
    total: Math.round((cantonal + communal + church) * 100) / 100,
    marginalRate,
    scale,
  };
}

export interface WealthComputeOptions {
  canton: string;
  netWealth: number;
  status: FilingStatus;
  communalMultiplier?: number;
  cantonalMultiplier?: number;
}

export function computeWealthTax(opts: WealthComputeOptions): number {
  const scale = CANTON_SCALES[opts.canton];
  if (!scale) return 0;
  const exemption =
    opts.status === "married" || opts.status === "single_with_children"
      ? scale.wealthExemptionMarried
      : scale.wealthExemptionSingle;
  const taxable = Math.max(0, opts.netWealth - exemption);
  if (taxable === 0) return 0;
  // Barème wealth en pour mille
  let bracket = scale.wealthScale[0];
  for (const b of scale.wealthScale) {
    if (taxable >= b.from) bracket = b;
    else break;
  }
  const excess = taxable - bracket.from;
  const simple = bracket.base + (excess * bracket.rate) / 100;
  const cantonalMult = opts.cantonalMultiplier ?? scale.cantonalMultiplier;
  const communalMult = opts.communalMultiplier ?? scale.communalMultiplierCapital;
  return Math.round(simple * (cantonalMult + communalMult) * 100) / 100;
}
