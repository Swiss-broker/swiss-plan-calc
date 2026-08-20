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
  splittingMode?: "married_scale" | "split_0.52";
}

// =====================================================================
//   Barèmes cantonaux (progressifs par paliers)
// =====================================================================
// Barème officiel de l'impôt sur la fortune valaisan (Art. 60 LF), propre au
// canton (voir VS_CANTONAL_CLASSES / VS_COMMUNAL_CLASSES pour le revenu).
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

// Barème officiel unique genevois (Art. 41 al. 1 LIPP + Art. 17 RCEPF,
// montants indexés 2026). GE n'a pas de barème marié séparé : Art. 41 al. 2
// LIPP applique "le taux qui correspond à 50% du revenu" à la totalité du
// revenu des couples mariés — équivalent mathématique de 2×impôt(revenu/2),
// avec un diviseur de 2.0 (pas 1.9) — voir le cas spécial "GE" dans
// computeCantonalCommunal. Source primaire : Feuille cantonale Genève, AFC,
// état février 2026.
const GE_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 18_700, base: 0, rate: 7.3 },
  { from: 22_530, base: 279.59, rate: 8.2 },
  { from: 24_784, base: 464.42, rate: 9.1 },
  { from: 27_036, base: 669.35, rate: 10 },
  { from: 29_290, base: 894.75, rate: 10.9 },
  { from: 34_922, base: 1_508.64, rate: 11.3 },
  { from: 39_428, base: 2_017.82, rate: 12.3 },
  { from: 43_935, base: 2_572.18, rate: 12.8 },
  { from: 48_441, base: 3_148.95, rate: 13.2 },
  { from: 77_730, base: 7_015.09, rate: 14.2 },
  { from: 127_297, base: 14_053.61, rate: 15 },
  { from: 171_231, base: 20_643.71, rate: 15.6 },
  { from: 193_762, base: 24_158.54, rate: 15.8 },
  { from: 277_125, base: 37_329.90, rate: 16 },
  { from: 295_150, base: 40_213.90, rate: 16.8 },
  { from: 415_688, base: 60_464.28, rate: 17.6 },
  { from: 651_131, base: 101_902.25, rate: 18 },
];

// Barème principal de la fortune genevoise (Art. 59 al. 1 LIPP + Art. 18
// al. 1 RCEPF, 2026, montants indexés). Source : Feuille cantonale Genève,
// AFC, état février 2026.
const GE_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.149 },
  { from: 118_722, base: 176.9, rate: 0.191 },
  { from: 237_443, base: 403.65, rate: 0.234 },
  { from: 356_165, base: 681.45, rate: 0.255 },
  { from: 474_886, base: 984.2, rate: 0.276 },
  { from: 712_330, base: 1_639.55, rate: 0.298 },
  { from: 949_772, base: 2_347.15, rate: 0.319 },
  { from: 1_187_215, base: 3_104.6, rate: 0.34 },
  { from: 1_424_658, base: 3_911.9, rate: 0.361 },
  { from: 1_780_823, base: 5_197.65, rate: 0.383 },
];

// Barème CANTONAL COMPLÉMENTAIRE de la fortune genevoise (Art. 59 al. 2
// LIPP + Art. 18 al. 2 RCEPF, 2026), en plus du barème principal ci-dessus
// (Art. 59 al. 1 LIPP, stocké comme wealthScale standard). Explicitement
// sans centime communal ("il n'est perçu aucun centime additionnel sur cet
// impôt supplémentaire sur la fortune") — voir le cas spécial "GE" dans
// computeWealthTax.
const GE_WEALTH_SUPPLEMENTARY_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 118_722, base: 0, rate: 0.00956 },
  { from: 237_443, base: 11.35, rate: 0.01169 },
  { from: 356_165, base: 25.25, rate: 0.0255 },
  { from: 474_886, base: 55.5, rate: 0.02763 },
  { from: 712_330, base: 121.1, rate: 0.04463 },
  { from: 949_772, base: 227.05, rate: 0.04781 },
  { from: 1_187_215, base: 340.55, rate: 0.068 },
  { from: 1_424_658, base: 502.0, rate: 0.07225 },
  { from: 1_780_823, base: 759.35, rate: 0.09563 },
  { from: 3_561_646, base: 2_462.35, rate: 0.11475 },
];

// VS utilise un barème à taux moyen (Art. 32 LF), pas un barème additif :
// single/married ci-dessous ne sont jamais lus par le moteur (cas spécial
// "VS" dans computeCantonalCommunal, voir VS_CANTONAL_CLASSES /
// averageRatePercent), remplis uniquement pour satisfaire le typage
// CantonTaxScale.
const VS_SINGLE: BracketStep[] = [{ from: 0, base: 0, rate: 0 }];
const VS_MARRIED: BracketStep[] = [{ from: 0, base: 0, rate: 0 }];

// FR et VS n'utilisent PAS un barème additif/marginal comme les autres
// cantons : leurs lois prévoient un barème "à taux moyens" — le taux
// (interpolé linéairement entre les bornes de chaque classe de revenu)
// s'applique à la TOTALITÉ du revenu, pas seulement à l'excédent. Voir les
// cas spéciaux "FR"/"VS" dans computeCantonalCommunal, qui utilisent
// averageRatePercent/marginalRatePercentFromClasses ci-dessous au lieu de
// applySimpleScale.
interface AverageRateClass {
  incomeFrom: number;
  incomeTo: number;
  rateFromPercent: number;
  rateToPercent: number;
}

/** Taux moyen (%) applicable à la totalité du revenu, par interpolation linéaire dans la classe. */
function averageRatePercent(income: number, classes: AverageRateClass[], topRatePercent: number): number {
  if (income < classes[0].incomeFrom) return 0;
  const last = classes[classes.length - 1];
  if (income > last.incomeTo) return topRatePercent;
  for (const c of classes) {
    if (income >= c.incomeFrom && income <= c.incomeTo) {
      const frac = (income - c.incomeFrom) / (c.incomeTo - c.incomeFrom);
      return c.rateFromPercent + frac * (c.rateToPercent - c.rateFromPercent);
    }
  }
  return topRatePercent;
}

/** Taux marginal local (%) = d(income * taux(income) / 100) / d(income), pour l'affichage. */
function marginalRatePercentFromClasses(income: number, classes: AverageRateClass[], topRatePercent: number): number {
  if (income < classes[0].incomeFrom) return 0;
  const last = classes[classes.length - 1];
  if (income > last.incomeTo) return topRatePercent;
  for (const c of classes) {
    if (income >= c.incomeFrom && income <= c.incomeTo) {
      const slope = (c.rateToPercent - c.rateFromPercent) / (c.incomeTo - c.incomeFrom);
      const rateAtIncome = averageRatePercent(income, classes, topRatePercent);
      return rateAtIncome + income * slope;
    }
  }
  return topRatePercent;
}

// Art. 37 al. 1 LICD, barème détaillé 2026. Source primaire : Feuille
// cantonale Fribourg, AFC, état février 2026.
const FR_INCOME_CLASSES: AverageRateClass[] = [
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

// Art. 32 al. 1 LF, barème cantonal détaillé 2026 (non indexé, valeurs déjà
// définitives — le VS n'a pas de multiple annuel, ce barème est directement
// applicable comme pour l'IFD). Source primaire : Feuille cantonale Valais,
// AFC, état février 2026.
const VS_CANTONAL_CLASSES: AverageRateClass[] = [
  { incomeFrom: 0, incomeTo: 6_300, rateFromPercent: 2.0, rateToPercent: 2.0 },
  { incomeFrom: 6_300, incomeTo: 12_700, rateFromPercent: 2.0, rateToPercent: 2.7992 },
  { incomeFrom: 12_700, incomeTo: 19_000, rateFromPercent: 2.7992, rateToPercent: 3.6915 },
  { incomeFrom: 19_000, incomeTo: 25_400, rateFromPercent: 3.6915, rateToPercent: 4.5982 },
  { incomeFrom: 25_400, incomeTo: 38_100, rateFromPercent: 4.5982, rateToPercent: 6.2978 },
  { incomeFrom: 38_100, incomeTo: 50_800, rateFromPercent: 6.2978, rateToPercent: 7.6975 },
  { incomeFrom: 50_800, incomeTo: 63_500, rateFromPercent: 7.6975, rateToPercent: 8.9974 },
  { incomeFrom: 63_500, incomeTo: 76_200, rateFromPercent: 8.9974, rateToPercent: 10.4963 },
  { incomeFrom: 76_200, incomeTo: 88_900, rateFromPercent: 10.4963, rateToPercent: 11.7962 },
  { incomeFrom: 88_900, incomeTo: 101_600, rateFromPercent: 11.7962, rateToPercent: 12.9960 },
  { incomeFrom: 101_600, incomeTo: 114_300, rateFromPercent: 12.9960, rateToPercent: 13.2989 },
  { incomeFrom: 114_300, incomeTo: 127_000, rateFromPercent: 13.2989, rateToPercent: 13.4992 },
  { incomeFrom: 127_000, incomeTo: 139_700, rateFromPercent: 13.4992, rateToPercent: 13.5498 },
  { incomeFrom: 139_700, incomeTo: 152_400, rateFromPercent: 13.5498, rateToPercent: 13.5998 },
  { incomeFrom: 152_400, incomeTo: 165_100, rateFromPercent: 13.5998, rateToPercent: 13.6497 },
  { incomeFrom: 165_100, incomeTo: 177_800, rateFromPercent: 13.6497, rateToPercent: 13.6997 },
  { incomeFrom: 177_800, incomeTo: 190_500, rateFromPercent: 13.6997, rateToPercent: 13.7497 },
  { incomeFrom: 190_500, incomeTo: 203_200, rateFromPercent: 13.7497, rateToPercent: 13.7997 },
  { incomeFrom: 203_200, incomeTo: 215_900, rateFromPercent: 13.7997, rateToPercent: 13.8497 },
  { incomeFrom: 215_900, incomeTo: 228_700, rateFromPercent: 13.8497, rateToPercent: 13.9000 },
  { incomeFrom: 228_700, incomeTo: 241_400, rateFromPercent: 13.9000, rateToPercent: 13.9500 },
  { incomeFrom: 241_400, incomeTo: 254_100, rateFromPercent: 13.9500, rateToPercent: 14.0 },
];
const VS_CANTONAL_TOP_RATE_PERCENT = 14.0;

// Art. 178 al. 1 LF, barème communal détaillé 2026 (tarif de base ; chaque
// commune applique ensuite son propre coefficient 1.0–1.5, voir
// communalMultiplierCapital). Source : idem ci-dessus.
const VS_COMMUNAL_CLASSES: AverageRateClass[] = [
  { incomeFrom: 0, incomeTo: 5_000, rateFromPercent: 2.0, rateToPercent: 2.0 },
  { incomeFrom: 5_000, incomeTo: 10_000, rateFromPercent: 2.0, rateToPercent: 2.7 },
  { incomeFrom: 10_000, incomeTo: 15_000, rateFromPercent: 2.7, rateToPercent: 3.6 },
  { incomeFrom: 15_000, incomeTo: 20_000, rateFromPercent: 3.6, rateToPercent: 4.4 },
  { incomeFrom: 20_000, incomeTo: 30_000, rateFromPercent: 4.4, rateToPercent: 5.8 },
  { incomeFrom: 30_000, incomeTo: 40_000, rateFromPercent: 5.8, rateToPercent: 6.8 },
  { incomeFrom: 40_000, incomeTo: 50_000, rateFromPercent: 6.8, rateToPercent: 7.5 },
  { incomeFrom: 50_000, incomeTo: 60_000, rateFromPercent: 7.5, rateToPercent: 8.0 },
  { incomeFrom: 60_000, incomeTo: 70_000, rateFromPercent: 8.0, rateToPercent: 8.4 },
  { incomeFrom: 70_000, incomeTo: 80_000, rateFromPercent: 8.4, rateToPercent: 8.8 },
  { incomeFrom: 80_000, incomeTo: 90_000, rateFromPercent: 8.8, rateToPercent: 9.0 },
  { incomeFrom: 90_000, incomeTo: 100_000, rateFromPercent: 9.0, rateToPercent: 9.1 },
  { incomeFrom: 100_000, incomeTo: 110_000, rateFromPercent: 9.1, rateToPercent: 9.2 },
  { incomeFrom: 110_000, incomeTo: 120_000, rateFromPercent: 9.2, rateToPercent: 9.3 },
  { incomeFrom: 120_000, incomeTo: 130_000, rateFromPercent: 9.3, rateToPercent: 9.4 },
  { incomeFrom: 130_000, incomeTo: 140_000, rateFromPercent: 9.4, rateToPercent: 9.5 },
  { incomeFrom: 140_000, incomeTo: 150_000, rateFromPercent: 9.5, rateToPercent: 9.6 },
  { incomeFrom: 150_000, incomeTo: 160_000, rateFromPercent: 9.6, rateToPercent: 9.7 },
  { incomeFrom: 160_000, incomeTo: 170_000, rateFromPercent: 9.7, rateToPercent: 9.8 },
  { incomeFrom: 170_000, incomeTo: 180_000, rateFromPercent: 9.8, rateToPercent: 9.9 },
  { incomeFrom: 180_000, incomeTo: 190_000, rateFromPercent: 9.9, rateToPercent: 9.95 },
  { incomeFrom: 190_000, incomeTo: 200_000, rateFromPercent: 9.95, rateToPercent: 10.0 },
];
const VS_COMMUNAL_TOP_RATE_PERCENT = 10.0;

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

// Barème officiel unique schwytzois (§36 al. 1 StG, montants indexés 2026),
// utilisé pour Bezirke/Gemeinden/Kirchgemeinden (§3 al. 2 StG). SZ n'a pas de
// barème marié séparé : le splitting à diviseur 1.9 (§36 al. 2 StG, couples
// mariés UNIQUEMENT — pas les familles monoparentales) et l'abattement
// personnel (§35 al. 1 StG, non intégré au barème contrairement à JU/BE) sont
// gérés par le cas spécial "SZ" dans computeCantonalCommunal. Le dernier
// palier ("au-delà de 258'800, l'impôt simple est de 3.65% du revenu entier")
// est mathématiquement équivalent à une continuation marginale à 3.65% (pas
// de rupture), vérifié par recoupement avec le montant cumulé publié.
// Source primaire : Feuille cantonale Schwyz, AFC, état février 2026.
const SZ_BASE_CLASSES: BracketStep[] = [
  { from: 0, base: 0, rate: 0.25 },
  { from: 1_500, base: 3.75, rate: 0.50 },
  { from: 2_800, base: 10.25, rate: 0.75 },
  { from: 3_900, base: 18.5, rate: 1.00 },
  { from: 4_900, base: 28.5, rate: 1.25 },
  { from: 5_900, base: 41, rate: 1.50 },
  { from: 7_000, base: 57.5, rate: 1.75 },
  { from: 8_300, base: 80.25, rate: 2.00 },
  { from: 10_100, base: 116.25, rate: 2.25 },
  { from: 12_500, base: 170.25, rate: 2.50 },
  { from: 16_100, base: 260.25, rate: 2.75 },
  { from: 22_000, base: 422.5, rate: 3.00 },
  { from: 30_200, base: 668.5, rate: 3.25 },
  { from: 40_700, base: 1_009.75, rate: 3.50 },
  { from: 52_300, base: 1_415.75, rate: 3.65 },
  { from: 61_600, base: 1_755.20, rate: 3.90 },
  { from: 258_800, base: 9_446.00, rate: 3.65 },
];

// §36a StG : "§36 s'applique aussi à l'impôt cantonal, avec un palier
// supplémentaire de 7% pour les 174'700 CHF suivants" — barème identique à
// SZ_BASE_CLASSES jusqu'à 258'800 CHF, puis remplace la continuation à 3.65%
// par 7% (jusqu'à 433'500), puis 5% au-delà (continuation exacte, vérifiée).
// Réservé à la Kantonssteuer, PAS aux Bezirke/Gemeinden/Kirchgemeinden — voir
// cas spécial "SZ" dans computeCantonalCommunal.
const SZ_KANTON_CLASSES: BracketStep[] = [
  ...SZ_BASE_CLASSES.slice(0, -1),
  { from: 258_800, base: 9_446.00, rate: 7.00 },
  { from: 433_500, base: 21_675.00, rate: 5.00 },
];

// §48 al. 1 StG : taux unique 0.6‰ (rate converti en ÷10 pour ce fichier,
// applySimpleScale divise par 100 pas 1000), pas de progressivité.
const SZ_WEALTH_SCALE: BracketStep[] = [{ from: 0, base: 0, rate: 0.06 }];

// Barème officiel zougois "Grundtarif" (célibataires, § 35 al. 1 StG,
// montants indexés 2025). Contrairement à JU/BE, le barème taxe dès le
// premier franc — l'abattement personnel (§33 al. 1 ch. 1 StG) est un vrai
// abattement avant barème, géré par le cas spécial "ZG" dans
// computeCantonalCommunal. Dernier palier (Bst. o, "au-delà de 149'900 CHF,
// l'impôt simple est de 8% du revenu ENTIER") : contrairement à SZ, ceci
// N'EST PAS équivalent à une continuation marginale (vérifié par recoupement
// avec les valeurs indexées ET non-indexées : écart constant ~1'666 CHF) —
// c'est une véritable clause de taux plat voulue par le législateur zougois.
// Modélisée ici en donnant à ce dernier palier un "base" fictif
// (seuil × taux), ce qui reproduit exactement impôt = revenu × 8% pour tout
// revenu au-delà du seuil, sans rupture de continuité à d'autres seuils.
// Source primaire : Feuille cantonale Zoug, AFC, état février 2026.
const ZG_SINGLE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.5 },
  { from: 1_100, base: 5.5, rate: 1.0 },
  { from: 3_300, base: 27.5, rate: 2.0 },
  { from: 6_100, base: 83.5, rate: 3.0 },
  { from: 10_100, base: 203.5, rate: 3.25 },
  { from: 15_300, base: 372.5, rate: 3.5 },
  { from: 21_100, base: 575.5, rate: 4.0 },
  { from: 26_900, base: 807.5, rate: 4.5 },
  { from: 34_900, base: 1_167.5, rate: 5.5 },
  { from: 46_400, base: 1_800, rate: 5.5 },
  { from: 59_700, base: 2_531.5, rate: 6.5 },
  { from: 74_700, base: 3_506.5, rate: 8.0 },
  { from: 94_800, base: 5_114.5, rate: 10.0 },
  { from: 120_100, base: 7_644.5, rate: 9.0 },
  { from: 149_900, base: 11_992, rate: 8.0 },
];

// "Mehrpersonentarif" (couples mariés ET familles monoparentales, § 35 al. 2
// StG) : chaque seuil et chaque montant cumulé est exactement le double du
// Grundtarif (splitting à diviseur 2 publié directement comme barème séparé
// plutôt que calculé), taux identiques. Vérifié terme à terme sur les 15
// paliers. Source : idem ci-dessus.
const ZG_MARRIED: BracketStep[] = [
  { from: 0, base: 0, rate: 0.5 },
  { from: 2_200, base: 11, rate: 1.0 },
  { from: 6_600, base: 55, rate: 2.0 },
  { from: 12_200, base: 167, rate: 3.0 },
  { from: 20_200, base: 407, rate: 3.25 },
  { from: 30_600, base: 745, rate: 3.5 },
  { from: 42_200, base: 1_151, rate: 4.0 },
  { from: 53_800, base: 1_615, rate: 4.5 },
  { from: 69_800, base: 2_335, rate: 5.5 },
  { from: 92_800, base: 3_600, rate: 5.5 },
  { from: 119_400, base: 5_063, rate: 6.5 },
  { from: 149_400, base: 7_013, rate: 8.0 },
  { from: 189_600, base: 10_229, rate: 10.0 },
  { from: 240_200, base: 15_289, rate: 9.0 },
  { from: 299_800, base: 23_984, rate: 8.0 },
];

// Barème officiel de l'impôt sur la fortune zougois (§44 al. 2 StG, montants
// indexés 2025) — purement marginal/additif, pas de clause de taux plat (le
// dernier palier utilise "pour les parts de fortune au-delà de X", pas "pour
// la fortune entière").
const ZG_WEALTH_SCALE: BracketStep[] = [
  { from: 0, base: 0, rate: 0.0425 },
  { from: 254_000, base: 107.95, rate: 0.085 },
  { from: 508_000, base: 323.85, rate: 0.1275 },
  { from: 762_000, base: 647.7, rate: 0.17 },
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
    // Barème à taux moyen (Art. 32 LF) — single/married ci-dessous ne sont
    // pas utilisés par le moteur (cas spécial "VS" dans
    // computeCantonalCommunal), pas de calibrationFactor : le vrai barème
    // remplace l'ancienne approximation générique.
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
    // Barème officiel unique (Art. 41 al. 1 LIPP + Art. 17 RCEPF) — pas de
    // calibrationFactor : le vrai barème remplace l'ancienne approximation
    // (l'ancien barème plafonnait à 19% dès 261'191 CHF, très éloigné du
    // vrai plafond de 18% dès 651'131 CHF). Le splitting marié/monoparental
    // (diviseur 2.0 exact) est géré par le cas spécial "GE" dans
    // computeCantonalCommunal, plus besoin de splittingMode.
    single: GE_SINGLE,
    married: GE_SINGLE,
    // Quotité cantonale "brute" (48,5% = 47,5% + 1% aide/soins à domicile,
    // Art. 2 LCACant), correcte telle quelle pour la fortune. Pour le
    // revenu, la réduction de 12% (Art. 1 LDIRPP) est appliquée séparément
    // dans computeCantonalCommunal (cantonal uniquement, pas le communal).
    // Coefficient communal chef-lieu confirmé par l'AFC ("Taux et
    // coefficients d'impôts", état 01/2026).
    cantonalMultiplier: 0.485,
    communalMultiplierCapital: 0.455,
    // Contribution religieuse volontaire (CRV, Art. 5 LLE) : GE n'a pas
    // d'impôt ecclésiastique obligatoire, mais un système opt-in par
    // organisation religieuse enrôlée. Les 3 organisations enrôlées en 2024
    // appliquent toutes 16% de l'impôt cantonal de base sur le revenu
    // (+ 6% sur la fortune, non modélisé ici, et CHF 10 forfaitaires).
    churchRateCatholic: 0.16,
    churchRateProtestant: 0.16,
    childDeduction: 13_000,
    marriedDeduction: 0,
    wealthScale: GE_WEALTH_SCALE,
    // Déductions sociales fortune Art. 58 al. 1 LIPP + Art. 16 RCEPF,
    // valeurs indexées 2026.
    wealthExemptionSingle: 87_872,
    wealthExemptionMarried: 175_743,
    capital: "Genève",
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
    // Barèmes officiels distincts Grundtarif/Mehrpersonentarif (§35 al. 1
    // et 2 StG, montants indexés 2025) — pas de calibrationFactor : les
    // vrais barèmes remplacent l'ancienne approximation générique.
    // L'abattement personnel (12'000 / 24'000 CHF) est appliqué dans le cas
    // spécial "ZG" de computeCantonalCommunal, pas via marriedDeduction.
    single: ZG_SINGLE,
    married: ZG_MARRIED,
    // Quotité cantonale légale (82%, §2 al. 2 StG) — confirmée directement
    // par la Feuille cantonale AFC elle-même (correspond à l'ancienne
    // valeur du code, gardée). Coefficient communal chef-lieu Zoug,
    // confirmé par l'AFC ("Taux et coefficients d'impôts", état 01/2026).
    cantonalMultiplier: 0.82,
    communalMultiplierCapital: 0.5211,
    childDeduction: 12_000,
    marriedDeduction: 0,
    wealthScale: ZG_WEALTH_SCALE,
    // Montants francs (§44 al. 1 StG, indexés 2025) ; le supplément de
    // 102'000 CHF par enfant (ch. 3) n'est pas modélisé, comme pour les
    // autres cantons de ce fichier.
    wealthExemptionSingle: 204_000,
    wealthExemptionMarried: 408_000,
    capital: "Zoug",
  },
  SZ: {
    // Barème unique (§36 al. 1 StG, montants indexés 2026) — pas de barème
    // marié séparé : le splitting à diviseur 1.9 (§36 al. 2 StG, couples
    // mariés uniquement) et l'abattement personnel (§35 al. 1 StG) sont
    // gérés par le cas spécial "SZ" dans computeCantonalCommunal. `married`
    // n'est jamais lu par le moteur pour ce canton, rempli pour satisfaire
    // le typage. Pas de calibrationFactor : le vrai barème remplace
    // l'ancienne approximation générique.
    single: SZ_BASE_CLASSES,
    married: SZ_BASE_CLASSES,
    // La loi SZ n'applique pas un simple pourcentage du même barème pour le
    // canton et les communes : §36a ajoute un palier de 7%/5% réservé à la
    // Kantonssteuer (SZ_KANTON_CLASSES), tandis que Bezirke/Gemeinden/
    // Kirchgemeinden utilisent le barème de base seul (SZ_BASE_CLASSES) —
    // voir cas spécial "SZ". Les valeurs ci-dessous sont les quotités %
    // (Steuerfuss) appliquées à chacun de ces deux barèmes déjà distincts.
    cantonalMultiplier: 1.15,
    communalMultiplierCapital: 1.75,
    childDeduction: 10_000,
    marriedDeduction: 0,
    wealthScale: SZ_WEALTH_SCALE,
    // Déduction sociale fortune §47 al. 1 StG (montants déjà définitifs,
    // pas indexés séparément dans la Feuille cantonale) ; le supplément de
    // 30'000 CHF par enfant (let. c) n'est pas modélisé, comme pour les
    // autres cantons de ce fichier.
    wealthExemptionSingle: 125_000,
    wealthExemptionMarried: 250_000,
    capital: "Schwyz",
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
  let simpleMarginalRatePercentOverride: number | null = null;
  let szAdjustedForCommunal = 0;

  if (opts.canton === "FR") {
    // FR (Art. 37 al. 1 et 3 LICD) : barème à taux moyen, pas marginal —
    // le taux trouvé s'applique à la TOTALITÉ du revenu ajusté. Pour les
    // couples mariés/familles monoparentales, le taux est celui trouvé à
    // 50% du revenu, mais appliqué au revenu entier (pas de "splitting"
    // au sens des autres cantons).
    const rateBasisIncome = isMarried || isSingleParent ? adjusted / 2 : adjusted;
    const ratePercent = averageRatePercent(rateBasisIncome, FR_INCOME_CLASSES, FR_TOP_RATE_PERCENT);
    simple = (adjusted * ratePercent) / 100;
    bracketScale = scale.single;
    marginalReference = adjusted;
    simpleMarginalRatePercentOverride = marginalRatePercentFromClasses(
      rateBasisIncome,
      FR_INCOME_CLASSES,
      FR_TOP_RATE_PERCENT,
    );
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
  } else if (opts.canton === "GE") {
    // GE (Art. 41 al. 2 et 3 LIPP) : pas de barème marié séparé — "le taux
    // appliqué à leur revenu est celui qui correspond à 50% de ce dernier",
    // mathématiquement équivalent à 2×impôt(revenu/2). Diviseur exact 2.0
    // (et non 1.9/1.85 comme l'ancien splitting générique) ; l'alinéa 3
    // rend cette même règle applicable aux familles monoparentales.
    bracketScale = scale.single;
    if (isMarried || isSingleParent) {
      simple = 2 * applySimpleScale(adjusted / 2, bracketScale);
      marginalReference = adjusted / 2;
    } else {
      simple = applySimpleScale(adjusted, bracketScale);
      marginalReference = adjusted;
    }
  } else if (opts.canton === "VS") {
    // Valais (Art. 32 LF) : barème cantonal à taux moyen (comme FR), pas
    // marginal — pas de barème marié séparé, l'impôt de base unique est
    // réduit de 35% pour les couples mariés/familles monoparentales
    // (Art. 32 al. 3 let. a LF), plafonné entre 600 et 4'500 CHF (montants
    // légaux de base, non indexés 2026).
    const ratePercent = averageRatePercent(adjusted, VS_CANTONAL_CLASSES, VS_CANTONAL_TOP_RATE_PERCENT);
    const base = (adjusted * ratePercent) / 100;
    bracketScale = scale.single;
    marginalReference = adjusted;
    simpleMarginalRatePercentOverride = marginalRatePercentFromClasses(
      adjusted,
      VS_CANTONAL_CLASSES,
      VS_CANTONAL_TOP_RATE_PERCENT,
    );
    if (isMarried || isSingleParent) {
      const reduction = Math.min(4_500, Math.max(600, base * 0.35));
      simple = Math.max(0, base - reduction);
      vsMarriedReduction = reduction;
    } else {
      simple = base;
    }
  } else if (opts.canton === "SZ") {
    // SZ (§35 al. 1 StG) : abattement personnel avant barème — 4'200 CHF
    // célibataires (let. b), 8'400 CHF couples mariés en ménage commun
    // (let. a), 4'200 + 7'800 = 12'000 CHF familles monoparentales (let. b
    // + let. e). Le splitting à diviseur 1.9 (§36 al. 2 StG) ne s'applique
    // QU'aux couples mariés — pas aux familles monoparentales, qui restent
    // sur le barème simple. Barème Kantonssteuer (§36a, palier
    // supplémentaire à 7%/5%) distinct du barème Bezirke/Gemeinden/
    // Kirchgemeinden (§36 seul, SZ_BASE_CLASSES) — voir cas spécial "SZ"
    // dans le calcul du communal plus bas. Non modélisé : l'Entlastungsabzug
    // (§35 al. 1a StG, jusqu'à 30% du revenu net) qui dépend de la fortune
    // nette, non disponible ici (uniquement dans computeWealthTax) —
    // omission qui surestime l'impôt pour les profils revenu faible/moyen.
    const personalDeduction = isMarried ? 8_400 : isSingleParent ? 12_000 : 4_200;
    szAdjustedForCommunal = Math.max(0, adjusted - personalDeduction);
    bracketScale = SZ_KANTON_CLASSES;
    if (isMarried) {
      simple = applySimpleScale(szAdjustedForCommunal / 1.9, bracketScale) * 1.9;
      marginalReference = szAdjustedForCommunal / 1.9;
    } else {
      simple = applySimpleScale(szAdjustedForCommunal, bracketScale);
      marginalReference = szAdjustedForCommunal;
    }
  } else if (opts.canton === "ZG") {
    // ZG (§33 al. 1 ch. 1 StG) : abattement personnel avant barème (le
    // barème lui-même taxe dès le premier franc, contrairement à JU/BE qui
    // l'intègrent comme palier à taux 0) — 12'000 CHF célibataires (let. b),
    // 24'000 CHF couples mariés ET familles monoparentales (let. a, même
    // seuil, même Mehrpersonentarif — §35 al. 2 StG).
    const personalDeduction = isMarried || isSingleParent ? 24_000 : 12_000;
    const zgAdjusted = Math.max(0, adjusted - personalDeduction);
    bracketScale = isMarried || isSingleParent ? scale.married : scale.single;
    simple = applySimpleScale(zgAdjusted, bracketScale);
    marginalReference = zgAdjusted;
  } else if ((isMarried || isSingleParent) && splittingMode === "split_0.52") {
    // NE : splitting à 52% — taux basé sur 52% du revenu, appliqué au revenu entier
    bracketScale = scale.single;
    simple = applySimpleScale(adjusted * 0.52, bracketScale) / 0.52;
    marginalReference = adjusted * 0.52;
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
  if (opts.canton === "GE") {
    // Art. 1 LDIRPP : "l'impôt direct sur le revenu des personnes
    // physiques, à l'exception des centimes additionnels communaux, est
    // diminué de 12%" — ne touche donc que le cantonal (pas le communal,
    // explicitement exclu par le texte ; pas la fortune, la LDIRPP ne
    // vise que le revenu).
    cantonal = cantonal * 0.88;
  }
  let communal: number;
  let vsCommunalMarriedReduction = 0;
  if (opts.canton === "VS") {
    // Valais : le communal (Art. 178, "impôt personnel") n'est PAS un
    // pourcentage du cantonal, c'est un second barème progressif
    // indépendant à taux moyen (comme le cantonal), avec sa propre
    // réduction -35% pour les couples mariés, multiplié ensuite par le
    // coefficient de la commune (1.0 à 1.5, chef-lieu Sion pris par défaut
    // via communalMultiplierCapital).
    const communalRatePercent = averageRatePercent(adjusted, VS_COMMUNAL_CLASSES, VS_COMMUNAL_TOP_RATE_PERCENT);
    let communalBase = (adjusted * communalRatePercent) / 100;
    if (isMarried || isSingleParent) {
      const communalReduction = Math.min(4_500, Math.max(600, communalBase * 0.35));
      communalBase = Math.max(0, communalBase - communalReduction);
      vsCommunalMarriedReduction = communalReduction * calibration * communalMult;
    }
    communal = communalBase * calibration * communalMult;
  } else if (opts.canton === "SZ") {
    // Bezirke/Gemeinden/Kirchgemeinden utilisent le barème de base seul
    // (§36 StG, SZ_BASE_CLASSES), sans le palier supplémentaire de §36a
    // réservé à la Kantonssteuer — voir cas spécial "SZ" plus haut.
    const communalSimple = isMarried
      ? applySimpleScale(szAdjustedForCommunal / 1.9, SZ_BASE_CLASSES) * 1.9
      : applySimpleScale(szAdjustedForCommunal, SZ_BASE_CLASSES);
    communal = communalSimple * communalMult;
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
  const simpleMarginalRatePercent = simpleMarginalRatePercentOverride ?? marginalBracket.rate;
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

  if (opts.canton === "GE") {
    // GE (Art. 59 al. 2 LIPP) : impôt cantonal COMPLÉMENTAIRE sur la
    // fortune, en plus du barème principal ci-dessus — "il n'est perçu
    // aucun centime additionnel [communal] sur cet impôt supplémentaire".
    const supplementary = applySimpleScale(taxable, GE_WEALTH_SUPPLEMENTARY_SCALE);
    return Math.round((simple * (cantonalMult + communalMult) + supplementary * cantonalMult) * 100) / 100;
  }

  return Math.round(simple * (cantonalMult + communalMult) * 100) / 100;
}

export { CANTON_SCALES as default };