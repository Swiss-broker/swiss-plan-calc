// Moteur d'optimisation contextuel.
// Analyse une situation client (impôt, LPP, 3a, fortune) et propose
// automatiquement des recommandations chiffrées.

import {
  computeIncomeTax,
  PILLAR_3A_MAX_2026_LPP,
  type IncomeTaxInput,
} from "../tax/income";
import { simulateBuybackPlan } from "../lpp";
import { staggeredWithdrawal as stagged3a } from "../pillar3";
import { CANTON_SCALES } from "../tax/cantons";

export type OptimizationCategory = "lpp" | "3a" | "canton" | "wealth" | "withdrawal";

/**
 * Statut fiscal du contribuable, détermine si les déductions
 * (rachat LPP, 3a, etc.) sont automatiquement appliquées ou non.
 *
 * - `resident` / `tou` : déductions OK (taxation ordinaire).
 * - `source_taxed` : déductions NON automatiques (rectification IS ou TOU requise).
 * - `cross_border_fr_1983` : imposé en France ; déductions suisses sans effet.
 * - `cross_border_ge` : IS au barème normal GE ; déductions limitées.
 */
export type TaxStatusContext =
  | "resident"
  | "source_taxed"
  | "cross_border_fr_1983"
  | "cross_border_ge"
  | "tou";

export type WorkStatusContext =
  | "employee"
  | "self_employed"
  | "mixed"
  | "retired"
  | "unemployed"
  | "student";

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
• le client est quasi-résident (≥ 90 % revenus en CH) ET demande la TOU (Taxation Ordinaire Ultérieure) ;
• OU le client demande une rectification IS auprès de l'administration cantonale ;
• OU le client passe en taxation ordinaire (permis C / Suisse).
${common}`,
    };
  }
  if (kind === "3a") {
    return {
      severity: "warning",
      title: "Client imposé à la source, déduction 3a non automatique",
      body: `Le versement 3a est autorisé pour un imposé à la source, mais sa déduction fiscale exige : TOU (quasi-résident ≥ 90 %), rectification IS, ou passage en taxation ordinaire.
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
    title: "Frontalier, règles conventionnelles spécifiques",
    body: "La déductibilité dépend du régime fiscal applicable (accord 1983 pour les frontaliers français, IS au barème normal pour Genève). Valider l'éligibilité au cas par cas selon le pays d'imposition principal.",
  };
}

/** Le statut fiscal autorise-t-il les déductions de manière automatique ? */
function deductionsAreAutomatic(s?: TaxStatusContext): boolean {
  return s === undefined || s === "resident" || s === "tou";
}

export function runOptimizer(input: OptimizerInput): Optimization[] {
  const optimizations: Optimization[] = [];
  const baseline = computeIncomeTax(input.taxInput);
  const status = input.taxInput.status;
  const taxStatus = input.taxStatus;

  const isSource = taxStatus === "source_taxed";
  const isCrossBorder = taxStatus === "cross_border_fr_1983" || taxStatus === "cross_border_ge";
  const needsWarning = isSource || isCrossBorder;

  // 1) RACHAT LPP · si capacité disponible
  if ((input.lppBuybackCapacity ?? 0) > 5_000) {
    const capacity = input.lppBuybackCapacity!;
    const plan = simulateBuybackPlan({
      buybackCapacity: capacity,
      years: 3,
      taxInput: input.taxInput,
    });
    if (plan.totalTaxSavings > 1_000) {
      optimizations.push({
        id: "lpp-buyback",
        category: "lpp",
        title: "Rachat LPP étalé sur 3 ans",
        description: `Vous disposez d'une capacité de rachat de CHF ${capacity.toLocaleString("fr-CH")}. En étalant sur 3 ans, vous économisez environ CHF ${plan.totalTaxSavings.toLocaleString("fr-CH")} d'impôts (sur 3 ans). Attention : aucun retrait LPP possible dans les 3 ans suivant un rachat.`,
        estimatedSavings: plan.totalTaxSavings,
        priority: plan.totalTaxSavings > 10_000 ? "high" : "medium",
        details: {
          versementAnnuel: plan.yearlyAmount,
          economieAnnuelleMoyenne: Math.round(plan.totalTaxSavings / 3),
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
  if (gap3a > 500 && input.hasLPP !== false) {
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
  if (baseline.taxableIncomeCC > 100_000) {
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

  // 5) RACHAT LPP AVANT RETRAITE (3 dernières années)
  if (input.age && input.age >= 60 && input.age <= 64 && (input.lppBuybackCapacity ?? 0) > 0) {
    optimizations.push({
      id: "lpp-pre-retirement",
      category: "lpp",
      title: "Fenêtre rachat LPP pré-retraite",
      description: `À ${input.age} ans, dernière fenêtre pour effectuer des rachats LPP. Le délai de blocage de 3 ans concerne uniquement le retrait en capital · la rente reste possible. Capacité disponible : CHF ${input.lppBuybackCapacity!.toLocaleString("fr-CH")}.`,
      estimatedSavings: Math.round((input.lppBuybackCapacity ?? 0) * (baseline.marginalRate / 100)),
      priority: "high",
      warning: isSource
        ? sourceTaxedWarning("lpp_buyback")
        : isCrossBorder
          ? crossBorderWarning()
          : undefined,
    });
  }

  // Marqueur cohérence : si déductions non automatiques, on peut éventuellement
  // log côté dev. (Pas d'effet runtime ici.)
  void deductionsAreAutomatic;

  return optimizations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}
