// Module libre passage · stratégies de placement et projection nette
// Sources : OLP (Ordonnance sur le libre passage), pratique OFAS 2026.

import { capitalWithdrawalTax } from "./index";

export type VestedStrategy = "current" | "security" | "balanced" | "dynamic";

/** Taux de la Fondation supplétive LPP (Suppletive) : hypothèse de rendement
 *  pour un capital de libre passage resté sur un compte de libre passage
 *  "par défaut", sans stratégie de placement active. Utilisé comme scénario
 *  "situation actuelle" de référence, distinct des 3 stratégies proposées. */
export const SUPPLETIVE_RATE = 0.03;

export interface VestedStrategyDef {
  id: VestedStrategy;
  label: string;
  description: string;
  /** Allocation actions (0-1) */
  equityAllocation: number;
  /** Rendement annuel net espéré (%) */
  expectedReturn: number;
  /** Volatilité annuelle (écart-type, %), pour fourchettes +/- 1σ */
  volatility: number;
  /** Frais annuels totaux (TER + frais admin) */
  totalFees: number;
}

export const VESTED_STRATEGIES: VestedStrategyDef[] = [
  {
    id: "current",
    label: "Situation actuelle (taux Suppletive)",
    description:
      "Hypothèse : capital resté sur un compte de libre passage par défaut, au taux de la Fondation supplétive LPP (0,03 %/an), sans stratégie de placement active.",
    equityAllocation: 0,
    expectedReturn: SUPPLETIVE_RATE,
    volatility: 0,
    totalFees: 0,
  },
  {
    id: "security",
    label: "Sécurité (0–25 % actions)",
    description:
      "Compte d'épargne libre passage + obligations courtes. Capital garanti, rendement faible.",
    equityAllocation: 0.1,
    expectedReturn: 1.2,
    volatility: 2.0,
    totalFees: 0.45,
  },
  {
    id: "balanced",
    label: "Équilibré (25–50 % actions)",
    description: "Mix actions monde / obligations CHF. Bon compromis risque/rendement.",
    equityAllocation: 0.4,
    expectedReturn: 3.5,
    volatility: 8.0,
    totalFees: 0.85,
  },
  {
    id: "dynamic",
    label: "Dynamique (50–80 % actions)",
    description:
      "Allocation orientée actions monde + immobilier. Performance long terme, volatilité élevée.",
    equityAllocation: 0.7,
    expectedReturn: 5.5,
    volatility: 14.0,
    totalFees: 1.15,
  },
];

export const VESTED_STRATEGY_BY_ID: Record<VestedStrategy, VestedStrategyDef> = Object.fromEntries(
  VESTED_STRATEGIES.map((s) => [s.id, s]),
) as Record<VestedStrategy, VestedStrategyDef>;

export interface VestedProjectionInput {
  initialBalance: number;
  yearsToRetirement: number;
  strategy: VestedStrategy;
  /** Versements annuels supplémentaires (rares en libre passage, default 0) */
  yearlyContribution?: number;
  /** Canton de retrait (impact fiscal sortie) */
  withdrawalCanton?: string;
  /** Barème de l'impôt de sortie (défaut : personne seule). */
  taxStatus?: "single" | "married" | "single_with_children";
}

export interface VestedProjectionResult {
  strategy: VestedStrategyDef;
  yearByYear: Array<{
    year: number;
    balance: number;
    low: number; // -1σ
    high: number; // +1σ
  }>;
  finalBalance: number;
  finalLow: number;
  finalHigh: number;
  totalContributions: number;
  totalGains: number;
  netReturn: number; // rendement net annualisé après frais
  estimatedExitTax?: number; // impôt sur prestation en capital estimé
}

export function projectVestedBenefits(input: VestedProjectionInput): VestedProjectionResult {
  const strat = VESTED_STRATEGY_BY_ID[input.strategy];
  const netReturn = (strat.expectedReturn - strat.totalFees) / 100;
  const sigma = strat.volatility / 100;
  const yearly = input.yearlyContribution ?? 0;

  const series: VestedProjectionResult["yearByYear"] = [];
  let balance = input.initialBalance;
  let low = input.initialBalance;
  let high = input.initialBalance;

  for (let y = 0; y <= input.yearsToRetirement; y++) {
    if (y > 0) {
      balance = balance * (1 + netReturn) + yearly;
      // Fourchette ±1σ approximée par scénario constant -σ / +σ
      low = low * (1 + Math.max(-0.05, netReturn - sigma)) + yearly;
      high = high * (1 + netReturn + sigma) + yearly;
    }
    series.push({
      year: y,
      balance: Math.round(balance),
      low: Math.round(Math.max(0, low)),
      high: Math.round(high),
    });
  }

  const finalBalance = Math.round(balance);
  const totalContributions = input.initialBalance + yearly * input.yearsToRetirement;
  // Même moteur que « Rente vs capital », le 3e pilier et les prestations
  // consolidées : une formule propre à ce calculateur affichait un impôt de
  // sortie presque deux fois plus élevé pour le même capital.
  const exitTax = input.withdrawalCanton
    ? capitalWithdrawalTax({
        capital: finalBalance,
        canton: input.withdrawalCanton,
        status: input.taxStatus ?? "single",
      }).total
    : undefined;

  return {
    strategy: strat,
    yearByYear: series,
    finalBalance,
    finalLow: Math.round(Math.max(0, low)),
    finalHigh: Math.round(high),
    totalContributions: Math.round(totalContributions),
    totalGains: Math.round(finalBalance - totalContributions),
    netReturn: Math.round(netReturn * 1000) / 10,
    estimatedExitTax: exitTax,
  };
}

/** Compare les 3 stratégies pour un même capital initial */
export function compareVestedStrategies(
  initialBalance: number,
  yearsToRetirement: number,
  withdrawalCanton?: string,
  taxStatus?: VestedProjectionInput["taxStatus"],
): VestedProjectionResult[] {
  return VESTED_STRATEGIES.map((s) =>
    projectVestedBenefits({
      initialBalance,
      yearsToRetirement,
      strategy: s.id,
      withdrawalCanton,
      taxStatus,
    }),
  );
}

/** Recommandation stratégie selon âge / horizon */
export function recommendVestedStrategy(yearsToRetirement: number): VestedStrategy {
  if (yearsToRetirement < 5) return "security";
  if (yearsToRetirement < 12) return "balanced";
  return "dynamic";
}
