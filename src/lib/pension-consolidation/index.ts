// src/lib/pension-consolidation.ts
// Consolidation 1er + 2e pilier, vision globale des prestations futures
// pour les 3 événements clés : retraite, invalidité, décès.
//
// Source de vérité unique réutilisée par :
// - la carte « Prestations consolidées » de la fiche client
// - le PDF de synthèse
//
// Toutes les valeurs sont calculées à partir du bundle client uniquement
// (aucune saisie what-if). Pour les sous-modules concernés :
// - AVS/AI : src/lib/avs (rentes vieillesse, AI, enfants, survivants)
// - LPP : src/lib/client-dashboard/lpp-projection (avoir projeté + rente)

import type { ClientBundle } from "@/lib/client-dashboard";
import { ageFromDob, parseChildren } from "@/lib/clients/types";
import {
  AVS_2026,
  getReferenceAge,
  projectAvsPension,
  theoreticalAnnualPension,
  type Gender,
} from "@/lib/avs";
import {
  buildRetirementBenefits,
  buildDisabilityBenefits,
  buildSurvivorBenefits,
  type AvsRetirementBenefits,
  type AvsDisabilityBenefits,
  type AvsSurvivorBenefits,
} from "@/lib/avs/survivors";
import { projectClientLPP, projectClient3a } from "@/lib/client-dashboard/lpp-projection";

export type PensionEvent = "retirement" | "disability" | "death";

export interface ConsolidatedItem {
  label: string;
  annual: number;
  monthly: number;
  pillar: "AVS" | "AI" | "LPP";
}

export interface ConsolidatedScenario {
  event: PensionEvent;
  pillar1: { items: ConsolidatedItem[]; totalAnnual: number; cappedFamily: boolean };
  pillar2: { items: ConsolidatedItem[]; totalAnnual: number };
  combinedAnnual: number;
  combinedMonthly: number;
  notes: string[];
}

export interface ConsolidatedBenefits {
  retirement: ConsolidatedScenario | null;
  disability: ConsolidatedScenario | null;
  death: ConsolidatedScenario | null;
}

// Plafond légal de cotisation 3a pour un salarié affilié LPP (2026).
// Partagé entre buildOptimizedBundle et getOptimizationAssumptions
// pour ne jamais avoir deux valeurs qui divergent.
const PILLAR_3A_MAX_LPP = 7_258;

// ────────────────────────────────────────────────────────────
// Helpers internes
// ────────────────────────────────────────────────────────────

function getBirthYear(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const y = new Date(dob).getFullYear();
  return Number.isFinite(y) ? y : null;
}

/** Convertit un AVS RentItem en ConsolidatedItem (pillar fixé). */
function toItem(
  label: string,
  annual: number,
  pillar: "AVS" | "AI" | "LPP",
): ConsolidatedItem {
  return { label, annual, monthly: Math.round(annual / 12), pillar };
}

function childLabelsFromBundle(b: ClientBundle): string[] {
  return parseChildren(b.client.children).map(
    (c, i) => c.first_name?.trim() || `Enfant ${i + 1}`,
  );
}

// ────────────────────────────────────────────────────────────
// VIEILLESSE
// ────────────────────────────────────────────────────────────

function buildRetirement(b: ClientBundle): ConsolidatedScenario | null {
  const birthYear = getBirthYear(b.client.date_of_birth);
  if (!birthYear) return null;
  const gender = (b.client.gender as Gender | null) ?? null;
  const referenceAge = getReferenceAge(birthYear, gender);
  const retirementYear = birthYear + Math.round(referenceAge);
  const contributionStartYear = birthYear + 21;

  const avgIncome =
    Number(b.client.gross_annual_salary ?? 0) + Number(b.client.bonus ?? 0);
  if (avgIncome <= 0) return null;

  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  const spouseBirthYear = getBirthYear(b.client.spouse_date_of_birth);
  const spouseIncome = Number(b.client.spouse_gross_annual_salary ?? 0);

  let avs;
  try {
    avs = projectAvsPension({
      status: isCouple ? "married" : "single",
      primary: {
        birthYear,
        gender,
        contributionStartYear,
        retirementYear,
        averageAnnualIncome: avgIncome,
      },
      spouse:
        isCouple && spouseBirthYear
          ? {
              birthYear: spouseBirthYear,
              gender: gender === "female" ? "male" : "female",
              contributionStartYear: spouseBirthYear + 21,
              retirementYear:
                spouseBirthYear +
                Math.round(getReferenceAge(spouseBirthYear, undefined)),
              averageAnnualIncome: spouseIncome,
            }
          : undefined,
      });
  } catch {
    return null;
  }

  const childrenCount = parseChildren(b.client.children).length;
  const benefits: AvsRetirementBenefits = buildRetirementBenefits({
    primaryTheoreticalAnnual: avs.primary.theoreticalAnnualPension,
    primaryReducedAnnual: avs.primary.annualPension,
    spouseLabel: "Conjoint (AVS)",
    spouseReducedAnnual: avs.spouse?.annualPension,
    childrenCount,
    childLabels: childLabelsFromBundle(b).map((n) => `Rente enfant · ${n}`),
  });

  const pillar1Items: ConsolidatedItem[] = [
    toItem("Rente AVS (vous)", benefits.primary.annual, "AVS"),
    ...(benefits.spouse
      ? [toItem("Rente AVS (conjoint)", benefits.spouse.annual, "AVS")]
      : []),
    ...benefits.children.map((c) => toItem(c.label, c.annual, "AVS")),
  ];

  // Pilier 2 : LPP projeté
  const lpp = projectClientLPP(b);
  const pillar2Items: ConsolidatedItem[] = [];
  if (lpp && lpp.annualPension > 0) {
    pillar2Items.push(toItem("Rente LPP vieillesse", lpp.annualPension, "LPP"));
  }

  // Pilier 3a : capital projeté annualisé sur 22 ans (espérance de vie post-retraite)
  const p3a = projectClient3a(b);
  if (p3a && p3a.projectedCapitalAt65 > 0) {
    const annualized = Math.round(p3a.projectedCapitalAt65 / 22);
    pillar2Items.push(
      toItem("3a (capital projeté ÷ 22 ans)", annualized, "LPP"),
    );
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;

  const notes: string[] = [];
  if (avs.cappedCouple) notes.push("Rente couple plafonnée à 150 % du maximum individuel.");
  if (benefits.cappedFamily) notes.push("Rentes familiales plafonnées (150 %).");
  if (!lpp) notes.push("Aucune projection LPP disponible (avoir et salaire manquants).");
  if (p3a) notes.push("3a annualisé sur 22 ans à titre indicatif (capital en pratique).");

  return {
    event: "retirement",
    pillar1: { items: pillar1Items, totalAnnual: p1Total, cappedFamily: benefits.cappedFamily },
    pillar2: { items: pillar2Items, totalAnnual: p2Total },
    combinedAnnual: combined,
    combinedMonthly: Math.round(combined / 12),
    notes,
  };
}

// ────────────────────────────────────────────────────────────
// INVALIDITÉ
// ────────────────────────────────────────────────────────────

function buildDisability(b: ClientBundle, disabilityPct = 100): ConsolidatedScenario | null {
  const birthYear = getBirthYear(b.client.date_of_birth);
  if (!birthYear) return null;
  const age = ageFromDob(b.client.date_of_birth);
  if (age === null) return null;
  const avgIncome =
    Number(b.client.gross_annual_salary ?? 0) + Number(b.client.bonus ?? 0);
  if (avgIncome <= 0) return null;

  const currentYear = new Date().getFullYear();
  const contributionStartYear = birthYear + 21;
  // Rente AI = rente vieillesse calculée comme si la carrière s'arrêtait aujourd'hui
  const aiBaseline = projectAvsPension({
    status: "single",
    primary: {
      birthYear,
      gender: (b.client.gender as Gender | null) ?? null,
      contributionStartYear,
      retirementYear: currentYear,
      averageAnnualIncome: avgIncome,
    },
  });

  const childrenCount = parseChildren(b.client.children).length;
  const benefits: AvsDisabilityBenefits = buildDisabilityBenefits({
    primaryTheoreticalAnnual: aiBaseline.primary.theoreticalAnnualPension,
    primaryFullReducedAnnual: aiBaseline.primary.annualPension,
    disabilityPct,
    childrenCount,
    childLabels: childLabelsFromBundle(b).map((n) => `Rente enfant AI · ${n}`),
  });

  const pillar1Items: ConsolidatedItem[] = [
    toItem(benefits.primary.label, benefits.primary.annual, "AI"),
    ...benefits.children.map((c) => toItem(c.label, c.annual, "AI")),
  ];

  // Pilier 2, rente d'invalidité LPP
  // Approximation : 6,8% × capital projeté à la retraite × taux invalidité.
  // (la rente AI LPP officielle est basée sur l'avoir prévisionnel à 65 ans
  // multiplié par le taux de conversion légal, cf. art. 24 LPP.)
  const lpp = projectClientLPP(b);
  const pillar2Items: ConsolidatedItem[] = [];
  if (lpp && lpp.projectedCapitalAt65 > 0) {
    const conversionRate = lpp.assumptions.conversionRate / 100;
    const fullDisabilityPension = lpp.projectedCapitalAt65 * conversionRate;
    const proratized = Math.round(fullDisabilityPension * (disabilityPct / 100));
    pillar2Items.push(toItem(`Rente invalidité LPP (${disabilityPct} %)`, proratized, "LPP"));
    // Rente d'enfant LPP = 20% de la rente invalidité LPP, par enfant
    for (let i = 0; i < childrenCount; i++) {
      const childAnn = Math.round(proratized * 0.2);
      pillar2Items.push(
        toItem(
          `Rente enfant LPP · ${childLabelsFromBundle(b)[i] ?? `Enfant ${i + 1}`}`,
          childAnn,
          "LPP",
        ),
      );
    }
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;
  const notes: string[] = [];
  if (benefits.cappedFamily) notes.push("Rentes AI plafonnées à 150 % du maximum.");
  notes.push(
    "Estimation : la rente AI réelle dépend de l'évaluation OAI (degré, gain assuré).",
  );

  return {
    event: "disability",
    pillar1: { items: pillar1Items, totalAnnual: p1Total, cappedFamily: benefits.cappedFamily },
    pillar2: { items: pillar2Items, totalAnnual: p2Total },
    combinedAnnual: combined,
    combinedMonthly: Math.round(combined / 12),
    notes,
  };
}

// ────────────────────────────────────────────────────────────
// DÉCÈS
// ────────────────────────────────────────────────────────────

function buildDeath(b: ClientBundle): ConsolidatedScenario | null {
  const avgIncome =
    Number(b.client.gross_annual_salary ?? 0) + Number(b.client.bonus ?? 0);
  if (avgIncome <= 0) return null;

  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  const childrenCount = parseChildren(b.client.children).length;
  const deceasedTheoretical = theoreticalAnnualPension(avgIncome);

  const benefits: AvsSurvivorBenefits = buildSurvivorBenefits({
    deceasedTheoreticalAnnual: deceasedTheoretical,
    hasSurvivingSpouse: isCouple,
    childrenCount,
    childLabels: childLabelsFromBundle(b).map((n) => `Orphelin · ${n}`),
  });

  const pillar1Items: ConsolidatedItem[] = [];
  if (benefits.widow)
    pillar1Items.push(toItem("Rente veuf/veuve (AVS)", benefits.widow.annual, "AVS"));
  for (const o of benefits.orphans) pillar1Items.push(toItem(o.label, o.annual, "AVS"));

  // Pilier 2 LPP : conjoint survivant = 60% rente AI, orphelin = 20%.
  const lpp = projectClientLPP(b);
  const pillar2Items: ConsolidatedItem[] = [];
  if (lpp && lpp.projectedCapitalAt65 > 0) {
    const conversionRate = lpp.assumptions.conversionRate / 100;
    const fullAiPension = lpp.projectedCapitalAt65 * conversionRate;
    if (isCouple) {
      pillar2Items.push(
        toItem("Rente survivant LPP (60 % AI)", Math.round(fullAiPension * 0.6), "LPP"),
      );
    }
    for (let i = 0; i < childrenCount; i++) {
      pillar2Items.push(
        toItem(
          `Rente orphelin LPP · ${childLabelsFromBundle(b)[i] ?? `Enfant ${i + 1}`}`,
          Math.round(fullAiPension * 0.2),
          "LPP",
        ),
      );
    }
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;
  const notes: string[] = [];
  if (benefits.cappedFamily) notes.push("Rentes survivants AVS plafonnées (150 %).");
  notes.push(
    "Les conditions d'âge / d'enfants à charge influent sur l'ouverture du droit (veuf/veuve).",
  );

  return {
    event: "death",
    pillar1: { items: pillar1Items, totalAnnual: p1Total, cappedFamily: benefits.cappedFamily },
    pillar2: { items: pillar2Items, totalAnnual: p2Total },
    combinedAnnual: combined,
    combinedMonthly: Math.round(combined / 12),
    notes,
  };
}

// ────────────────────────────────────────────────────────────
// Entrée publique
// ────────────────────────────────────────────────────────────

export function consolidatePensionBenefits(b: ClientBundle): ConsolidatedBenefits {
  return {
    retirement: buildRetirement(b),
    disability: buildDisability(b, 100),
    death: buildDeath(b),
  };
}

/**
 * Variante "optimisée" du même bundle :
 * - LPP : saturation de la capacité de rachat restante (étalée linéairement
 *   jusqu'à la retraite via le mécanisme existant de `lpp_planned_buybacks`).
 * - 3a : cotisation portée au plafond légal salarié LPP (7 258 CHF, 2026)
 *   si la cotisation actuelle est inférieure.
 *
 * Aucune modification persistée : on construit un bundle virtuel.
 */
export function consolidateOptimizedBenefits(b: ClientBundle): ConsolidatedBenefits {
  return consolidatePensionBenefits(buildOptimizedBundle(b));
}

function buildOptimizedBundle(b: ClientBundle): ClientBundle {
  const pension = (b.pension ?? {}) as Record<string, unknown> & {
    lpp_planned_buybacks?: unknown;
    lpp_max_buyback?: number | string | null;
    pillar_3a_annual_contribution?: number | string | null;
  };

  const buybackCapacity = Number(pension.lpp_max_buyback ?? 0);
  const existingPlanned = Array.isArray(pension.lpp_planned_buybacks)
    ? (pension.lpp_planned_buybacks as Array<{ amount?: number }>)
    : [];
  const plannedTotal = existingPlanned.reduce(
    (s, r) => s + Number(r?.amount ?? 0),
    0,
  );
  const remaining = Math.max(0, buybackCapacity - plannedTotal);

  const optimizedPlanned =
    remaining > 0
      ? [
          ...existingPlanned,
          {
            year: new Date().getFullYear(),
            amount: remaining,
            label: "Saturation capacité (optimisation)",
          },
        ]
      : existingPlanned;

  const current3a = Number(pension.pillar_3a_annual_contribution ?? 0);
  const optimized3a = Math.max(current3a, PILLAR_3A_MAX_LPP);

  return {
    ...b,
    pension: {
      ...(b.pension as object),
      lpp_planned_buybacks: optimizedPlanned,
      pillar_3a_annual_contribution: optimized3a,
    } as ClientBundle["pension"],
  };
}

/**
 * Hypothèses de la simulation "optimisée", à afficher au courtier
 * pour expliquer pourquoi le 2e pilier bouge entre actuel et projeté.
 * Ne modifie rien, lecture seule.
 */
export interface OptimizationAssumptions {
  lppBuybackAmount: number;
  pillar3aCurrent: number;
  pillar3aOptimized: number;
  pillar3aIncreased: boolean;
}

export function getOptimizationAssumptions(b: ClientBundle): OptimizationAssumptions {
  const pension = (b.pension ?? {}) as Record<string, unknown> & {
    lpp_planned_buybacks?: unknown;
    lpp_max_buyback?: number | string | null;
    pillar_3a_annual_contribution?: number | string | null;
  };

  const buybackCapacity = Number(pension.lpp_max_buyback ?? 0);
  const existingPlanned = Array.isArray(pension.lpp_planned_buybacks)
    ? (pension.lpp_planned_buybacks as Array<{ amount?: number }>)
    : [];
  const plannedTotal = existingPlanned.reduce(
    (s, r) => s + Number(r?.amount ?? 0),
    0,
  );
  const lppBuybackAmount = Math.max(0, buybackCapacity - plannedTotal);

  const pillar3aCurrent = Number(pension.pillar_3a_annual_contribution ?? 0);
  const pillar3aOptimized = Math.max(pillar3aCurrent, PILLAR_3A_MAX_LPP);

  return {
    lppBuybackAmount,
    pillar3aCurrent,
    pillar3aOptimized,
    pillar3aIncreased: pillar3aOptimized > pillar3aCurrent,
  };
}

export const PENSION_EVENT_LABELS: Record<PensionEvent, string> = {
  retirement: "Vieillesse",
  disability: "Invalidité",
  death: "Décès",
};

export { AVS_2026 };