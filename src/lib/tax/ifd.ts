// Impôt fédéral direct (IFD) · Barèmes 2026
// Source: Administration fédérale des contributions (AFC)
// Barème post-numerando, base annuelle CHF
// https://www.estv.admin.ch

export type FilingStatus = "single" | "married" | "single_with_children";

export interface BracketStep {
  /** Borne inférieure du revenu imposable (CHF) */
  from: number;
  /** Impôt fixe à payer dès `from` */
  base: number;
  /** Taux marginal au-delà de `from` (en %) */
  rate: number;
  /** Pas (palier) en CHF · si défini, l'impôt grimpe par incréments */
  step?: number;
  /** Montant ajouté par `step` franchi */
  perStep?: number;
}

/**
 * Barème IFD personne seule (art. 36 al. 1 LIFD), valable 2026.
 * Compensation de la progression à froid appliquée.
 */
export const IFD_SINGLE_2026: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 15_200, base: 0, rate: 0.77 },
  { from: 33_200, base: 138.65, rate: 0.88 },
  { from: 43_500, base: 229.05, rate: 2.64 },
  { from: 58_000, base: 612.85, rate: 2.97 },
  { from: 76_100, base: 1_151.05, rate: 5.94 },
  { from: 81_900, base: 1_495.55, rate: 6.6 },
  { from: 108_800, base: 3_271.95, rate: 8.8 },
  { from: 141_500, base: 6_149.55, rate: 11.0 },
  { from: 184_900, base: 10_923.55, rate: 13.2 },
  { from: 793_300, base: 91_232.65, rate: 11.5 },
];

/**
 * Barème IFD personne mariée / famille monoparentale (art. 36 al. 2 LIFD), 2026.
 */
export const IFD_MARRIED_2026: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 29_500, base: 0, rate: 1.0 },
  { from: 52_900, base: 234.0, rate: 2.0 },
  { from: 60_700, base: 390.0, rate: 3.0 },
  { from: 78_100, base: 912.0, rate: 4.0 },
  { from: 93_600, base: 1_532.0, rate: 5.0 },
  { from: 107_500, base: 2_227.0, rate: 6.0 },
  { from: 119_700, base: 2_959.0, rate: 7.0 },
  { from: 130_300, base: 3_701.0, rate: 8.0 },
  { from: 139_200, base: 4_413.0, rate: 9.0 },
  { from: 146_400, base: 5_061.0, rate: 10.0 },
  { from: 152_000, base: 5_621.0, rate: 11.0 },
  { from: 155_900, base: 6_050.0, rate: 12.0 },
  { from: 158_200, base: 6_326.0, rate: 13.0 },
  { from: 942_700, base: 108_311.0, rate: 11.5 },
];

/** Déduction sociale pour enfant · IFD 2026 */
export const IFD_CHILD_DEDUCTION_2026 = 6_700;

/**
 * Calcul de l'IFD à partir d'un revenu imposable.
 * Renvoie 0 pour les revenus négatifs ou inférieurs à la franchise.
 */
export function computeIFD(taxableIncome: number, status: FilingStatus): number {
  if (taxableIncome <= 0) return 0;
  const scale = status === "single" ? IFD_SINGLE_2026 : IFD_MARRIED_2026;

  // Trouver la tranche applicable
  let bracket = scale[0];
  for (const b of scale) {
    if (taxableIncome >= b.from) bracket = b;
    else break;
  }
  const excess = taxableIncome - bracket.from;
  const tax = bracket.base + (excess * bracket.rate) / 100;
  // L'IFD final est arrondi à 0.05 CHF près à la baisse
  return Math.floor(tax * 20) / 20;
}

/** Taux marginal IFD (en %) au revenu imposable donné */
export function ifdMarginalRate(taxableIncome: number, status: FilingStatus): number {
  if (taxableIncome <= 0) return 0;
  const scale = status === "single" ? IFD_SINGLE_2026 : IFD_MARRIED_2026;
  let bracket = scale[0];
  for (const b of scale) {
    if (taxableIncome >= b.from) bracket = b;
    else break;
  }
  return bracket.rate;
}
