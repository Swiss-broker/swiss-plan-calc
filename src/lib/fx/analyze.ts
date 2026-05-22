// Moteur d'analyse, réclamation fiscale liée au taux de change.
//
// Principe : l'AFC applique un taux moyen annuel uniforme à tous les revenus
// libellés en devises. Or les versements réels (salaire mensuel frontalier,
// pension, dividendes) sont effectués à des dates précises où le taux BNS/ECB
// du jour peut être plus favorable au contribuable. La différence représente
// une surévaluation potentielle du revenu imposable.

import type { Currency } from "./sources";

export interface FxTransaction {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Montant brut en devise d'origine */
  amount: number;
  currency: Currency;
  /** Taux réel BNS/ECB à la date (1 devise = X CHF) */
  marketRate: number;
  /** Libellé (ex. "Salaire mai 2024") */
  label?: string;
}

export interface FxClaimInput {
  taxYear: number;
  /** Taux AFC annuel retenu par l'administration (1 devise = X CHF) */
  afcRate: number;
  currency: Currency;
  transactions: FxTransaction[];
  /** Taux marginal d'imposition du contribuable (%) */
  marginalRate: number;
}

export interface FxClaimLineResult extends FxTransaction {
  chfAfc: number;
  chfMarket: number;
  deltaChf: number;
}

export interface FxClaimResult {
  lines: FxClaimLineResult[];
  totalForeign: number;
  totalChfAfc: number;
  totalChfMarket: number;
  /** Différence brute (positif = AFC surévalue le revenu) */
  totalDeltaChf: number;
  /** Économie d'impôt potentielle (delta × taux marginal) */
  estimatedTaxRefund: number;
  /** Taux effectif moyen pondéré du marché */
  weightedMarketRate: number;
  /** Écart relatif AFC vs marché pondéré (%) */
  deltaRelativePct: number;
}

export function analyzeFxClaim(input: FxClaimInput): FxClaimResult {
  const lines: FxClaimLineResult[] = input.transactions.map((t) => {
    const chfAfc = t.amount * input.afcRate;
    const chfMarket = t.amount * t.marketRate;
    return {
      ...t,
      chfAfc: round2(chfAfc),
      chfMarket: round2(chfMarket),
      deltaChf: round2(chfAfc - chfMarket),
    };
  });

  const totalForeign = sum(lines.map((l) => l.amount));
  const totalChfAfc = sum(lines.map((l) => l.chfAfc));
  const totalChfMarket = sum(lines.map((l) => l.chfMarket));
  const totalDeltaChf = round2(totalChfAfc - totalChfMarket);
  const weightedMarketRate = totalForeign > 0 ? totalChfMarket / totalForeign : 0;
  const deltaRelativePct =
    weightedMarketRate > 0
      ? ((input.afcRate - weightedMarketRate) / weightedMarketRate) * 100
      : 0;

  const estimatedTaxRefund = Math.max(
    0,
    Math.round((totalDeltaChf * (input.marginalRate / 100)) * 100) / 100,
  );

  return {
    lines,
    totalForeign: round2(totalForeign),
    totalChfAfc: round2(totalChfAfc),
    totalChfMarket: round2(totalChfMarket),
    totalDeltaChf,
    estimatedTaxRefund,
    weightedMarketRate: round4(weightedMarketRate),
    deltaRelativePct: round2(deltaRelativePct),
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
