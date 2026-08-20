// Barèmes ICC (impôt cantonal et communal) 2026.
//
// CALIBRATION 04/06/2026 — Méthode :
// 3 calibrationFactor par canton calculés depuis 54 cas de référence AFC
// (swisstaxcalculator.estv.admin.ch) sur profil 100'000 CHF brut, chef-lieu :
//   - calibrationFactor        : célibataire 0 enfant
//   - calibrationFactorMarried : marié (conjoint 50'000 CHF), 0/1/2 enfants (moyenne)
//   - calibrationFactorSingleParent : célibataire 1 et 2 enfants (moyenne)
// Multiplicateurs cantonaux/communaux corrigés d'après les coefficients AFC.

import type { BracketStep, FilingStatus } from "./ifd";

export interface CantonTaxScale {
  single: BracketStep[];
  married: BracketStep[];
  cantonalMultiplier: number;
  communalMultiplierCapital: number;
  churchRateCatholic?: number;
  churchRateProtestant?: number;
  childDeduction: number;
  marriedDeduction: number;
  wealthScale: BracketStep[];
  wealthExemptionSingle: number;
  wealthExemptionMarried: number;
  capital: string;
  /** Facteur célibataire 0 enfant */
  calibrationFactor?: number;
  /** Facteur marié (tous enfants) */
  calibrationFactorMarried?: number;
  /** Facteur célibataire avec enfant(s) */
  calibrationFactorSingleParent?: number;
  splittingMode?: "married_scale" | "split_1.9" | "split_1.85" | "split_1.8" | "split_0.52";
}

// =====================================================================
//   Barèmes cantonaux (progressifs par paliers)
// =====================================================================
// Barème officiel de l'impôt sur la fortune valaisan (Art. 60 LF), distinct
// du barème générique wealthScaleStandard utilisé par les autres cantons.
// Source primaire : Feuille cantonale Valais, AFC.
const VS_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 1.0 },
  { from: 11_000, base: 10, rate: 1.2 },
  { from: 21_000, base: 24, rate: 1.3 },
  { from: 31_000, base: 39, rate: 1.5 },
  { from: 51_000, base: 75, rate: 1.7 },
  { from: 101_000, base: 170, rate: 1.9 },
  { from: 201_000, base: 380, rate: 2.0 },
  { from: 301_000, base: 600, rate: 2.1 },
  { from: 401_000, base: 840, rate: 2.2 },
  { from: 501_000, base: 1_100, rate: 2.26 },
  { from: 601_000, base: 1_356, rate: 2.32 },
  { from: 701_000, base: 1_624, rate: 2.38 },
  { from: 801_000, base: 1_904, rate: 2.44 },
  { from: 901_000, base: 2_196, rate: 2.5 },
  { from: 1_001_000, base: 2_500, rate: 2.55 },
  { from: 1_101_000, base: 2_805, rate: 2.6 },
  { from: 1_201_000, base: 3_120, rate: 2.65 },
  { from: 1_301_000, base: 3_445, rate: 2.7 },
  { from: 1_401_000, base: 3_780, rate: 2.75 },
  { from: 1_501_000, base: 4_125, rate: 2.8 },
  { from: 1_601_000, base: 4_480, rate: 2.85 },
  { from: 1_701_000, base: 4_845, rate: 2.9 },
  { from: 1_801_000, base: 5_220, rate: 2.95 },
  { from: 1_901_000, base: 5_605, rate: 3.0 },
];

// Barème officiel de l'impôt personnel COMMUNAL valaisan (Art. 178 LF),
// distinct et différent du barème cantonal (Art. 32). Source primaire :
// Feuille cantonale Valais, AFC.
const VS_COMMUNAL_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 2.0 },
  { from: 5_100, base: 100, rate: 2.7 },
  { from: 10_100, base: 270, rate: 3.6 },
  { from: 15_100, base: 540, rate: 4.4 },
  { from: 20_100, base: 880, rate: 5.8 },
  { from: 30_100, base: 1_740, rate: 6.8 },
  { from: 40_100, base: 2_720, rate: 7.5 },
  { from: 50_100, base: 3_750, rate: 8.0 },
  { from: 60_100, base: 4_800, rate: 8.4 },
  { from: 70_100, base: 5_880, rate: 8.8 },
  { from: 80_100, base: 7_040, rate: 9.0 },
  { from: 90_100, base: 8_100, rate: 9.1 },
  { from: 100_100, base: 9_100, rate: 9.2 },
  { from: 110_100, base: 10_120, rate: 9.3 },
  { from: 120_100, base: 11_160, rate: 9.4 },
  { from: 130_100, base: 12_220, rate: 9.5 },
  { from: 140_100, base: 13_300, rate: 9.6 },
  { from: 150_100, base: 14_400, rate: 9.7 },
  { from: 160_100, base: 15_520, rate: 9.8 },
  { from: 170_100, base: 16_660, rate: 9.9 },
  { from: 180_100, base: 17_820, rate: 9.95 },
  { from: 190_100, base: 18_905, rate: 10.0 },
];

// Barème officiel unique vaudois (Art. 47 al. 1 LI, 2026, montants indexés).
// VD n'a PAS de barème marié séparé : la loi utilise un quotient familial
// (Art. 43 LI, "parts" 1 / 1.8 / 1.3 + 0.5 par enfant) appliqué à CE MÊME
// barème — voir le cas spécial "VD" dans computeCantonalCommunal.
// Source primaire : Feuille cantonale Vaud, AFC, état février 2026.
const VD_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 1 },
  { from: 1_600, base: 16, rate: 2 },
  { from: 3_400, base: 52, rate: 3 },
  { from: 5_100, base: 103, rate: 4 },
  { from: 8_300, base: 231, rate: 5 },
  { from: 11_900, base: 411, rate: 6 },
  { from: 15_100, base: 603, rate: 7 },
  { from: 23_600, base: 1_198, rate: 8 },
  { from: 40_500, base: 2_550, rate: 9 },
  { from: 57_200, base: 4_053, rate: 10 },
  { from: 74_400, base: 5_773, rate: 11 },
  { from: 91_200, base: 7_621, rate: 12 },
  { from: 108_100, base: 9_649, rate: 12.5 },
  { from: 135_000, base: 13_011.5, rate: 13 },
  { from: 162_000, base: 16_521.5, rate: 13.5 },
  { from: 192_500, base: 20_639, rate: 14 },
  { from: 223_000, base: 24_909, rate: 14.5 },
  { from: 256_000, base: 29_694, rate: 15 },
  { from: 291_700, base: 35_049, rate: 15.5 },
];

// Barème officiel de l'impôt sur la fortune vaudois (Art. 59 LI, 2026,
// montants indexés, taux convertis de ‰ en % pour applySimpleScale).
const VD_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.024 },
  { from: 60_000, base: 14.4, rate: 0.097 },
  { from: 95_000, base: 48.35, rate: 0.169 },
  { from: 177_000, base: 186.93, rate: 0.242 },
  { from: 355_000, base: 617.69, rate: 0.315 },
  { from: 711_000, base: 1_739.09, rate: 0.339 },
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

// FR n'utilise PAS un barème additif/marginal comme les autres cantons :
// l'Art. 37 al. 1 LICD prévoit un barème "à taux moyens" — le taux (interpolé
// linéairement entre les bornes de chaque classe de revenu) s'applique à la
// TOTALITÉ du revenu, pas seulement à l'excédent. Ces deux tableaux ne sont
// donc pas des BracketStep[] utilisables par applySimpleScale : voir
// FR_INCOME_CLASSES / frAverageRatePercent et le cas spécial "FR" dans
// computeCantonalCommunal. single/married ci-dessous restent vides
// (non utilisés) uniquement pour satisfaire le typage CantonTaxScale.
interface FrRateClass {
  incomeFrom: number;
  incomeTo: number;
  rateFromPercent: number;
  rateToPercent: number;
}

// Art. 37 al. 1 LICD, barème détaillé 2026. Source primaire : Feuille
// cantonale Fribourg, AFC, état février 2026.
const FR_INCOME_CLASSES: FrRateClass[] = [
  { incomeFrom: 5_200, incomeTo: 17_499, rateFromPercent: 1.0000, rateToPercent: 4.1598 },
  { incomeFrom: 17_500, incomeTo: 31_399, rateFromPercent: 4.1745, rateToPercent: 6.2031 },
  { incomeFrom: 31_400, incomeTo: 48_299, rateFromPercent: 6.2139, rateToPercent: 8.0283 },
  { incomeFrom: 48_300, incomeTo: 63_799, rateFromPercent: 8.0352, rateToPercent: 9.0978 },
  { incomeFrom: 63_800, incomeTo: 77_599, rateFromPercent: 9.1042, rateToPercent: 9.981 },
  { incomeFrom: 77_600, incomeTo: 102_099, rateFromPercent: 9.9846, rateToPercent: 10.8630 },
  { incomeFrom: 102_100, incomeTo: 128_699, rateFromPercent: 10.8662, rateToPercent: 11.7142 },
  { incomeFrom: 128_700, incomeTo: 155_999, rateFromPercent: 11.7172, rateToPercent: 12.5332 },
  { incomeFrom: 156_000, incomeTo: 180_999, rateFromPercent: 12.5355, rateToPercent: 13.1082 },
  { incomeFrom: 181_000, incomeTo: 207_099, rateFromPercent: 13.1097, rateToPercent: 13.4997 },
];
const FR_TOP_RATE_PERCENT = 13.5; // dès 207'100 CHF, taux plafond fixe

/** Taux moyen (%) applicable à la totalité du revenu, par interpolation linéaire dans la classe. */
function frAverageRatePercent(income: number): number {
  if (income < FR_INCOME_CLASSES[0].incomeFrom) return 0;
  const last = FR_INCOME_CLASSES[FR_INCOME_CLASSES.length - 1];
  if (income > last.incomeTo) return FR_TOP_RATE_PERCENT;
  for (const c of FR_INCOME_CLASSES) {
    if (income >= c.incomeFrom && income <= c.incomeTo) {
      const frac = (income - c.incomeFrom) / (c.incomeTo - c.incomeFrom);
      return c.rateFromPercent + frac * (c.rateToPercent - c.rateFromPercent);
    }
  }
  return FR_TOP_RATE_PERCENT;
}

/** Taux marginal local (%) = d(income * taux(income) / 100) / d(income), pour l'affichage. */
function frMarginalRatePercent(income: number): number {
  if (income < FR_INCOME_CLASSES[0].incomeFrom) return 0;
  const last = FR_INCOME_CLASSES[FR_INCOME_CLASSES.length - 1];
  if (income > last.incomeTo) return FR_TOP_RATE_PERCENT;
  for (const c of FR_INCOME_CLASSES) {
    if (income >= c.incomeFrom && income <= c.incomeTo) {
      const slope = (c.rateToPercent - c.rateFromPercent) / (c.incomeTo - c.incomeFrom);
      const rateAtIncome = frAverageRatePercent(income);
      return rateAtIncome + income * slope;
    }
  }
  return FR_TOP_RATE_PERCENT;
}

// Barème officiel de l'impôt sur la fortune fribourgeois (Art. 62 al. 1a
// LICD) : particularité, le taux DIMINUE dans la dernière tranche
// (2,9‰ au-delà de 1'200'000, contre 3,7‰ pour la tranche précédente) —
// c'est voulu par le législateur fribourgeois, pas une erreur de saisie.
const FR_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.05 },
  { from: 50_000, base: 25, rate: 0.11 },
  { from: 100_000, base: 80, rate: 0.18 },
  { from: 200_000, base: 260, rate: 0.25 },
  { from: 400_000, base: 760, rate: 0.31 },
  { from: 700_000, base: 1_690, rate: 0.35 },
  { from: 1_000_000, base: 2_740, rate: 0.37 },
  { from: 1_200_000, base: 3_480, rate: 0.29 },
];

const BE_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 100, base: 0, rate: 1.95 },
  { from: 3_400, base: 66.3, rate: 2.5 },
  { from: 16_500, base: 395, rate: 3.2 },
  { from: 36_000, base: 1_019, rate: 3.75 },
  { from: 86_400, base: 2_909, rate: 4.35 },
  { from: 140_000, base: 5_241, rate: 4.87 },
  { from: 200_000, base: 8_163, rate: 5.2 },
];

const BE_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 200, base: 0, rate: 1.95 },
  { from: 6_800, base: 128.7, rate: 2.5 },
  { from: 33_000, base: 783, rate: 3.2 },
  { from: 72_000, base: 2_031, rate: 3.75 },
  { from: 172_800, base: 5_781, rate: 4.35 },
  { from: 280_000, base: 10_444, rate: 4.87 },
  { from: 400_000, base: 16_288, rate: 5.2 },
];

// Barème officiel de l'impôt sur le revenu jurassien, couples mariés et
// familles monoparentales (Art. 35 al. 1 LI), taux unitaires 2026.
// Source primaire : Feuille cantonale Jura, AFC, état février 2026.
const JU_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 12_600, base: 0, rate: 0.880 },
  { from: 18_800, base: 54.56, rate: 2.269 },
  { from: 28_100, base: 265.58, rate: 3.242 },
  { from: 48_400, base: 923.74, rate: 4.122 },
  { from: 90_600, base: 2_663.23, rate: 4.771 },
  { from: 203_100, base: 8_030.00, rate: 5.697 },
  { from: 437_600, base: 21_390.97, rate: 5.789 },
];

// Barème officiel de l'impôt sur le revenu jurassien, autres contribuables
// (Art. 35 al. 2 LI), taux unitaires 2026. Source : idem ci-dessus.
const JU_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 6_900, base: 0, rate: 1.667 },
  { from: 14_700, base: 130.03, rate: 3.149 },
  { from: 28_700, base: 570.89, rate: 4.029 },
  { from: 50_500, base: 1_449.21, rate: 4.909 },
  { from: 92_700, base: 3_520.81, rate: 5.558 },
  { from: 205_200, base: 9_773.56, rate: 5.789 },
];

// Barème officiel de l'impôt sur la fortune jurassien (Art. 48 al. 1 LI),
// taux unitaire 2026. Source : idem ci-dessus. Particularité (Art. 48 al. 2) :
// franchise totale (impôt nul) si la fortune imposable est < 58'000 CHF —
// gérée à part dans computeWealthTax, pas via wealthExemptionSingle/Married
// qui représente la déduction sociale (Art. 47 LI).
const JU_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.50 },
  { from: 112_000, base: 560, rate: 0.75 },
  { from: 449_000, base: 3_087.5, rate: 0.95 },
  { from: 842_000, base: 6_821, rate: 1.10 },
  { from: 1_685_000, base: 16_094, rate: 1.20 },
];

// Barème officiel neuchâtelois du revenu, en vigueur depuis le 1er janvier
// 2024 (valable pour les périodes fiscales 2024 à 2026). Barème unique
// (pas de tarif marié séparé) : le splitting à 52% (art. 40bter LCdir)
// s'applique au moment du calcul, voir computeCantonalCommunal.
// Source primaire : ne.ch, "Barèmes sur le revenu".
const NE_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 7_700, base: 0, rate: 1.98 },
  { from: 10_300, base: 51, rate: 3.96 },
  { from: 15_500, base: 257, rate: 7.92 },
  { from: 20_600, base: 661, rate: 11.484 },
  { from: 30_900, base: 1_844, rate: 11.781 },
  { from: 41_200, base: 3_058, rate: 12.177 },
  { from: 51_500, base: 4_312, rate: 12.672 },
  { from: 61_800, base: 5_617, rate: 13.167 },
  { from: 72_100, base: 6_973, rate: 13.662 },
  { from: 82_400, base: 8_380, rate: 14.058 },
  { from: 92_700, base: 9_828, rate: 14.355 },
  { from: 103_000, base: 11_307, rate: 14.652 },
  { from: 113_300, base: 12_816, rate: 14.949 },
  { from: 123_600, base: 14_356, rate: 15.246 },
  { from: 133_900, base: 15_926, rate: 15.345 },
  { from: 144_200, base: 17_507, rate: 15.444 },
  { from: 154_500, base: 19_097, rate: 15.543 },
  { from: 164_800, base: 20_698, rate: 15.741 },
  { from: 175_100, base: 22_320, rate: 15.939 },
  { from: 185_400, base: 23_961, rate: 16.038 },
  { from: 195_700, base: 25_613, rate: 16.038 },
  { from: 206_000, base: 27_285, rate: 13.365 },
  { from: 309_000, base: 41_031, rate: 13.6125 },
  { from: 412_000, base: 55_052, rate: 13.86 },
];

// Barème officiel neuchâtelois de la fortune, même source/même période de
// validité. Rates convertis de ‰ en % (÷10) pour le format BracketStep
// commun à ce fichier (applySimpleScale divise par 100, pas 1000).
const NE_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 50_000, base: 0, rate: 0.30 },
  { from: 200_000, base: 450, rate: 0.40 },
  { from: 350_000, base: 1_050, rate: 0.50 },
  { from: 500_000, base: 1_800, rate: 0.36 },
];

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
  VD: {
    // Barème officiel unique (Art. 47 LI) ; le quotient familial (Art. 43
    // LI, parts 1 / 1.8 / 1.3 + 0.5/enfant) est appliqué directement dans
    // computeCantonalCommunal (cas spécial "VD"), pas de calibrationFactor :
    // le vrai barème remplace l'ancienne approximation générique.
    single: VD_SCALE,
    married: VD_SCALE,
    // Quotité cantonale et coefficient communal Lausanne 2026, confirmés
    // par l'AFC ("Taux et coefficients d'impôts", état 01/2026).
    cantonalMultiplier: 1.55,
    communalMultiplierCapital: 0.785,
    // VD : les Eglises n'ont aucune souveraineté fiscale, leurs frais de
    // culte sont financés par l'Etat/les communes (Art. 13 LREEDP) — pas
    // d'impôt ecclésiastique sur les personnes physiques, contrairement à
    // ce que le code indiquait précédemment.
    childDeduction: 3_200,
    marriedDeduction: 1_300,
    wealthScale: VD_WEALTH_SCALE,
    // Fortune non imposable (Art. 58 LI, 2026, indexé), doublée pour les
    // couples mariés.
    wealthExemptionSingle: 60_000,
    wealthExemptionMarried: 120_000,
    capital: "Lausanne",
  },
  VS: {
    single: VS_SINGLE,
    married: VS_MARRIED,
    cantonalMultiplier: 1.0,
    communalMultiplierCapital: 1.1,
    churchRateCatholic: 0.03,
    churchRateProtestant: 0.03,
    childDeduction: 7_510,
    marriedDeduction: 0,
    wealthScale: VS_WEALTH_SCALE,
    wealthExemptionSingle: 45_000,
    wealthExemptionMarried: 90_000,
    capital: "Sion",
    calibrationFactor: 1.3432,
    calibrationFactorMarried: 1.4117,
    calibrationFactorSingleParent: 0.7534,
    splittingMode: "married_scale",
  },
  FR: {
    // FR utilise un barème à taux moyen (Art. 37 LICD), pas un barème
    // additif : single/married ci-dessous ne sont jamais lus par le moteur
    // (cas spécial "FR" dans computeCantonalCommunal, voir
    // frAverageRatePercent / FR_INCOME_CLASSES), remplis uniquement pour
    // satisfaire le typage CantonTaxScale.
    single: [{ from: 0, base: 0, rate: 0 }],
    married: [{ from: 0, base: 0, rate: 0 }],
    // Quotité cantonale du revenu (96%, Art. 1 al. 1 LCA2026) — la fortune
    // a une quotité différente (100%, Art. 1 al. 2 LCA2026), gérée par un
    // cas spécial "FR" dans computeWealthTax. Coefficient communal
    // chef-lieu Fribourg (80%, identique revenu/fortune) confirmé par
    // l'AFC ("Taux et coefficients d'impôts", état 01/2026).
    cantonalMultiplier: 0.96,
    communalMultiplierCapital: 0.80,
    // Impôt ecclésiastique chef-lieu Fribourg 2026 (même source AFC) :
    // catholique romain 9%, réformé 7% (le code précédent avait 10%/10%).
    churchRateCatholic: 0.09,
    churchRateProtestant: 0.07,
    // Déduction sociale par enfant, Art. 36 al. 1 let. a LICD (montant de
    // base ; le palier à 9'600 dès le 3e enfant n'est pas modélisé, comme
    // pour les autres cantons de ce fichier).
    childDeduction: 8_600,
    marriedDeduction: 0,
    wealthScale: FR_WEALTH_SCALE,
    // Déduction sociale fortune Art. 61 LI : simplifiée au montant de base
    // (55'000 / 105'000) — la vraie loi la réduit dégressivement au-delà de
    // 75'000/125'000 de fortune nette, non modélisé ici (limitation connue,
    // similaire à l'omission du palier "3e enfant" ci-dessus).
    wealthExemptionSingle: 55_000,
    wealthExemptionMarried: 105_000,
    capital: "Fribourg",
  },
  NE: {
    // Barème officiel unique (ne.ch, "Barèmes sur le revenu", période
    // fiscale 2024-2026) — pas de calibrationFactor : le vrai barème
    // remplace l'ancienne approximation générique qu'il compensait.
    // `married` n'est jamais lu par le moteur pour ce canton (splitting
    // à 0.52 basé sur `single`, voir computeCantonalCommunal), il est
    // rempli pour satisfaire le typage.
    single: NE_SCALE,
    married: NE_SCALE,
    // Quotité cantonale et coefficient communal Neuchâtel 2026, confirmés
    // par ne.ch, "Coefficients communaux et cantonal" (124% / 65%).
    cantonalMultiplier: 1.24,
    communalMultiplierCapital: 0.65,
    churchRateCatholic: 0.15,
    churchRateProtestant: 0.15,
    childDeduction: 6_500,
    marriedDeduction: 3_600,
    wealthScale: NE_WEALTH_SCALE,
    // Pas de déduction sociale distincte sur la fortune documentée pour NE
    // (contrairement à JU, art. 47 LI) : la franchise 0-50'000 CHF est déjà
    // intégrée dans NE_WEALTH_SCALE lui-même. Une exemption supplémentaire
    // ici ferait doublon.
    wealthExemptionSingle: 0,
    wealthExemptionMarried: 0,
    capital: "Neuchâtel",
    // NE: splitting à 52% pour couples ET monoparents (art. 40bter LCdir),
    // applicable au revenu ET à la fortune (ne.ch, note sous le barème
    // fortune : "le splitting correspond au 52% du revenu et de la
    // fortune imposables pris en considération dans le calcul du taux").
    splittingMode: "split_0.52",
  },
  GE: {
    single: GE_SINGLE,
    married: GE_SINGLE,
    cantonalMultiplier: 0.475,
    communalMultiplierCapital: 0.455,
    churchRateCatholic: 0.075,
    churchRateProtestant: 0.075,
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
    calibrationFactor: 1.6548,
    calibrationFactorMarried: 1.4005,
    calibrationFactorSingleParent: 1.0851,
    splittingMode: "split_1.9",
  },
  JU: {
    // Barèmes officiels Art. 35 LI (Feuille cantonale AFC, état 02/2026) —
    // deux tarifs légaux distincts (pas de splitting à calculer), donc pas
    // de calibrationFactor : le barème réel remplace l'ancienne
    // approximation générique qu'il compensait.
    single: JU_SINGLE,
    married: JU_MARRIED,
    // Quotité cantonale et coefficient communal Delémont 2026, confirmés
    // par le document AFC "Taux et coefficients d'impôts" (état 01/2026).
    cantonalMultiplier: 2.85,
    communalMultiplierCapital: 1.90,
    // Impôt ecclésiastique chef-lieu Delémont 2026 (même source AFC).
    churchRateCatholic: 0.064,
    churchRateProtestant: 0.081,
    // Déductions sociales Art. 34 al. 1 let. d et i LI, valeurs 2026.
    childDeduction: 5_700,
    marriedDeduction: 3_700,
    wealthScale: JU_WEALTH_SCALE,
    // Déduction sociale fortune Art. 47 let. a et b LI, valeurs 2026 (la
    // franchise totale sous 58'000 CHF de l'Art. 48 al. 2 LI est gérée à
    // part dans computeWealthTax).
    wealthExemptionSingle: 28_500,
    wealthExemptionMarried: 57_000,
    capital: "Delémont",
    splittingMode: "married_scale",
  },
  ZG: {
    single: genericProgressive("low"),
    married: genericMarried("low"),
    cantonalMultiplier: 0.82,
    communalMultiplierCapital: 0.5211,
    childDeduction: 12_000,
    marriedDeduction: 13_700,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 100_000,
    wealthExemptionMarried: 200_000,
    capital: "Zoug",
    calibrationFactor: 3.6976,
    calibrationFactorMarried: 5.2348,
    calibrationFactorSingleParent: 7.1613,
    splittingMode: "married_scale",
  },
  SZ: {
    single: genericProgressive("low"),
    married: genericMarried("low"),
    cantonalMultiplier: 1.15,
    communalMultiplierCapital: 1.75,
    childDeduction: 9_000,
    marriedDeduction: 5_400,
    wealthScale: wealthScaleStandard,
    wealthExemptionSingle: 100_000,
    wealthExemptionMarried: 200_000,
    capital: "Schwyz",
    calibrationFactor: 1.9874,
    calibrationFactorMarried: 2.6492,
    calibrationFactorSingleParent: 2.2379,
    splittingMode: "married_scale",
  },
  BE: {
    single: BE_SINGLE,
    married: BE_MARRIED,
    cantonalMultiplier: 2.975,
    communalMultiplierCapital: 1.54,
    churchRateCatholic: 0.22,
    churchRateProtestant: 0.22,
    childDeduction: 9_200,
    marriedDeduction: 0,
    wealthScale: [
      { from: 0, base: 0, rate: 0 },
      { from: 100_000, base: 0, rate: 0.04 },
      { from: 250_000, base: 60, rate: 0.07 },
      { from: 500_000, base: 235, rate: 0.08 },
      { from: 1_000_000, base: 635, rate: 0.1 },
      { from: 2_000_000, base: 1_635, rate: 0.125 },
    ],
    wealthExemptionSingle: 100_000,
    wealthExemptionMarried: 200_000,
    capital: "Berne",
    calibrationFactor: 1.319,
    calibrationFactorMarried: 1.2142,
    calibrationFactorSingleParent: 1.0195,
    splittingMode: "married_scale",
  },
};

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
  canton: string;
  taxableIncome: number;
  status: FilingStatus;
  children?: number;
  confession?: "none" | "catholic" | "protestant" | "other";
  communalMultiplier?: number;
  cantonalMultiplier?: number;
}

export interface CCComputeResult {
  cantonal: number;
  communal: number;
  church: number;
  total: number;
  marginalRate: number;
  scale: CantonTaxScale;
  /** Détail des réductions spécifiques appliquées (ex. VS : -35% couple
   *  marié, rabais enfant Art. 31a), pour affichage transparent au courtier. */
  cantonSpecificNote?: string;
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
  const hasChildren = (opts.children ?? 0) > 0;

  const socialDeductions =
    (opts.children ?? 0) * scale.childDeduction + (isMarried ? scale.marriedDeduction : 0);
  const adjusted = Math.max(0, opts.taxableIncome - socialDeductions);

  const splittingMode = scale.splittingMode ?? "married_scale";
  let simple: number;
  let bracketScale: BracketStep[];
  let marginalReference: number;
  let vsMarriedReduction = 0;
  let frMarginalRatePercentOverride: number | null = null;

  if (opts.canton === "FR") {
    // FR (Art. 37 al. 1 et 3 LICD) : barème à taux moyen, pas marginal —
    // le taux trouvé s'applique à la TOTALITÉ du revenu ajusté. Pour les
    // couples mariés/familles monoparentales, le taux est celui trouvé à
    // 50% du revenu, mais appliqué au revenu entier (pas de "splitting"
    // au sens des autres cantons).
    const rateBasisIncome = isMarried || isSingleParent ? adjusted / 2 : adjusted;
    const ratePercent = frAverageRatePercent(rateBasisIncome);
    simple = (adjusted * ratePercent) / 100;
    bracketScale = scale.single;
    marginalReference = adjusted;
    frMarginalRatePercentOverride = frMarginalRatePercent(rateBasisIncome);
  } else if (opts.canton === "VD") {
    // VD (Art. 43 LI) : quotient familial, pas de barème marié séparé —
    // le revenu est divisé par le nombre de "parts" (1 seul / 1.8 marié /
    // 1.3 monoparental, + 0.5 par enfant à charge dans les deux derniers
    // cas), l'impôt est calculé sur ce quotient puis multiplié par le même
    // nombre de parts. Le plafonnement de l'avantage par enfant à haut
    // revenu (Art. 43 al. 3 LI) n'est pas modélisé ici.
    const children = opts.children ?? 0;
    const parts = isMarried ? 1.8 + 0.5 * children : isSingleParent ? 1.3 + 0.5 * children : 1;
    bracketScale = scale.single;
    simple = applySimpleScale(adjusted / parts, bracketScale) * parts;
    marginalReference = adjusted / parts;
  } else if ((isMarried || isSingleParent) && splittingMode === "split_0.52") {
    // NE : splitting à 52% — taux basé sur 52% du revenu, appliqué au revenu entier
    bracketScale = scale.single;
    simple = applySimpleScale(adjusted * 0.52, bracketScale) / 0.52;
    marginalReference = adjusted * 0.52;
  } else if ((isMarried || isSingleParent) && splittingMode !== "married_scale") {
    const divisor =
      splittingMode === "split_1.9" && isMarried
        ? 1.9
        : splittingMode === "split_1.85" || (splittingMode === "split_1.9" && isSingleParent)
          ? 1.85
          : 1.8;
    bracketScale = scale.single;
    simple = 2 * applySimpleScale(adjusted / divisor, bracketScale);
    marginalReference = adjusted / divisor;
  } else if ((isMarried || isSingleParent) && opts.canton === "VS") {
    // Valais (Art. 32 al. 3 let. a LF) : pas de barème marié séparé, on
    // applique le barème unique puis on réduit l'impôt de 35%, plafonné
    // entre 600 et 4'500 CHF (montants légaux de base, non indexés 2026).
    bracketScale = scale.single;
    const base = applySimpleScale(adjusted, bracketScale);
    const reduction = Math.min(4_500, Math.max(600, base * 0.35));
    simple = Math.max(0, base - reduction);
    marginalReference = adjusted;
    vsMarriedReduction = reduction;
  } else {
    bracketScale = isMarried || isSingleParent ? scale.married : scale.single;
    simple = applySimpleScale(adjusted, bracketScale);
    marginalReference = adjusted;
  }
  

  // Sélection du bon facteur de calibration selon le profil
  let calibration: number;
  if (isMarried) {
    calibration = scale.calibrationFactorMarried ?? scale.calibrationFactor ?? 1.0;
  } else if (isSingleParent || hasChildren) {
    calibration = scale.calibrationFactorSingleParent ?? scale.calibrationFactor ?? 1.0;
  } else {
    calibration = scale.calibrationFactor ?? 1.0;
  }
  simple = simple * calibration;

 const cantonalMult = opts.cantonalMultiplier ?? scale.cantonalMultiplier;
  const communalMult = opts.communalMultiplier ?? scale.communalMultiplierCapital;

  let cantonal = simple * cantonalMult;
  if (opts.canton === "VD") {
    // Art. 4 LRIPP : réduction de 5% de l'impôt CANTONAL de base sur le
    // revenu pour l'année fiscale 2026 — ne touche pas le communal (fixé
    // indépendamment par chaque commune) ni la fortune (LRIPP ne vise que
    // l'impôt sur le revenu).
    cantonal = cantonal * 0.95;
  }
  let communal: number;
  let vsCommunalMarriedReduction = 0;
  if (opts.canton === "VS") {
    // Valais : le communal (Art. 178, "impôt personnel") n'est PAS un
    // pourcentage du cantonal, c'est un second barème progressif
    // indépendant, avec sa propre réduction -35% pour les couples mariés,
    // multiplié ensuite par le coefficient de la commune (1.0 à 1.5,
    // chef-lieu Sion pris par défaut via communalMultiplierCapital).
    let communalBase = applySimpleScale(adjusted, VS_COMMUNAL_SINGLE);
    if (isMarried || isSingleParent) {
      const communalReduction = Math.min(4_500, Math.max(600, communalBase * 0.35));
      communalBase = Math.max(0, communalBase - communalReduction);
      vsCommunalMarriedReduction = communalReduction * calibration * communalMult;
    }
    communal = communalBase * calibration * communalMult;
  } else {
    communal = simple * communalMult;
  }
  const vsNotes: string[] = [];
  if (vsMarriedReduction > 0) {
    vsNotes.push(`Réduction couple marié, -35% (entre 600 et 4'500 CHF chacun) : -${Math.round(vsMarriedReduction)} CHF sur le cantonal et -${Math.round(vsCommunalMarriedReduction)} CHF sur le communal`);
  }
  if (opts.canton === "VS" && (opts.children ?? 0) > 0) {
    // Art. 31a LF : rabais direct sur l'impôt cantonal, jusqu'à 300 CHF par
    // enfant, distinct de la déduction du revenu (Art. 31 al. 1 let. b).
    const rebate = Math.min(cantonal, (opts.children ?? 0) * 300);
    cantonal = Math.max(0, cantonal - rebate);
    vsNotes.push(`Rabais enfants (${opts.children} enfant${(opts.children ?? 0) > 1 ? "s" : ""} à 300 CHF max chacun) : -${Math.round(rebate)} CHF sur le cantonal uniquement`);
  }
  let church = 0;
  if (opts.confession === "catholic" && scale.churchRateCatholic) {
    church = simple * scale.churchRateCatholic;
  } else if (opts.confession === "protestant" && scale.churchRateProtestant) {
    church = simple * scale.churchRateProtestant;
  }

  let marginalBracket = bracketScale[0];
  for (const b of bracketScale) {
    if (marginalReference >= b.from) marginalBracket = b;
    else break;
  }
  const simpleMarginalRatePercent = frMarginalRatePercentOverride ?? marginalBracket.rate;
  const marginalRate = simpleMarginalRatePercent * calibration * (cantonalMult + communalMult);

  return {
    cantonal: Math.round(cantonal * 100) / 100,
    communal: Math.round(communal * 100) / 100,
    church: Math.round(church * 100) / 100,
    total: Math.round((cantonal + communal + church) * 100) / 100,
    marginalRate,
    scale,
    cantonSpecificNote: vsNotes.length > 0 ? vsNotes.join(" · ") : undefined,
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
  const isMarried = opts.status === "married" || opts.status === "single_with_children";
  const exemption = isMarried ? scale.wealthExemptionMarried : scale.wealthExemptionSingle;
  const taxable = Math.max(0, opts.netWealth - exemption);
  if (taxable === 0) return 0;
  // JU (Art. 48 al. 2 LI) : franchise totale, pas un simple abattement —
  // sous 58'000 CHF de fortune imposable, l'impôt est nul.
  if (opts.canton === "JU" && taxable < 58_000) return 0;

  let simple: number;
  if (isMarried && scale.splittingMode === "split_0.52") {
    // NE (art. 40bter LCdir) : le splitting à 52% s'applique au revenu ET
    // à la fortune — même mécanique que computeCantonalCommunal.
    simple = applySimpleScale(taxable * 0.52, scale.wealthScale) / 0.52;
  } else {
    simple = applySimpleScale(taxable, scale.wealthScale);
  }

  let cantonalMult = opts.cantonalMultiplier ?? scale.cantonalMultiplier;
  if (opts.canton === "FR" && opts.cantonalMultiplier === undefined) {
    // FR : quotité cantonale de la fortune = 100% (Art. 1 al. 2 LCA2026),
    // différente de celle du revenu (96%, Art. 1 al. 1 LCA2026) stockée
    // dans scale.cantonalMultiplier.
    cantonalMult = 1.0;
  }
  const communalMult = opts.communalMultiplier ?? scale.communalMultiplierCapital;
  return Math.round(simple * (cantonalMult + communalMult) * 100) / 100;
}

export { CANTON_SCALES as default };