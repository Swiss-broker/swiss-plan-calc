// Module libre passage · stratégies de placement et projection nette
// Sources : OLP (Ordonnance sur le libre passage), pratique OFAS 2026.

export type VestedStrategy = "security" | "balanced" | "dynamic";

export interface VestedStrategyDef {
  id: VestedStrategy;
  label: string;
  description: string;
  /** Allocation actions (0-1) */
  equityAllocation: number;
  /** Rendement annuel net espéré (%) */
  expectedReturn: number;
  /** Volatilité annuelle (écart-type, %) — pour fourchettes +/- 1σ */
  volatility: number;
  /** Frais annuels totaux (TER + frais admin) */
  totalFees: number;
}

export const VESTED_STRATEGIES: VestedStrategyDef[] = [
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

function approxCapitalTax(canton: string, capital: number): number {
  // Estimation simplifiée impôt sur prestation en capital LPP/LP (IFD + ICC barème séparé)
  // Calibrée sur les valeurs publiées AFC + administrations cantonales 2026.
  // Coefficient cantonal moyen sur l'impôt sur prestation en capital
  const cantonCoef: Record<string, number> = {
    ZG: 0.045,
    SZ: 0.05,
    OW: 0.052,
    NW: 0.055,
    AI: 0.055,
    AR: 0.062,
    LU: 0.063,
    UR: 0.058,
    GL: 0.07,
    TG: 0.072,
    SH: 0.075,
    SG: 0.075,
    GR: 0.078,
    AG: 0.08,
    SO: 0.082,
    FR: 0.085,
    VS: 0.082,
    BE: 0.088,
    JU: 0.09,
    NE: 0.095,
    BS: 0.095,
    BL: 0.092,
    TI: 0.085,
    VD: 0.098,
    GE: 0.105,
    ZH: 0.082,
  };
  const coef = canton ? (cantonCoef[canton] ?? 0.085) : 0.085;
  // IFD séparé (1/5 du barème normal) ~ progressif jusqu'à 2.3 %
  let ifdRate = 0;
  if (capital <= 30_000) ifdRate = 0.005;
  else if (capital <= 100_000) ifdRate = 0.01;
  else if (capital <= 250_000) ifdRate = 0.014;
  else if (capital <= 500_000) ifdRate = 0.018;
  else if (capital <= 1_000_000) ifdRate = 0.021;
  else ifdRate = 0.023;
  return Math.round(capital * (coef + ifdRate));
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
  const exitTax = input.withdrawalCanton
    ? approxCapitalTax(input.withdrawalCanton, finalBalance)
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
): VestedProjectionResult[] {
  return VESTED_STRATEGIES.map((s) =>
    projectVestedBenefits({
      initialBalance,
      yearsToRetirement,
      strategy: s.id,
      withdrawalCanton,
    }),
  );
}

/** Recommandation stratégie selon âge / horizon */
export function recommendVestedStrategy(yearsToRetirement: number): VestedStrategy {
  if (yearsToRetirement < 5) return "security";
  if (yearsToRetirement < 12) return "balanced";
  return "dynamic";
}
