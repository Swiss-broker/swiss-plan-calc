// Calculateur d'investissement comparatif — fonction pure testable.
// Calcul année par année (capitalisation composée), versements en début d'année,
// frais déduits du rendement brut, impôt appliqué sur le gain à la sortie.

export type ContributionFrequency = "monthly" | "annual" | "none";

export type InvestmentType =
  | "life_insurance"
  | "fund"
  | "etf"
  | "savings"
  | "pillar_3a"
  | "pillar_3b"
  | "other";

export interface InvestmentInput {
  /** Nom libre, ex. "Livret actuel". */
  name: string;
  /** Type pour catégorisation UI. */
  type: InvestmentType;
  /** Capital initial investi (CHF). */
  initialCapital: number;
  /** Montant du versement périodique (CHF). 0 si aucun. */
  periodicContribution: number;
  /** Périodicité du versement. */
  contributionFrequency: ContributionFrequency;
  /** Taux de rendement annuel brut (%). */
  grossReturnRate: number;
  /** Frais annuels (% TER ou gestion). */
  annualFeeRate: number;
  /** Durée en années (entier ≥ 1). */
  durationYears: number;
  /** Taux d'imposition à la sortie (%) appliqué au gain brut. */
  exitTaxRate: number;
  /** Mode d'intérêts : composés (réinvestis) ou simples (sur capital versé uniquement). */
  interestMode?: "compound" | "simple";
}

export interface InvestmentYearPoint {
  year: number;
  /** Capital cumulé brut en fin d'année. */
  grossCapital: number;
  /** Capital cumulé "net" si on liquidait à cette année (frais déjà nets, impôt sur gain). */
  netCapital: number;
  /** Total versé (capital initial + cumul des versements jusqu'à cette année). */
  totalContributed: number;
}

export interface InvestmentResult {
  input: InvestmentInput;
  /** Total versé sur la période complète. */
  totalContributed: number;
  /** Capital final brut (avant impôt). */
  finalGrossCapital: number;
  /** Gain brut cumulé (capital final brut − total versé). */
  grossGain: number;
  /** Impact total des frais sur la période (différence vs. simulation sans frais). */
  feesImpact: number;
  /** Impôt à la sortie (taux × gain brut, plancher 0). */
  exitTax: number;
  /** Capital final net (final brut − impôt). */
  finalNetCapital: number;
  /** Série annuelle (année 0 incluse) pour graphique. */
  series: InvestmentYearPoint[];
}

export interface InvestmentComparison {
  a: InvestmentResult;
  b: InvestmentResult;
  /** Différence en faveur du gagnant (toujours ≥ 0). */
  netDifference: number;
  /** Identifiant du gagnant ("a" | "b" | "tie"). */
  winner: "a" | "b" | "tie";
  /** Gain supplémentaire en pourcentage sur le perdant. */
  pctAdvantage: number;
}

function annualContribution(input: InvestmentInput): number {
  if (input.contributionFrequency === "monthly") return (input.periodicContribution || 0) * 12;
  if (input.contributionFrequency === "annual") return input.periodicContribution || 0;
  return 0;
}

/** Simulation pure — ne modifie pas l'input. */
export function simulateInvestment(input: InvestmentInput): InvestmentResult {
  const years = Math.max(1, Math.floor(input.durationYears || 0));
  const yearlyContrib = annualContribution(input);
  const netRate = (input.grossReturnRate - input.annualFeeRate) / 100;
  const grossRate = input.grossReturnRate / 100;

  const series: InvestmentYearPoint[] = [];
  const mode = input.interestMode ?? "compound";
  let capital = Math.max(0, input.initialCapital || 0);
  let capitalNoFees = capital;
  let contributed = capital;
  // Pour le mode simple : on accumule les intérêts à part, ils ne capitalisent pas.
  let simpleInterest = 0;
  let simpleInterestNoFees = 0;

  series.push({
    year: 0,
    grossCapital: round(capital),
    netCapital: round(capital),
    totalContributed: round(contributed),
  });

  for (let y = 1; y <= years; y++) {
    if (mode === "compound") {
      // Versement en début d'année puis capitalisation.
      capital = (capital + yearlyContrib) * (1 + netRate);
      capitalNoFees = (capitalNoFees + yearlyContrib) * (1 + grossRate);
      contributed += yearlyContrib;
    } else {
      // Intérêts simples : versement ajouté au principal, intérêt calculé sur le principal cumulé seulement.
      contributed += yearlyContrib;
      simpleInterest += contributed * netRate;
      simpleInterestNoFees += contributed * grossRate;
      capital = contributed + simpleInterest;
      capitalNoFees = contributed + simpleInterestNoFees;
    }
    const gainSoFar = Math.max(0, capital - contributed);
    const taxIfExit = gainSoFar * (input.exitTaxRate / 100);
    series.push({
      year: y,
      grossCapital: round(capital),
      netCapital: round(capital - taxIfExit),
      totalContributed: round(contributed),
    });
  }

  const finalGross = capital;
  const totalContributed = contributed;
  const grossGain = Math.max(0, finalGross - totalContributed);
  const exitTax = grossGain * (input.exitTaxRate / 100);
  const finalNet = finalGross - exitTax;
  const feesImpact = Math.max(0, capitalNoFees - finalGross);

  return {
    input,
    totalContributed: round(totalContributed),
    finalGrossCapital: round(finalGross),
    grossGain: round(grossGain),
    feesImpact: round(feesImpact),
    exitTax: round(exitTax),
    finalNetCapital: round(finalNet),
    series,
  };
}

export function compareInvestments(a: InvestmentInput, b: InvestmentInput): InvestmentComparison {
  const ra = simulateInvestment(a);
  const rb = simulateInvestment(b);
  const diff = ra.finalNetCapital - rb.finalNetCapital;
  const winner: "a" | "b" | "tie" =
    Math.abs(diff) < 1 ? "tie" : diff > 0 ? "a" : "b";
  const loserAmount =
    winner === "a" ? rb.finalNetCapital : winner === "b" ? ra.finalNetCapital : 0;
  const pct = loserAmount > 0 ? (Math.abs(diff) / loserAmount) * 100 : 0;
  return { a: ra, b: rb, netDifference: Math.abs(round(diff)), winner, pctAdvantage: round(pct * 10) / 10 };
}

function round(n: number): number {
  return Math.round(n);
}

export const INVESTMENT_TYPES: InvestmentType[] = [
  "life_insurance",
  "fund",
  "etf",
  "savings",
  "pillar_3a",
  "pillar_3b",
  "other",
];
