// src/lib/pension-consolidation.ts
// Consolidation 1er + 2e pilier, vision globale des prestations futures
// pour les 3 événements clés : retraite, invalidité, décès.
//
// Source de vérité unique réutilisée par :
// - la carte « Prestations consolidées » de la fiche client
// - le PDF de synthèse
//
// Règle stricte (cf. audit) : la situation "actuelle" doit reprendre les
// résultats réellement enregistrés par le courtier (simulation_history),
// jamais un recalcul indépendant qui peut diverger de ce qui est affiché
// ailleurs dans l'app / le PDF pour le même client. Priorité des sources,
// du plus fiable au moins fiable :
//   1. Rente/capital du certificat de prévoyance, saisi à la main dans le
//      calculateur LPP (le plus fiable : c'est le chiffre officiel de la
//      caisse de pension).
//   2. Résultat de la dernière simulation sauvegardée pour ce client
//      (même sélection que le reste du PDF : voir pickLatestNonDismissed).
//   3. À défaut de toute simulation sauvegardée, une estimation calculée
//      ici à partir des données brutes de la fiche — TOUJOURS signalée
//      comme telle via `notes`, jamais présentée comme un résultat.
//
// Pour les sous-modules concernés :
// - AVS/AI : src/lib/avs (rentes vieillesse, AI, enfants, survivants)
// - LPP : src/lib/client-dashboard/lpp-projection (avoir projeté + rente),
//   utilisé uniquement en repli (source 3 ci-dessus).

import type { ClientBundle } from "@/lib/client-dashboard";
import { ageFromDob, parseChildren } from "@/lib/clients/types";
import { getTotalGrossIncome } from "@/lib/clients/income";
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
import { pickLatestNonDismissed } from "@/lib/simulations/extract-gain";
import type { HistoryEntry } from "@/lib/history/types";

export type PensionEvent = "retirement" | "disability" | "death";

export interface ConsolidatedItem {
  label: string;
  annual: number;
  monthly: number;
  pillar: "AVS" | "AI" | "LPP" | "3A";
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

/**
 * Simulations de référence (une par pilier) à utiliser comme source des
 * chiffres "actuels" : la dernière sauvegarde active de chaque kind pour ce
 * client, exactement le même choix que celui déjà fait ailleurs dans le PDF
 * (Résumé par catégorie, Comparatif avant/après — pickLatestNonDismissed).
 * Passer `null`/`undefined` pour un pilier revient à forcer l'estimation de
 * repli (signalée) pour ce pilier uniquement.
 */
export interface ConsolidationReferenceSimulations {
  avsAi?: HistoryEntry | null;
  lpp?: HistoryEntry | null;
  pillar3a?: HistoryEntry | null;
}

/** Sélectionne, parmi une liste de simulations déjà chargées pour un client
 *  (ex. celles incluses dans un export PDF), les références 1er/2e/3e pilier
 *  — même critère que le reste du document (pickLatestNonDismissed). */
export function pickConsolidationReferences(
  entries: HistoryEntry[],
): ConsolidationReferenceSimulations {
  return {
    avsAi: pickLatestNonDismissed(entries, "avs_ai") ?? null,
    lpp: pickLatestNonDismissed(entries, "lpp") ?? null,
    pillar3a: pickLatestNonDismissed(entries, "pillar3a") ?? null,
  };
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
  pillar: "AVS" | "AI" | "LPP" | "3A",
): ConsolidatedItem {
  return { label, annual, monthly: Math.round(annual / 12), pillar };
}

function childLabelsFromBundle(b: ClientBundle): string[] {
  return parseChildren(b.client.children).map(
    (c, i) => c.first_name?.trim() || `Enfant ${i + 1}`,
  );
}

interface CertificatePensions {
  oldAge?: number;
  disability?: number;
  /** Rente d'enfant de retraité (versée en plus de la rente de vieillesse),
   *  montant PAR ENFANT — distincte de la rente d'orphelin. */
  child?: number;
  orphan?: number;
  widow?: number;
}

/** Lit les rentes du certificat de prévoyance saisies à la main dans le
 *  calculateur LPP (CertificatePensionsCard), si la simulation de référence
 *  en contient — source la plus fiable (chiffre officiel de la caisse). */
function certificatePensionsFromRef(
  ref: HistoryEntry | null | undefined,
): CertificatePensions | null {
  const raw = (ref?.summary as Record<string, unknown> | undefined)?.certificateAnnualPensions;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: CertificatePensions = {};
  if (Number(r.oldAge) > 0) out.oldAge = Number(r.oldAge);
  if (Number(r.disability) > 0) out.disability = Number(r.disability);
  if (Number(r.child) > 0) out.child = Number(r.child);
  if (Number(r.orphan) > 0) out.orphan = Number(r.orphan);
  if (Number(r.widow) > 0) out.widow = Number(r.widow);
  return Object.keys(out).length > 0 ? out : null;
}

interface LppRefFigures {
  projectedBalance: number;
  annualPension: number;
  /** Taux de conversion implicitement utilisé par CETTE simulation
   *  (annualPension / projectedBalance), pour rester cohérent avec les
   *  hypothèses réellement retenues au moment de la sauvegarde plutôt que
   *  de réappliquer un taux par défaut différent. */
  impliedConversionRate: number;
}

function lppRefFigures(ref: HistoryEntry | null | undefined): LppRefFigures | null {
  const s = ref?.summary as Record<string, unknown> | undefined;
  if (!s) return null;
  const projectedBalance = Number(s.projectedBalance ?? 0);
  const annualPension = Number(s.annualPension ?? 0);
  if (projectedBalance <= 0) return null;
  const impliedConversionRate = annualPension > 0 ? annualPension / projectedBalance : 0.06;
  return { projectedBalance, annualPension, impliedConversionRate };
}

function pillar3aRefBalance(ref: HistoryEntry | null | undefined): number | null {
  const s = ref?.summary as Record<string, unknown> | undefined;
  const finalBalance = Number(s?.finalBalance ?? 0);
  return finalBalance > 0 ? finalBalance : null;
}

function avsRefFigures(
  ref: HistoryEntry | null | undefined,
): { theoreticalAnnualPension: number; annualPension: number } | null {
  const s = ref?.summary as Record<string, unknown> | undefined;
  const annualPension = Number(s?.annualPension ?? 0);
  if (annualPension <= 0) return null;
  const theoreticalAnnualPension = Number(s?.theoreticalAnnualPension ?? annualPension);
  return { theoreticalAnnualPension, annualPension };
}

/** Facteur d'évolution "optimisé / actuel" du moteur de projection live,
 *  utilisé uniquement pour extrapoler un scénario optimisé à partir d'un
 *  chiffre actuel réel (issu d'une simulation sauvegardée) — jamais pour
 *  remplacer le chiffre actuel lui-même. */
function growthFactor(current: number, optimized: number): number {
  if (!(current > 0)) return 1;
  return optimized / current;
}

// ────────────────────────────────────────────────────────────
// VIEILLESSE
// ────────────────────────────────────────────────────────────

function buildRetirement(
  b: ClientBundle,
  refs: ConsolidationReferenceSimulations | undefined,
  optimizedBundle?: ClientBundle,
): ConsolidatedScenario | null {
  const birthYear = getBirthYear(b.client.date_of_birth);
  if (!birthYear) return null;
  const gender = (b.client.gender as Gender | null) ?? null;
  const referenceAge = getReferenceAge(birthYear, gender);
  const retirementYear = birthYear + Math.round(referenceAge);
  const contributionStartYear = birthYear + 21;

  // Revenu total (salaire + bonus + autres revenus), même source que le
  // reste de l'app (src/lib/clients/income.ts) : une formule locale
  // n'incluant que salaire+bonus divergerait silencieusement pour un
  // client ayant d'autres revenus déclarés.
  const avgIncome = getTotalGrossIncome(b.client);
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

  const notes: string[] = [];

  // 1er pilier : priorité à la simulation "Rente AVS/AI" réellement
  // sauvegardée pour ce client (même chiffre que la page dédiée du PDF),
  // repli sur l'estimation live si aucune n'existe.
  const avsRef = avsRefFigures(refs?.avsAi);
  const primaryTheoreticalAnnual = avsRef?.theoreticalAnnualPension ?? avs.primary.theoreticalAnnualPension;
  const primaryReducedAnnual = avsRef?.annualPension ?? avs.primary.annualPension;
  if (!avsRef) {
    notes.push(
      "Rente AVS estimée : aucune simulation « Rente AVS/AI » enregistrée pour ce client — enregistrez-en une (et marquez-la « Situation actuelle ») pour remplacer cette estimation par le résultat réel.",
    );
  }

  const childrenCount = parseChildren(b.client.children).length;
  const benefits: AvsRetirementBenefits = buildRetirementBenefits({
    primaryTheoreticalAnnual,
    primaryReducedAnnual,
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

  // Pilier 2 : LPP — certificat > simulation sauvegardée > estimation live.
  const pillar2Items: ConsolidatedItem[] = [];
  const cert = certificatePensionsFromRef(refs?.lpp);
  const lppRef = lppRefFigures(refs?.lpp);
  let lppAnnual = 0;
  if (cert?.oldAge) {
    lppAnnual = cert.oldAge;
    pillar2Items.push(toItem("Rente LPP vieillesse (certificat)", lppAnnual, "LPP"));
  } else if (lppRef) {
    lppAnnual = lppRef.annualPension;
    if (lppAnnual > 0) pillar2Items.push(toItem("Rente LPP vieillesse", lppAnnual, "LPP"));
  } else {
    const lpp = projectClientLPP(b);
    if (lpp && lpp.annualPension > 0) {
      lppAnnual = lpp.annualPension;
      pillar2Items.push(toItem("Rente LPP vieillesse", lppAnnual, "LPP"));
    }
    if (!lpp) notes.push("Aucune projection LPP disponible (avoir et salaire manquants).");
    else
      notes.push(
        "Rente LPP estimée : aucune simulation « LPP & rachats » enregistrée pour ce client — enregistrez-en une (et marquez-la « Situation actuelle ») pour remplacer cette estimation par le résultat réel.",
      );
  }

  // Rente d'enfant de retraité (LPP) : saisie manuelle uniquement (certificat),
  // aucune approximation live — pas de formule officielle équivalente à celle
  // de l'invalidité/décès pour ce cas.
  if (cert?.child) {
    for (let i = 0; i < childrenCount; i++) {
      pillar2Items.push(
        toItem(
          `Rente enfant LPP (certificat) · ${childLabelsFromBundle(b)[i] ?? `Enfant ${i + 1}`}`,
          cert.child,
          "LPP",
        ),
      );
    }
  }

  // Pilier 3a : rente de vieillesse = capital final ÷ 25 ans ÷ 12 (même
  // hypothèse partout dans l'app, voir PILLAR3A_OLD_AGE_ANNUITY_YEARS dans
  // pillar3a.tsx) — reprend le montant déjà calculé et sauvegardé par le
  // calculateur 3e pilier quand disponible, plutôt que de le recalculer ici
  // à partir d'un capital potentiellement différent.
  const p3aRefBalance = pillar3aRefBalance(refs?.pillar3a);
  const p3aRefMonthlyPension = Number(
    (refs?.pillar3a?.summary as Record<string, unknown> | undefined)?.oldAgeMonthlyPension ?? 0,
  );
  let p3aBalance = 0;
  if (p3aRefBalance) {
    p3aBalance = p3aRefBalance;
  } else {
    const p3a = projectClient3a(b);
    if (p3a && p3a.projectedCapitalAt65 > 0) {
      p3aBalance = p3a.projectedCapitalAt65;
      notes.push(
        "Rente de vieillesse 3a estimée (capital projeté ÷ 25 ans ÷ 12) : aucune simulation « Pilier 3a » enregistrée pour ce client.",
      );
    }
  }
  if (p3aRefMonthlyPension > 0) {
    pillar2Items.push(toItem("3a (rente de vieillesse, capital ÷ 25 ans)", p3aRefMonthlyPension * 12, "3A"));
    notes.push("3a exprimé en rente pour comparaison (capital ÷ 25 ans) : en pratique, le 3e pilier est généralement retiré en capital, pas versé sous forme de rente.");
  } else if (p3aBalance > 0) {
    pillar2Items.push(toItem("3a (rente de vieillesse, capital ÷ 25 ans)", Math.round(p3aBalance / 25), "3A"));
    notes.push("3a exprimé en rente pour comparaison (capital ÷ 25 ans) : en pratique, le 3e pilier est généralement retiré en capital, pas versé sous forme de rente.");
  }

  // Rachats planifiés : n'affiche la note d'étalement que si on est bien
  // parti de la fiche (repli), pas d'une simulation sauvegardée qui a déjà
  // son propre étalement affiché sur sa page dédiée.
  if (!lppRef) {
    const lpp = projectClientLPP(b);
    if (lpp && lpp.plannedBuybacksTotal > 0) {
      notes.push(
        `Rachat LPP planifié (${Math.round(lpp.plannedBuybacksTotal).toLocaleString("fr-CH")} CHF) réparti par défaut sur toutes les années restantes jusqu'à la retraite. Une simulation LPP dédiée peut tester un étalement plus court (par exemple 3 ans) et affichera alors un capital différent, ce qui est normal.`,
      );
    }
  }

  if (avs.cappedCouple) notes.push("Rente couple plafonnée à 150 % du maximum individuel.");
  if (benefits.cappedFamily) notes.push("Rentes familiales plafonnées (150 %).");

  // Scénario optimisé (si demandé) : on garde le chiffre actuel réel comme
  // ancrage et on lui applique le facteur d'évolution du moteur de
  // projection live (actuel recalculé vs optimisé recalculé), plutôt que
  // de partir d'un recalcul indépendant qui ignorerait la simulation
  // sauvegardée. Voir consolidateOptimizedBenefits.
  if (optimizedBundle) {
    const liveCurrentLpp = projectClientLPP(b);
    const liveOptimizedLpp = projectClientLPP(optimizedBundle);
    // Jamais d'extrapolation sur un montant du certificat (cert.oldAge) :
    // c'est un chiffre officiel de la caisse, on ne le fait pas "comme si"
    // évoluer avec un facteur de croissance qu'elle seule pourrait confirmer.
    if (lppAnnual > 0 && liveCurrentLpp && liveOptimizedLpp && !cert?.oldAge) {
      const factor = growthFactor(liveCurrentLpp.annualPension, liveOptimizedLpp.annualPension);
      const idx = pillar2Items.findIndex((i) => i.pillar === "LPP");
      if (idx >= 0) pillar2Items[idx] = toItem(pillar2Items[idx].label, Math.round(lppAnnual * factor), "LPP");
    }
    const liveCurrent3a = projectClient3a(b);
    const liveOptimized3a = projectClient3a(optimizedBundle);
    if (p3aBalance > 0 && liveCurrent3a && liveOptimized3a) {
      const factor = growthFactor(liveCurrent3a.projectedCapitalAt65, liveOptimized3a.projectedCapitalAt65);
      const idx = pillar2Items.findIndex((i) => i.pillar === "3A");
      if (idx >= 0) {
        const optimizedBalance = p3aBalance * factor;
        pillar2Items[idx] = toItem(pillar2Items[idx].label, Math.round(optimizedBalance / 25), "3A");
      }
    }
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;

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

function buildDisability(
  b: ClientBundle,
  refs: ConsolidationReferenceSimulations | undefined,
  disabilityPct = 100,
  optimizedBundle?: ClientBundle,
): ConsolidatedScenario | null {
  const birthYear = getBirthYear(b.client.date_of_birth);
  if (!birthYear) return null;
  const age = ageFromDob(b.client.date_of_birth);
  if (age === null) return null;
  // Revenu total (salaire + bonus + autres revenus), même source que le
  // reste de l'app (src/lib/clients/income.ts) : une formule locale
  // n'incluant que salaire+bonus divergerait silencieusement pour un
  // client ayant d'autres revenus déclarés.
  const avgIncome = getTotalGrossIncome(b.client);
  if (avgIncome <= 0) return null;

  // Rente AI (1er pilier) : aucun calculateur dédié ne produit ce chiffre
  // (le calculateur "Rente AVS/AI" ne couvre que la vieillesse) — reste
  // calculée ici, comme si la carrière s'arrêtait aujourd'hui.
  const currentYear = new Date().getFullYear();
  const contributionStartYear = birthYear + 21;
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

  // Pilier 2, rente d'invalidité LPP : certificat (chiffre officiel de la
  // caisse) > simulation LPP sauvegardée (capital réel × taux de conversion
  // réellement utilisé) > estimation live.
  const notes: string[] = [];
  const pillar2Items: ConsolidatedItem[] = [];
  const cert = certificatePensionsFromRef(refs?.lpp);
  const lppRef = lppRefFigures(refs?.lpp);
  let proratized = 0;
  if (cert?.disability) {
    proratized = Math.round(cert.disability * (disabilityPct / 100));
    pillar2Items.push(toItem(`Rente invalidité LPP (certificat, ${disabilityPct} %)`, proratized, "LPP"));
  } else if (lppRef) {
    const fullDisabilityPension = lppRef.projectedBalance * lppRef.impliedConversionRate;
    proratized = Math.round(fullDisabilityPension * (disabilityPct / 100));
    pillar2Items.push(toItem(`Rente invalidité LPP (${disabilityPct} %)`, proratized, "LPP"));
  } else {
    const lpp = projectClientLPP(b);
    if (lpp && lpp.projectedCapitalAt65 > 0) {
      const conversionRate = lpp.assumptions.conversionRate / 100;
      const fullDisabilityPension = lpp.projectedCapitalAt65 * conversionRate;
      proratized = Math.round(fullDisabilityPension * (disabilityPct / 100));
      pillar2Items.push(toItem(`Rente invalidité LPP (${disabilityPct} %)`, proratized, "LPP"));
      notes.push(
        "Rente invalidité LPP estimée : approximation (capital projeté × taux de conversion), aucune simulation « LPP & rachats » enregistrée pour ce client, ni montant de certificat saisi.",
      );
    }
  }
  if (proratized > 0) {
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

  if (optimizedBundle && proratized > 0 && !cert?.disability) {
    const liveCurrentLpp = projectClientLPP(b);
    const liveOptimizedLpp = projectClientLPP(optimizedBundle);
    if (liveCurrentLpp && liveOptimizedLpp) {
      const factor = growthFactor(liveCurrentLpp.projectedCapitalAt65, liveOptimizedLpp.projectedCapitalAt65);
      for (let i = 0; i < pillar2Items.length; i++) {
        pillar2Items[i] = toItem(pillar2Items[i].label, Math.round(pillar2Items[i].annual * factor), "LPP");
      }
    }
  }

  // Rente d'invalidité 3e pilier (police liée, le cas échéant) — saisie
  // manuelle uniquement (pillar3a.tsx), jamais recalculée ni extrapolée
  // vers le scénario optimisé, ajoutée après la boucle de mise à l'échelle
  // ci-dessus pour ne surtout pas être rescalée avec le facteur LPP.
  const p3aDisability = Number(
    (refs?.pillar3a?.summary as Record<string, unknown> | undefined)?.disabilityAnnualPension ?? 0,
  );
  if (p3aDisability > 0) {
    pillar2Items.push(toItem("Rente invalidité 3e pilier", p3aDisability, "3A"));
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;
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

function buildDeath(
  b: ClientBundle,
  refs: ConsolidationReferenceSimulations | undefined,
  optimizedBundle?: ClientBundle,
): ConsolidatedScenario | null {
  // Revenu total (salaire + bonus + autres revenus), même source que le
  // reste de l'app (src/lib/clients/income.ts) : une formule locale
  // n'incluant que salaire+bonus divergerait silencieusement pour un
  // client ayant d'autres revenus déclarés.
  const avgIncome = getTotalGrossIncome(b.client);
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
  // Certificat > simulation sauvegardée > estimation live.
  const notes: string[] = [];
  const pillar2Items: ConsolidatedItem[] = [];
  const cert = certificatePensionsFromRef(refs?.lpp);
  const lppRef = lppRefFigures(refs?.lpp);
  // fullAiPension sert de base à la rente d'orphelin (20 %) quand aucun
  // montant de certificat dédié n'est saisi pour elle — calculée séparément
  // du choix de source pour la rente de veuf/veuve ci-dessous : un client
  // dont seul le certificat "veuf/veuve" a été saisi (sans montant
  // "orphelin" distinct) doit quand même obtenir une estimation d'orphelin
  // au lieu de 0.
  let fullAiPension = 0;
  if (lppRef) {
    fullAiPension = lppRef.projectedBalance * lppRef.impliedConversionRate;
  } else {
    const lpp = projectClientLPP(b);
    if (lpp && lpp.projectedCapitalAt65 > 0) {
      const conversionRate = lpp.assumptions.conversionRate / 100;
      fullAiPension = lpp.projectedCapitalAt65 * conversionRate;
    }
  }

  // Index des lignes sourcées du certificat (jamais extrapolées vers le
  // scénario optimisé ci-dessous) — suivies individuellement : la rente de
  // veuf/veuve et celle d'orphelin peuvent avoir des sources différentes
  // (l'une du certificat, l'autre estimée), ce qu'un simple booléen global
  // ne peut pas représenter correctement.
  const certificateSourcedIndices = new Set<number>();
  if (isCouple && cert?.widow) {
    certificateSourcedIndices.add(pillar2Items.length);
    pillar2Items.push(toItem("Rente survivant LPP (certificat)", cert.widow, "LPP"));
  } else if (isCouple && fullAiPension > 0) {
    pillar2Items.push(
      toItem("Rente survivant LPP (60 % AI)", Math.round(fullAiPension * 0.6), "LPP"),
    );
    if (!lppRef) {
      notes.push(
        "Rentes LPP survivants estimées : approximation (capital projeté × taux de conversion), aucune simulation « LPP & rachats » enregistrée pour ce client, ni montant de certificat saisi.",
      );
    }
  }
  if (!cert?.orphan && fullAiPension > 0 && !lppRef && childrenCount > 0) {
    notes.push(
      "Rente d'orphelin LPP estimée : approximation (capital projeté × taux de conversion), aucune simulation « LPP & rachats » enregistrée pour ce client, ni montant de certificat saisi.",
    );
  }
  for (let i = 0; i < childrenCount; i++) {
    const orphanAnnual = cert?.orphan
      ? cert.orphan
      : fullAiPension > 0
        ? Math.round(fullAiPension * 0.2)
        : 0;
    if (orphanAnnual > 0) {
      if (cert?.orphan) certificateSourcedIndices.add(pillar2Items.length);
      pillar2Items.push(
        toItem(
          `Rente orphelin LPP · ${childLabelsFromBundle(b)[i] ?? `Enfant ${i + 1}`}`,
          orphanAnnual,
          "LPP",
        ),
      );
    }
  }

  if (optimizedBundle && pillar2Items.length > certificateSourcedIndices.size) {
    const liveCurrentLpp = projectClientLPP(b);
    const liveOptimizedLpp = projectClientLPP(optimizedBundle);
    if (liveCurrentLpp && liveOptimizedLpp) {
      const factor = growthFactor(liveCurrentLpp.projectedCapitalAt65, liveOptimizedLpp.projectedCapitalAt65);
      for (let i = 0; i < pillar2Items.length; i++) {
        if (certificateSourcedIndices.has(i)) continue;
        pillar2Items[i] = toItem(pillar2Items[i].label, Math.round(pillar2Items[i].annual * factor), "LPP");
      }
    }
  }

  const p1Total = benefits.totalAnnual;
  const p2Total = pillar2Items.reduce((s, i) => s + i.annual, 0);
  const combined = p1Total + p2Total;
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
// Capitaux (2e + 3e pilier), pour l'onglet Consolidation
// ────────────────────────────────────────────────────────────

export interface ConsolidatedCapitals {
  lppCurrentBalance: number;
  /** Capital LPP projeté à la retraite — simulation sauvegardée si
   *  disponible, sinon estimation live (voir `lppProjectedIsEstimate`). */
  lppProjectedCapital: number;
  lppProjectedIsEstimate: boolean;
  /** Rachats LPP cumulés (simulation sauvegardée uniquement — 0 si aucune). */
  lppBuybacksTotal: number;
  /** Capital 3e pilier projeté — simulation sauvegardée si disponible,
   *  sinon estimation live (voir `pillar3aProjectedIsEstimate`). */
  pillar3aProjectedCapital: number;
  pillar3aProjectedIsEstimate: boolean;
}

/** Capitaux 2e/3e pilier à afficher tels quels dans l'onglet Consolidation
 *  (point 4 de l'audit) — mêmes sources que les rentes ci-dessus : simulation
 *  sauvegardée en priorité, estimation live en repli (signalée). */
export function getConsolidatedCapitals(
  b: ClientBundle,
  refs?: ConsolidationReferenceSimulations,
): ConsolidatedCapitals {
  const lppRef = lppRefFigures(refs?.lpp);
  const lppSummary = refs?.lpp?.summary as Record<string, unknown> | undefined;
  const p3aBalance = pillar3aRefBalance(refs?.pillar3a);

  const lppProjectedIsEstimate = !lppRef;
  const lppProjectedCapital = lppRef?.projectedBalance ?? projectClientLPP(b)?.projectedCapitalAt65 ?? 0;

  const pillar3aProjectedIsEstimate = !p3aBalance;
  const pillar3aProjectedCapital = p3aBalance ?? projectClient3a(b)?.projectedCapitalAt65 ?? 0;

  return {
    lppCurrentBalance: Number(b.pension?.lpp_current_balance ?? 0),
    lppProjectedCapital,
    lppProjectedIsEstimate,
    lppBuybacksTotal: lppRef ? Number(lppSummary?.totalBuybacks ?? 0) : 0,
    pillar3aProjectedCapital,
    pillar3aProjectedIsEstimate,
  };
}

// ────────────────────────────────────────────────────────────
// Entrée publique
// ────────────────────────────────────────────────────────────

export function consolidatePensionBenefits(
  b: ClientBundle,
  refs?: ConsolidationReferenceSimulations,
): ConsolidatedBenefits {
  return {
    retirement: buildRetirement(b, refs),
    disability: buildDisability(b, refs, 100),
    death: buildDeath(b, refs),
  };
}

/**
 * Variante "optimisée" du même bundle :
 * - LPP : saturation de la capacité de rachat restante (étalée linéairement
 *   jusqu'à la retraite via le mécanisme existant de `lpp_planned_buybacks`).
 * - 3a : cotisation portée au plafond légal salarié LPP (7 258 CHF, 2026)
 *   si la cotisation actuelle est inférieure.
 *
 * Les montants "actuels" restent ceux de `refs` (simulations réellement
 * sauvegardées) quand elles existent ; seul l'écart "optimisé" est
 * extrapolé à partir du moteur de projection live, appliqué en facteur
 * d'évolution sur ce chiffre actuel réel — jamais un recalcul autonome qui
 * ignorerait la simulation sauvegardée. Aucune modification persistée : on
 * construit un bundle virtuel.
 */
export function consolidateOptimizedBenefits(
  b: ClientBundle,
  refs?: ConsolidationReferenceSimulations,
): ConsolidatedBenefits {
  const optimizedBundle = buildOptimizedBundle(b);
  return {
    retirement: buildRetirement(b, refs, optimizedBundle),
    disability: buildDisability(b, refs, 100, optimizedBundle),
    death: buildDeath(b, refs, optimizedBundle),
  };
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
