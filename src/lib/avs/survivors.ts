// AVS/AI, Rentes enfants, veuf/veuve, orphelins (échelle 44, 2026).
//
// Référence : LAVS art. 22ter / 23-25 / 35-37, paramètres OFAS 2026.
// Règles principales :
// - Rente pour enfant (AVS vieillesse OU AI) = 40% de la rente principale
//   théorique du parent.
// - Rente de veuf/veuve = 80% de la rente vieillesse théorique du défunt.
// - Rente d'orphelin simple = 40%, double orphelin = 60% de la rente
//   théorique du parent décédé.
// - Surassurance (art. 41 LAVS, art. 54bis RAVS) : les rentes pour enfants
//   et d'orphelins sont réduites dans la mesure où, ajoutées à la rente du
//   père ou de la mère, elles dépassent 90 % du revenu annuel moyen
//   déterminant — sans jamais descendre sous un minimum garanti (150 % de
//   la rente minimale, + une rente minimale par enfant dès le 4e). Seules
//   les rentes d'enfants sont réduites, jamais celle du parent.
// - Le plafond de 150 % de la rente maximale (3'780 CHF/mois) ne concerne
//   QUE les deux rentes d'un couple marié (art. 35 LAVS, déjà géré par
//   projectAvsPension) — ce n'est pas un plafond « familial ».
//
// Toutes les rentes sont retournées en CHF annuels (round) + mensuels.

import { AVS_2026 } from "./parameters-2026";
import { theoreticalAnnualPension } from ".";

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
 * Réduction pour surassurance (art. 41 LAVS) : réduit proportionnellement
 * les rentes d'enfants/orphelins — et elles seules — quand leur somme avec
 * la rente du parent dépasse la limite.
 *
 * @param parentAnnual rente du père/de la mère (ou de veuf/veuve), 12 mois
 * @param children rentes pour enfants / d'orphelins
 * @param determiningIncome revenu annuel moyen déterminant (RAM)
 * @param scale quotité de rente (échelle partielle et/ou fraction AI), 0..1
 */
export function applyOverinsuranceCap(
  parentAnnual: number,
  children: RentItem[],
  determiningIncome: number,
  scale = 1,
): { children: RentItem[]; capped: boolean } {
  const childrenSum = children.reduce((s, i) => s + i.annual, 0);
  if (childrenSum === 0) return { children, capped: false };
  const guaranteedMinimum =
    1.5 * AVS_2026.minAnnualPension +
    Math.max(0, children.length - 3) * AVS_2026.minAnnualPension;
  const ram = Math.min(AVS_2026.maxDeterminingIncome, Math.max(0, determiningIncome));
  const limit = Math.max(0.9 * ram, guaranteedMinimum) * Math.max(0, Math.min(1, scale));
  if (parentAnnual + childrenSum <= limit) return { children, capped: false };
  const available = Math.max(0, limit - parentAnnual);
  const ratio = available / childrenSum;
  return {
    children: children.map((i) => ({
      ...i,
      annual: Math.round(i.annual * ratio),
      monthly: Math.round((i.annual * ratio) / 12),
    })),
    capped: true,
  };
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
 * formation). Les montants `primaryReducedAnnual` / `spouseReducedAnnual`
 * sont les totaux annuels réellement versés (13e rente incluse) ; les
 * rentes pour enfants restent sur 12 mois (pas de 13e rente).
 */
export function buildRetirementBenefits(opts: {
  primaryTheoreticalAnnual: number;
  primaryReducedAnnual: number;
  /** Revenu annuel moyen déterminant du parent (surassurance art. 41 LAVS). */
  determiningIncome: number;
  /** Échelle de rente du parent (années cotisées / 44), 1 si carrière complète. */
  primaryScale?: number;
  spouseLabel?: string;
  spouseReducedAnnual?: number;
  childrenCount: number;
  childLabels?: string[];
}): AvsRetirementBenefits {
  const primary: RentItem = {
    label: "Rente principale",
    annual: opts.primaryReducedAnnual,
    monthly: Math.round(opts.primaryReducedAnnual / 12),
    ratio: 1,
  };
  const spouse: RentItem | undefined =
    opts.spouseReducedAnnual !== undefined && opts.spouseReducedAnnual > 0
      ? {
          label: opts.spouseLabel ?? "Conjoint",
          annual: opts.spouseReducedAnnual,
          monthly: Math.round(opts.spouseReducedAnnual / 12),
          ratio: 1,
        }
      : undefined;
  // Échelle de rente du parent (années manquantes) : la rente pour enfant
  // suit la même échelle que la rente principale.
  const scale = Math.max(0, Math.min(1, opts.primaryScale ?? 1));
  const rawChildren: RentItem[] = [];
  for (let i = 0; i < opts.childrenCount; i++) {
    const child = childPensionFromParent(opts.primaryTheoreticalAnnual * scale);
    rawChildren.push({
      label: opts.childLabels?.[i] ?? `Rente enfant ${i + 1}`,
      annual: child.annual,
      monthly: child.monthly,
      ratio: 0.4,
    });
  }
  const { children, capped } = applyOverinsuranceCap(
    opts.primaryTheoreticalAnnual * scale,
    rawChildren,
    opts.determiningIncome,
    scale,
  );
  const totalAnnual =
    primary.annual + (spouse?.annual ?? 0) + children.reduce((s, c) => s + c.annual, 0);
  return {
    primary,
    spouse,
    children,
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

/** Convertit un degré d'invalidité en quotité de rente AI selon échelle légale
 *  (réforme AI 2022, Art. 28b LAI) : 0-39% = pas de rente, 40-49% = échelle
 *  linéaire 25%→47.5% (pas disabilityPct/100 : à 40% la quotité correcte est
 *  25%, pas 40%), 50-69% = quotité = degré d'invalidité (identité), 70%+ =
 *  rente entière. Seul appelant actuel (buildDisability dans
 *  pension-consolidation) utilise toujours 100% → la branche 40-49% était
 *  jusqu'ici inatteignable en prod, mais faux dès qu'un taux réel variable
 *  serait branché (ex. futur sélecteur de taux d'invalidité). */
export function aiPensionFraction(disabilityPct: number): number {
  if (disabilityPct < 40) return 0;
  if (disabilityPct < 50) return (25 + (disabilityPct - 40) * 2.5) / 100;
  if (disabilityPct >= 70) return 1;
  return disabilityPct / 100;
}

/**
 * Invalidité (AI) : rente principale proratisée + rentes enfants AI 40%.
 */
export function buildDisabilityBenefits(opts: {
  primaryTheoreticalAnnual: number;
  /** Rente AI entière de l'assuré (échelle de sa classe d'âge appliquée). */
  primaryFullReducedAnnual: number;
  /** Revenu annuel moyen déterminant (surassurance art. 41 LAVS). */
  determiningIncome: number;
  disabilityPct: number; // 0..100
  childrenCount: number;
  childLabels?: string[];
}): AvsDisabilityBenefits {
  const fraction = aiPensionFraction(opts.disabilityPct);
  const primaryAnnual = Math.round(opts.primaryFullReducedAnnual * fraction);
  const primary: RentItem = {
    label: `Rente AI ${Math.round(fraction * 100)}%`,
    annual: primaryAnnual,
    monthly: Math.round(primaryAnnual / 12),
    ratio: fraction,
  };
  const rawChildren: RentItem[] = [];
  for (let i = 0; i < opts.childrenCount; i++) {
    // 40 % de la rente AI effectivement versée au parent (même échelle).
    const child = childPensionFromParent(opts.primaryFullReducedAnnual);
    const annual = Math.round(child.annual * fraction);
    rawChildren.push({
      label: opts.childLabels?.[i] ?? `Rente enfant AI ${i + 1}`,
      annual,
      monthly: Math.round(annual / 12),
      ratio: 0.4 * fraction,
    });
  }
  const scale =
    opts.primaryTheoreticalAnnual > 0
      ? Math.min(1, opts.primaryFullReducedAnnual / opts.primaryTheoreticalAnnual) * fraction
      : fraction;
  const { children, capped } = applyOverinsuranceCap(
    primaryAnnual,
    rawChildren,
    opts.determiningIncome,
    scale,
  );
  const totalAnnual = primary.annual + children.reduce((s, c) => s + c.annual, 0);
  return {
    primary,
    children,
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
 * Réduction des rentes d'orphelins pour surassurance (art. 41 LAVS).
 */
export function buildSurvivorBenefits(opts: {
  deceasedTheoreticalAnnual: number;
  /** Revenu annuel moyen déterminant du défunt (surassurance art. 41 LAVS). */
  determiningIncome: number;
  hasSurvivingSpouse: boolean;
  childrenCount: number;
  childLabels?: string[];
  /** Si true, les enfants sont déjà orphelins de l'autre parent. */
  childrenAreDoubleOrphans?: boolean;
}): AvsSurvivorBenefits {
  let widow: RentItem | undefined;
  if (opts.hasSurvivingSpouse) {
    const w = widowPensionFromDeceased(opts.deceasedTheoreticalAnnual);
    widow = { label: "Rente veuf/veuve", annual: w.annual, monthly: w.monthly, ratio: 0.8 };
  }
  const rawOrphans: RentItem[] = [];
  for (let i = 0; i < opts.childrenCount; i++) {
    const o = orphanPensionFromDeceased(
      opts.deceasedTheoreticalAnnual,
      opts.childrenAreDoubleOrphans,
    );
    rawOrphans.push({
      label: opts.childLabels?.[i] ?? `Rente orphelin ${i + 1}`,
      annual: o.annual,
      monthly: o.monthly,
      ratio: opts.childrenAreDoubleOrphans ? 0.6 : 0.4,
    });
  }
  const { children: orphans, capped } = applyOverinsuranceCap(
    widow?.annual ?? 0,
    rawOrphans,
    opts.determiningIncome,
  );
  const totalAnnual = (widow?.annual ?? 0) + orphans.reduce((s, c) => s + c.annual, 0);
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
