// Calculateur Budget : établi en tout début de rendez-vous (budget actuel,
// avant toute simulation), puis revisité en fin de rendez-vous (budget
// optimisé, une fois les optimisations identifiées par les autres
// calculateurs du même dossier). Un seul outil, utilisé deux fois.
//
// Le budget optimisé ne recalcule JAMAIS les autres simulations : il lit
// uniquement leurs gains déjà sauvegardés via extractGain (même logique que
// le bloc "Optimisations identifiées" de la fiche client et le PDF de
// synthèse), restreints aux gains de type "annual" — un gain "one_time"
// (ex. remboursement d'impôt suite à un rachat LPP) est un capital ponctuel,
// pas une économie mensuelle récurrente, et n'a donc pas sa place dans un
// budget mensuel.
import type { HistoryEntry } from "@/lib/history/types";
import { aggregateGains } from "@/lib/simulations/extract-gain";

export interface BudgetInput {
  netSalaryMonthlyCHF: number;
  spouseNetSalaryMonthlyCHF: number;
  rentalIncomeMonthlyCHF: number;
  otherIncomeMonthlyCHF: number;
  housingMonthlyCHF: number;
  healthInsuranceMonthlyCHF: number;
  loansMonthlyCHF: number;
  alimonyPaidMonthlyCHF: number;
  otherExpensesMonthlyCHF: number;
  [key: string]: unknown;
}

export interface BudgetOptimizationItem {
  label: string;
  monthlyCHF: number;
  sourceKind: HistoryEntry["kind"];
  details?: string;
}

export interface BudgetResult {
  totalMonthlyIncomeCHF: number;
  totalMonthlyExpensesCHF: number;
  currentMarginCHF: number;
  optimizations: BudgetOptimizationItem[];
  totalMonthlyOptimizationCHF: number;
  optimizedMarginCHF: number;
}

export function computeBudgetTotals(input: BudgetInput): {
  totalMonthlyIncomeCHF: number;
  totalMonthlyExpensesCHF: number;
  currentMarginCHF: number;
} {
  const totalMonthlyIncomeCHF =
    input.netSalaryMonthlyCHF +
    input.spouseNetSalaryMonthlyCHF +
    input.rentalIncomeMonthlyCHF +
    input.otherIncomeMonthlyCHF;
  const totalMonthlyExpensesCHF =
    input.housingMonthlyCHF +
    input.healthInsuranceMonthlyCHF +
    input.loansMonthlyCHF +
    input.alimonyPaidMonthlyCHF +
    input.otherExpensesMonthlyCHF;
  return {
    totalMonthlyIncomeCHF,
    totalMonthlyExpensesCHF,
    currentMarginCHF: totalMonthlyIncomeCHF - totalMonthlyExpensesCHF,
  };
}

/**
 * Détail des optimisations mensualisées identifiées ailleurs dans le même
 * dossier (toutes simulations actives, non archivées, un seul gain par
 * kind — même sélection que aggregateGains). Toujours affiché poste par
 * poste, même quand le total net ne change presque pas : "il faut pouvoir
 * parer à toutes les éventualités".
 */
export function computeBudgetOptimizations(entries: HistoryEntry[]): BudgetOptimizationItem[] {
  const { items } = aggregateGains(entries);
  return items
    .filter((i) => i.type === "annual")
    .map((i) => ({
      label: i.label,
      monthlyCHF: i.amount / 12,
      sourceKind: i.kind,
      details: i.details,
    }));
}

export function computeBudget(input: BudgetInput, entries: HistoryEntry[]): BudgetResult {
  const totals = computeBudgetTotals(input);
  const optimizations = computeBudgetOptimizations(entries);
  const totalMonthlyOptimizationCHF = optimizations.reduce((sum, o) => sum + o.monthlyCHF, 0);
  return {
    ...totals,
    optimizations,
    totalMonthlyOptimizationCHF,
    optimizedMarginCHF: totals.currentMarginCHF + totalMonthlyOptimizationCHF,
  };
}
