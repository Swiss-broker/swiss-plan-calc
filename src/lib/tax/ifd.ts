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
 * Source : AFC, formulaire 58c-2026 (« Tableau servant à calculer l'impôt
 * fédéral direct des personnes physiques », état 01.2026). Chaque palier
 * reprend le revenu et l'impôt imprimés dans le tableau au point où le taux
 * change.
 */
export const IFD_SINGLE_2026: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 15_200, base: 0, rate: 0.77 },
  { from: 33_200, base: 138.6, rate: 0.88 },
  { from: 43_500, base: 229.2, rate: 2.64 },
  { from: 58_000, base: 612.0, rate: 2.97 },
  { from: 76_200, base: 1_152.5, rate: 5.94 },
  { from: 82_100, base: 1_502.95, rate: 6.6 },
  { from: 108_900, base: 3_271.75, rate: 8.8 },
  { from: 141_500, base: 6_140.55, rate: 11.0 },
  { from: 185_100, base: 10_936.55, rate: 13.2 },
  { from: 793_900, base: 91_298.5, rate: 11.5 },
];

/**
 * Barème IFD personne mariée / famille monoparentale (art. 36 al. 2 LIFD), 2026.
 * Vérifié ligne à ligne contre le formulaire AFC 58c-2026.
 */
export const IFD_MARRIED_2026: BracketStep[] = [
  { from: 0, base: 0, rate: 0 },
  { from: 29_700, base: 0, rate: 1.0 },
  { from: 53_400, base: 237.0, rate: 2.0 },
  { from: 61_300, base: 395.0, rate: 3.0 },
  { from: 79_100, base: 929.0, rate: 4.0 },
  { from: 94_900, base: 1_561.0, rate: 5.0 },
  { from: 108_700, base: 2_251.0, rate: 6.0 },
  { from: 120_600, base: 2_965.0, rate: 7.0 },
  { from: 130_500, base: 3_658.0, rate: 8.0 },
  { from: 138_400, base: 4_290.0, rate: 9.0 },
  { from: 144_300, base: 4_821.0, rate: 10.0 },
  { from: 148_300, base: 5_221.0, rate: 11.0 },
  { from: 150_400, base: 5_452.0, rate: 12.0 },
  { from: 152_400, base: 5_692.0, rate: 13.0 },
  { from: 941_300, base: 108_249.0, rate: 11.5 },
];

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
