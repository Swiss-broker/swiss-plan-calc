// supabase/functions/_shared/commission.ts
// Unique source de vérité pour le calcul de la commission SwissBroker Pro
// sur une facturation RDV, par tranches marginales (comme l'impôt : chaque
// taux ne s'applique qu'à la part du montant comprise dans sa tranche).
// Importé tel quel par les Edge Functions (Deno) ET par le front
// (src/lib/billing/commission.ts est un simple ré-export de ce fichier,
// jamais une copie) : les deux côtés voient toujours exactement le même
// calcul, sans constantes dupliquées à la main.
//
// Tout est en centimes, en entiers : jamais de flottants pour un montant
// d'argent, pour éviter les erreurs d'arrondi qui s'accumulent.

/** Montant minimum facturable pour un RDV, en centimes (150 CHF). */
export const RDV_MIN_CENTIMES = 15_000;

export interface CommissionBracket {
  /** Borne basse de la tranche, incluse, en centimes. */
  fromCentimes: number;
  /** Borne haute de la tranche, exclue, en centimes. null = pas de plafond. */
  toCentimes: number | null;
  /** Taux de commission appliqué à la part du montant dans cette tranche. */
  rate: number;
}

export const COMMISSION_BRACKETS: readonly CommissionBracket[] = [
  { fromCentimes: 0, toCentimes: 100_000, rate: 0.3 }, // 0 → 1'000 CHF : 30%
  { fromCentimes: 100_000, toCentimes: 200_000, rate: 0.2 }, // 1'000 → 2'000 CHF : 20%
  { fromCentimes: 200_000, toCentimes: null, rate: 0.1 }, // au-delà de 2'000 CHF : 10%
];

function assertValidAmount(amountCentimes: number): void {
  if (!Number.isInteger(amountCentimes) || amountCentimes < 0) {
    throw new Error("amountCentimes doit être un entier positif ou nul, en centimes.");
  }
}

/** Part exacte (non arrondie) du montant qui tombe dans chaque tranche, multipliée par son taux. */
function exactBracketAmounts(amountCentimes: number): number[] {
  return COMMISSION_BRACKETS.map((bracket) => {
    const upper = bracket.toCentimes ?? Infinity;
    const portionCentimes = Math.max(0, Math.min(amountCentimes, upper) - bracket.fromCentimes);
    return portionCentimes * bracket.rate;
  });
}

/**
 * Commission totale en centimes. Somme les montants exacts (non arrondis)
 * de chaque tranche puis arrondit une seule fois à la fin — un arrondi par
 * tranche donnerait parfois un total différent de quelques centimes.
 */
export function computeCommissionCentimes(amountCentimes: number): number {
  assertValidAmount(amountCentimes);
  const total = exactBracketAmounts(amountCentimes).reduce((sum, v) => sum + v, 0);
  return Math.round(total);
}

export function computeBrokerNetCentimes(amountCentimes: number): number {
  assertValidAmount(amountCentimes);
  return amountCentimes - computeCommissionCentimes(amountCentimes);
}

export interface CommissionBracketDetail {
  fromCentimes: number;
  toCentimes: number | null;
  rate: number;
  /** Part du montant qui tombe dans cette tranche, en centimes. */
  portionCentimes: number;
  /** Commission prélevée sur cette tranche, en centimes (arrondie). */
  commissionCentimes: number;
}

/**
 * Détail par tranche, pour l'affichage (aperçu avant facturation, email).
 * La dernière tranche avec une part non nulle absorbe l'écart d'arrondi,
 * pour que la somme des tranches affichées égale toujours exactement
 * computeCommissionCentimes(amountCentimes), jamais à un centime près.
 */
export function computeCommissionBreakdown(amountCentimes: number): CommissionBracketDetail[] {
  assertValidAmount(amountCentimes);
  const exactAmounts = exactBracketAmounts(amountCentimes);
  const total = computeCommissionCentimes(amountCentimes);

  const lastNonZeroIndex = exactAmounts.reduce((lastIdx, v, idx) => (v > 0 ? idx : lastIdx), 0);

  let runningRounded = 0;
  return COMMISSION_BRACKETS.map((bracket, idx) => {
    const upper = bracket.toCentimes ?? Infinity;
    const portionCentimes = Math.max(0, Math.min(amountCentimes, upper) - bracket.fromCentimes);
    const commissionCentimes =
      idx === lastNonZeroIndex ? total - runningRounded : Math.round(exactAmounts[idx]);
    runningRounded += commissionCentimes;
    return {
      fromCentimes: bracket.fromCentimes,
      toCentimes: bracket.toCentimes,
      rate: bracket.rate,
      portionCentimes,
      commissionCentimes,
    };
  });
}
