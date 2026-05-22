// AVS/AI, Rentes enfants, veuf/veuve, orphelins (échelle 44, 2026).
//
// Référence : LAVS art. 22ter / 23-25 / 35-37, paramètres OFAS 2026.
// Règles principales :
// - Rente pour enfant (AVS vieillesse OU AI) = 40% de la rente principale
//   théorique du parent.
// - Rente de veuf/veuve = 80% de la rente vieillesse théorique du défunt.
// - Rente d'orphelin simple = 40%, double orphelin = 60% de la rente
//   théorique du parent décédé.
// - Plafond familial : la somme rente parent + rentes enfants ne peut
//   dépasser 150% de la rente individuelle maximale (3'780 CHF/mois en 2026).
// - Pour couple double rente vieillesse : plafond couple 150% rente max
//   = 3'780 CHF/mois (déjà géré par projectAvsPension).
//
// Toutes les rentes sont retournées en CHF annuels (round) + mensuels.

import { AVS_2026 } from "./parameters-2026";
import { theoreticalAnnualPension } from ".";

const FAMILY_CAP_RATIO = 1.5; // 150% rente max individuelle

export interface RentItem {
  /** Libellé court pour l'UI : "Rente enfant", "Veuve", "Orphelin Léa" */
  label: string;
  annual: number;
  monthly: number;
  /** Ratio appliqué (informationnel) : 0.40, 0.60, 0.80, etc. */
  ratio: number;
}

/** Rente vieillesse / invalidité enfant : 40% de la rente théorique du parent. */
export function childPensionFromParent(parentTheoreticalAnnual: number): {
  annual: number;
  monthly: number;
} {
  const annual = Math.round(parentTheoreticalAnnual * 0.4);
  return { annual, monthly: Math.round(annual / 12) };
}

/** Rente de veuf/veuve : 80% de la rente théorique du défunt. */
export function widowPensionFromDeceased(deceasedTheoreticalAnnual: number): {
  annual: number;
  monthly: number;
} {
  const annual = Math.round(deceasedTheoreticalAnnual * 0.8);
  return { annual, monthly: Math.round(annual / 12) };
}

/** Rente d'orphelin : 40% (simple) ou 60% (double). */
export function orphanPensionFromDeceased(
  deceasedTheoreticalAnnual: number,
  isDoubleOrphan = false,
): { annual: number; monthly: number } {
  const ratio = isDoubleOrphan ? 0.6 : 0.4;
  const annual = Math.round(deceasedTheoreticalAnnual * ratio);
  return { annual, monthly: Math.round(annual / 12) };
}

/**
 * Applique le plafond familial : la somme des rentes (parent + enfants) ne
 * peut dépasser 150% de la rente max individuelle. Réduction proportionnelle.
 */
export function applyFamilyCap(items: RentItem[]): {
  items: RentItem[];
  totalAnnual: number;
  capped: boolean;
} {
  const sum = items.reduce((s, i) => s + i.annual, 0);
  const cap = Math.round(AVS_2026.maxAnnualPension * FAMILY_CAP_RATIO);
  if (sum <= cap || sum === 0) {
    return { items, totalAnnual: sum, capped: false };
  }
  const ratio = cap / sum;
  const capped = items.map((i) => ({
    ...i,
    annual: Math.round(i.annual * ratio),
    monthly: Math.round((i.annual * ratio) / 12),
  }));
  return { items: capped, totalAnnual: cap, capped: true };
}

export interface AvsRetirementBenefits {
  primary: RentItem;
  spouse?: RentItem;
  children: RentItem[];
  totalAnnual: number;
  totalMonthly: number;
  cappedFamily: boolean;
}

/**
 * Vieillesse : rente principale + rente enfants (40% par enfant <18 ou <25 si en
 * formation). Plafond familial appliqué.
 */
export function buildRetirementBenefits(opts: {
  primaryTheoreticalAnnual: number;
  primaryReducedAnnual: number;
  spouseLabel?: string;
  spouseReducedAnnual?: number;
  childrenCount: number;
  childLabels?: string[];
}): AvsRetirementBenefits {
  const items: RentItem[] = [
    {
      label: "Rente principale",
      annual: opts.primaryReducedAnnual,
      monthly: Math.round(opts.primaryReducedAnnual / 12),
      ratio: 1,
    },
  ];
  if (opts.spouseReducedAnnual !== undefined && opts.spouseReducedAnnual > 0) {
    items.push({
      label: opts.spouseLabel ?? "Conjoint",
      annual: opts.spouseReducedAnnual,
      monthly: Math.round(opts.spouseReducedAnnual / 12),
      ratio: 1,
    });
  }
  for (let i = 0; i < opts.childrenCount; i++) {
    const child = childPensionFromParent(opts.primaryTheoreticalAnnual);
    items.push({
      label: opts.childLabels?.[i] ?? `Rente enfant ${i + 1}`,
      annual: child.annual,
      monthly: child.monthly,
      ratio: 0.4,
    });
  }
  const { items: cappedItems, totalAnnual, capped } = applyFamilyCap(items);
  return {
    primary: cappedItems[0],
    spouse: opts.spouseReducedAnnual !== undefined ? cappedItems[1] : undefined,
    children: cappedItems.slice(opts.spouseReducedAnnual !== undefined ? 2 : 1),
    totalAnnual,
    totalMonthly: Math.round(totalAnnual / 12),
    cappedFamily: capped,
  };
}

export interface AvsDisabilityBenefits {
  primary: RentItem;
  children: RentItem[];
  /** Taux d'invalidité (%) appliqué : 25/50/75/100 (ou proratisé). */
  disabilityRate: number;
  totalAnnual: number;
  totalMonthly: number;
  cappedFamily: boolean;
}

/** Convertit un degré d'invalidité en quotité de rente AI selon échelle légale. */
export function aiPensionFraction(disabilityPct: number): number {
  if (disabilityPct < 40) return 0;
  if (disabilityPct < 50) return disabilityPct / 100; // rente par paliers 2022+
  if (disabilityPct >= 70) return 1;
  return disabilityPct / 100;
}

/**
 * Invalidité (AI) : rente principale proratisée + rentes enfants AI 40%.
 */
export function buildDisabilityBenefits(opts: {
  primaryTheoreticalAnnual: number;
  primaryFullReducedAnnual: number; // rente vieillesse réduite si la carrière s'arrêtait aujourd'hui
  disabilityPct: number; // 0..100
  childrenCount: number;
  childLabels?: string[];
}): AvsDisabilityBenefits {
  const fraction = aiPensionFraction(opts.disabilityPct);
  const primaryAnnual = Math.round(opts.primaryFullReducedAnnual * fraction);
  const items: RentItem[] = [
    {
      label: `Rente AI ${Math.round(fraction * 100)}%`,
      annual: primaryAnnual,
      monthly: Math.round(primaryAnnual / 12),
      ratio: fraction,
    },
  ];
  for (let i = 0; i < opts.childrenCount; i++) {
    const child = childPensionFromParent(opts.primaryTheoreticalAnnual);
    const annual = Math.round(child.annual * fraction);
    items.push({
      label: opts.childLabels?.[i] ?? `Rente enfant AI ${i + 1}`,
      annual,
      monthly: Math.round(annual / 12),
      ratio: 0.4 * fraction,
    });
  }
  const { items: cappedItems, totalAnnual, capped } = applyFamilyCap(items);
  return {
    primary: cappedItems[0],
    children: cappedItems.slice(1),
    disabilityRate: Math.round(fraction * 100),
    totalAnnual,
    totalMonthly: Math.round(totalAnnual / 12),
    cappedFamily: capped,
  };
}

export interface AvsSurvivorBenefits {
  widow?: RentItem;
  orphans: RentItem[];
  totalAnnual: number;
  totalMonthly: number;
  cappedFamily: boolean;
}

/**
 * Décès : rente veuf/veuve 80% + rentes orphelins 40%/60%.
 * Plafond familial 150% rente max.
 */
export function buildSurvivorBenefits(opts: {
  deceasedTheoreticalAnnual: number;
  hasSurvivingSpouse: boolean;
  childrenCount: number;
  childLabels?: string[];
  /** Si true, les enfants sont déjà orphelins de l'autre parent. */
  childrenAreDoubleOrphans?: boolean;
}): AvsSurvivorBenefits {
  const items: RentItem[] = [];
  if (opts.hasSurvivingSpouse) {
    const w = widowPensionFromDeceased(opts.deceasedTheoreticalAnnual);
    items.push({
      label: "Rente veuf/veuve",
      annual: w.annual,
      monthly: w.monthly,
      ratio: 0.8,
    });
  }
  for (let i = 0; i < opts.childrenCount; i++) {
    const o = orphanPensionFromDeceased(
      opts.deceasedTheoreticalAnnual,
      opts.childrenAreDoubleOrphans,
    );
    items.push({
      label: opts.childLabels?.[i] ?? `Rente orphelin ${i + 1}`,
      annual: o.annual,
      monthly: o.monthly,
      ratio: opts.childrenAreDoubleOrphans ? 0.6 : 0.4,
    });
  }
  const { items: cappedItems, totalAnnual, capped } = applyFamilyCap(items);
  const widow = opts.hasSurvivingSpouse ? cappedItems[0] : undefined;
  const orphans = cappedItems.slice(opts.hasSurvivingSpouse ? 1 : 0);
  return {
    widow,
    orphans,
    totalAnnual,
    totalMonthly: Math.round(totalAnnual / 12),
    cappedFamily: capped,
  };
}

/** Helper pratique : récupère la rente théorique annuelle à 44 ans complets. */
export function theoreticalFromIncome(averageAnnualIncome: number): number {
  return Math.round(theoreticalAnnualPension(averageAnnualIncome));
}
