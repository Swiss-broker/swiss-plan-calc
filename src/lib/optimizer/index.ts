// Moteur d'optimisation contextuel.
// Analyse une situation client (impôt, LPP, 3a, fortune) et propose
// automatiquement des recommandations chiffrées.

import {
  computeIncomeTax,
  PILLAR_3A_MAX_2026_LPP,
  type IncomeTaxInput,
  type WorkStatusForTax,
} from "../tax/income";
import { simulateBuybackPlan } from "../lpp";
import { staggeredWithdrawal as stagged3a } from "../pillar3";
import { CANTON_SCALES } from "../tax/cantons";

export type OptimizationCategory = "lpp" | "3a" | "canton" | "wealth" | "withdrawal";

/**
 * Statut fiscal du contribuable, détermine si les déductions
 * (rachat LPP, 3a, etc.) sont automatiquement appliquées ou non.
 *
 * - `resident` : déductions OK (taxation ordinaire).
 * - `source_taxed` / `tou` : déductions NON automatiques tant que la TOU
 *   n'est pas demandée — la retenue à la source s'applique sans déduction.
 * - `cross_border_fr_1983` : imposé en France ; déductions suisses sans effet.
 * - `cross_border_ge` : IS au barème normal GE ; déductions limitées.
 */
export type TaxStatusContext =
  | "resident"
  | "source_taxed"
  | "cross_border_fr_1983"
  | "cross_border_ge"
  | "tou";

// Réutilise WorkStatusForTax (tax/income.ts) plutôt qu'une énumération locale :
// une 2e définition désynchronisée a déjà oublié la valeur "director" ajoutée
// là-bas — même famille de bug que le statut fiscal ci-dessus.
export type WorkStatusContext = WorkStatusForTax;

export interface Optimization {
  id: string;
  category: OptimizationCategory;
  title: string;
  description: string;
  /** Économie estimée CHF (sur 1 an ou cumulé selon la suggestion) */
  estimatedSavings: number;
  /** Niveau de priorité */
  priority: "high" | "medium" | "low";
  /** Détails additionnels (clé/valeur) */
  details?: Record<string, string | number>;
  /**
   * Avertissement fiscal critique (statut IS, frontalier, etc.).
   * Doit être affiché de manière TRÈS visible : la déduction n'est pas
   * automatique et nécessite une démarche du client.
   */
  warning?: {
    severity: "warning" | "info";
    title: string;
    body: string;
  };
}

export interface OptimizerInput {
  taxInput: IncomeTaxInput;
  /** Capacité de rachat LPP disponible (CHF) */
  lppBuybackCapacity?: number;
  /** Cotisation 3a effective de l'année */
  pillar3aCurrent?: number;
  /** Capital 3a accumulé (pour planification retrait) */
  pillar3aBalance?: number;
  /** Affilié à une LPP ? */
  hasLPP?: boolean;
  /** Âge du contribuable */
  age?: number;
  /** Capital LPP actuel (pour scénarios retraite) */
  lppBalance?: number;
  /** Statut fiscal, IMPORTANT pour adapter les suggestions */
  taxStatus?: TaxStatusContext;
  /** Statut professionnel, utile pour 3a non-LPP, etc. */
  workStatus?: WorkStatusContext;
}

/** Construit l'avertissement à afficher sur les déductions pour les imposés à la source. */
function sourceTaxedWarning(
  kind: "lpp_buyback" | "3a" | "withdrawal",
): Optimization["warning"] | undefined {
  const common =
    "Sans démarche, l'opération reste possible mais ne génère AUCUNE économie fiscale.";
  if (kind === "lpp_buyback") {
    return {
      severity: "warning",
      title: "Client imposé à la source, déduction non automatique",
      body: `La déduction fiscale annoncée n'est applicable que si :
• le client demande la TOU (Taxation Ordinaire Ultérieure) avant le 31 mars de l'année suivante — possible sans condition pour un résident, réservée aux quasi-résidents (≥ 90 % des revenus en CH) pour un frontalier ;
• OU son salaire brut atteint 120 000 CHF (TOU obligatoire, la déduction s'applique alors d'office) ;
• OU le client passe en taxation ordinaire (permis C / Suisse).
${common}`,
    };
  }
  if (kind === "3a") {
    return {
      severity: "warning",
      title: "Client imposé à la source, déduction 3a non automatique",
      body: `Le versement 3a est autorisé pour un imposé à la source, mais sa déduction fiscale exige une TOU (sur demande avant le 31 mars de l'année suivante, ou obligatoire dès 120 000 CHF de salaire brut) ou le passage en taxation ordinaire.
${common}`,
    };
  }
  return {
    severity: "info",
    title: "Client imposé à la source, vérifier l'imposition du retrait",
    body: "Le retrait en capital 3a/LPP reste imposé séparément dans le canton de domicile au moment du retrait. Vérifier la résidence fiscale prévue à l'échéance.",
  };
}

function crossBorderWarning(): Optimization["warning"] {
  return {
    severity: "warning",
    title: "Frontalier Genève, déduction non automatique",
    body: "L'impôt à la source genevois ne tient compte d'aucune déduction. L'économie annoncée suppose une demande de TOU, réservée aux quasi-résidents (≥ 90 % des revenus du foyer en Suisse), à déposer avant le 31 mars de l'année suivante.",
  };
}

export function runOptimizer(input: OptimizerInput): Optimization[] {
  const optimizations: Optimization[] = [];
  const baseline = computeIncomeTax(input.taxInput);
  const status = input.taxInput.status;
  const taxStatus = input.taxStatus;

  // "tou" (quasi-résident pas encore passé en Taxation Ordinaire Ultérieure)
  // doit être traité comme "source_taxed" pour l'avertissement : la retenue
  // à la source s'applique SANS déduction jusqu'au dépôt effectif de la
  // demande TOU — voir regime-aware-deduction.ts et les notes de Fiscal
  // Global. deductionsAreAutomatic() ci-dessus reconnaît déjà "tou" comme
  // automatique à tort ; elle n'est volontairement plus utilisée ici.
  const isSource = taxStatus === "source_taxed" || taxStatus === "tou";
  const isCrossBorder = taxStatus === "cross_border_ge";
  const needsWarning = isSource || isCrossBorder;
  // Frontalier sous l'accord de 1983 : imposé en France uniquement. Un rachat
  // LPP, un versement 3a ou un changement de canton de travail n'y changent
  // rien (même règle que regime-aware-deduction.ts) : aucune économie
  // suisse n'est suggérée.
  const swissDeductionsUseless = taxStatus === "cross_border_fr_1983";
  // Proche de la retraite : le rachat ne peut plus être étalé sur 3 ans.
  const yearsToRetirement = input.age != null ? 65 - input.age : null;
  const preRetirement = yearsToRetirement !== null && yearsToRetirement >= 1 && yearsToRetirement <= 5;
  const buybackYears =
    yearsToRetirement !== null && yearsToRetirement >= 1 ? Math.min(3, yearsToRetirement) : 3;

  // 1) RACHAT LPP · si capacité disponible
  if (!swissDeductionsUseless && (input.lppBuybackCapacity ?? 0) > 5_000) {
    const capacity = input.lppBuybackCapacity!;
    const plan = simulateBuybackPlan({
      buybackCapacity: capacity,
      years: buybackYears,
      taxInput: input.taxInput,
    });
    const yearsLabel = buybackYears > 1 ? `${buybackYears} ans` : "1 an";
    if (plan.totalTaxSavings > 1_000) {
      optimizations.push({
        id: "lpp-buyback",
        category: "lpp",
        title: buybackYears > 1 ? `Rachat LPP étalé sur ${yearsLabel}` : "Rachat LPP avant la retraite",
        description: `Vous disposez d'une capacité de rachat de CHF ${capacity.toLocaleString("fr-CH")}. En ${buybackYears > 1 ? `étalant sur ${yearsLabel}` : "le versant cette année"}, vous économisez environ CHF ${plan.totalTaxSavings.toLocaleString("fr-CH")} d'impôts${buybackYears > 1 ? ` (sur ${yearsLabel})` : ""}. Attention : aucun retrait LPP en capital possible dans les 3 ans suivant un rachat${preRetirement ? " — à moins de 3 ans de la retraite, la prestation correspondante devra être prise en rente" : ""}.`,
        estimatedSavings: plan.totalTaxSavings,
        priority: plan.totalTaxSavings > 10_000 ? "high" : "medium",
        details: {
          versementAnnuel: plan.yearlyAmount,
          economieAnnuelleMoyenne: Math.round(plan.totalTaxSavings / buybackYears),
          tauxMarginal: `${baseline.marginalRate.toFixed(1)} %`,
          dureeBlocage: "3 ans après dernier versement",
        },
        warning: isSource
          ? sourceTaxedWarning("lpp_buyback")
          : isCrossBorder
            ? crossBorderWarning()
            : undefined,
      });
    }
  }

  // 2) MAXIMISER LE 3A
  const max3a = PILLAR_3A_MAX_2026_LPP;
  const current3a = input.pillar3aCurrent ?? input.taxInput.pillar3aContributions ?? 0;
  const gap3a = Math.max(0, max3a - current3a);
  if (!swissDeductionsUseless && gap3a > 500 && input.hasLPP !== false) {
    const scenario = computeIncomeTax({
      ...input.taxInput,
      pillar3aContributions: max3a,
    });
    const savings = baseline.totalTax - scenario.totalTax;
    if (savings > 100) {
      optimizations.push({
        id: "3a-max",
        category: "3a",
        title: `Maximiser le 3a (+ CHF ${gap3a.toLocaleString("fr-CH")})`,
        description: `Vous cotisez actuellement CHF ${current3a.toLocaleString("fr-CH")} sur ${max3a.toLocaleString("fr-CH")} possibles. Atteindre le plafond vous fait économiser environ CHF ${Math.round(savings).toLocaleString("fr-CH")} d'impôts cette année.`,
        estimatedSavings: Math.round(savings),
        priority: savings > 1_500 ? "high" : "medium",
        details: {
          plafond: max3a,
          ecart: gap3a,
          tauxMarginal: `${baseline.marginalRate.toFixed(1)} %`,
        },
        warning: isSource
          ? sourceTaxedWarning("3a")
          : isCrossBorder
            ? crossBorderWarning()
            : undefined,
      });
    }
  }

  // 3) RETRAIT 3A ÉTALÉ · si capital significatif
  if ((input.pillar3aBalance ?? 0) > 80_000) {
    const stag = stagged3a({
      totalCapital: input.pillar3aBalance!,
      numberOfAccounts: 3,
      canton: input.taxInput.canton,
      status:
        status === "single_with_children" ? "single_with_children" : status === "married" ? "married" : "single",
    });
    if (stag.savings > 500) {
      optimizations.push({
        id: "3a-staggered",
        category: "withdrawal",
        title: "Fractionner le 3a sur 3 comptes",
        description: `Avec un capital 3a de CHF ${input.pillar3aBalance!.toLocaleString("fr-CH")}, ouvrir 3 comptes et étaler les retraits sur plusieurs années fiscales économise environ CHF ${stag.savings.toLocaleString("fr-CH")} (${stag.savingsRate} % du capital).`,
        estimatedSavings: stag.savings,
        priority: stag.savings > 5_000 ? "high" : "medium",
        details: {
          parCompte: stag.perAccount,
          impotFractionne: stag.totalTaxSeparated,
          impotUnique: stag.totalTaxSingle,
        },
        // Le retrait reste imposé séparément dans le canton de domicile : info utile.
        warning: needsWarning ? sourceTaxedWarning("withdrawal") : undefined,
      });
    }
  }

  // 4) COMPARATIF CANTONAL · si revenu élevé
  if (!swissDeductionsUseless && baseline.taxableIncomeCC > 100_000) {
    const otherCantons = ["ZG"];
    let bestSavings = 0;
    let bestCanton = "";
    for (const c of otherCantons) {
      if (c === input.taxInput.canton) continue;
      const alt = computeIncomeTax({ ...input.taxInput, canton: c });
      const diff = baseline.totalTax - alt.totalTax;
      if (diff > bestSavings) {
        bestSavings = diff;
        bestCanton = c;
      }
    }
    if (bestSavings > 3_000) {
      optimizations.push({
        id: "canton-compare",
        category: "canton",
        title: `Domicile à ${CANTON_SCALES[bestCanton]?.capital ?? bestCanton} : -CHF ${Math.round(bestSavings).toLocaleString("fr-CH")}/an`,
        description: `Comparé à votre canton actuel (${input.taxInput.canton}), un déménagement vers ${CANTON_SCALES[bestCanton]?.capital ?? bestCanton} (${bestCanton}) réduirait votre charge fiscale annuelle d'environ CHF ${Math.round(bestSavings).toLocaleString("fr-CH")}.`,
        estimatedSavings: Math.round(bestSavings),
        priority: bestSavings > 10_000 ? "high" : "low",
        details: {
          cantonActuel: input.taxInput.canton,
          cantonAlternatif: bestCanton,
        },
      });
    }
  }

  return optimizations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}
