// Orchestrateur réactif de la fiche client.
//
// Prend un bundle client (Client + ClientPension + ClientAssets) et calcule
// SYNCHRONEMENT tous les indicateurs de prévoyance / fiscalité utiles
// au tableau de bord de la fiche.
//
// Règles :
// - Pure et synchrone : aucune I/O, aucune dépendance React.
// - Tolérant : chaque sous-bloc renvoie `null` si les données nécessaires
//   manquent. Jamais d'exception remontée à l'appelant.
// - Réutilise STRICTEMENT la logique des modules existants
//   (`@/lib/tax`, `@/lib/lpp`, `@/lib/pillar3`, `@/lib/optimizer`,
//   `@/lib/clients/work-status-rules`). Pas de duplication.

import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";
import { ageFromDob, parseChildren } from "@/lib/clients/types";
import {
  computeFortune,
  getClientTaxContext,
  toIncomeTaxInput,
  toTaxGlobalInput,
  stripUndefined,
} from "@/lib/clients/to-calculator-input";
import type { IncomeTaxInput } from "@/lib/tax/income";
import {
  annuityVsLumpSum,
  capitalWithdrawalTax,
} from "@/lib/lpp";

import {
  projectClientLPP,
  projectClient3a,
} from "./lpp-projection";
import { CANTON_SCALES } from "@/lib/tax/cantons";
import {
  effectivePillar3aCap,
  getWorkStatusRules,
} from "@/lib/clients/work-status-rules";
import { runOptimizer, type Optimization } from "@/lib/optimizer";
import { projectAvsPension, getReferenceAge, type Gender } from "@/lib/avs";
import { getTotalGrossIncome } from "@/lib/clients/income";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput } from "@/lib/tax-global/types";

export interface ClientBundle {
  client: Client;
  pension: ClientPension | null;
  assets: ClientAssets | null;
}

const RETIREMENT_AGE_DEFAULT = 65;
const LIFE_EXPECTANCY_AT_65 = 20;

// ────────────────────────────────────────────────────────────────────────────
// Sous-blocs
// ────────────────────────────────────────────────────────────────────────────

export interface DashboardTax {
  /** Charge fiscale annuelle totale (IFD + ICC + paroisse + fortune) */
  annualBurden: number;
  /** Impôt à la source mensuel estimé (si applicable) */
  monthlySourceTax: number | null;
  /** Taux marginal global (%) */
  marginalRate: number;
  /** Taux d'imposition effectif (%) */
  effectiveRate: number;
  /** Revenu brut total */
  grossIncome: number;
}

export interface DashboardLPP {
  /** Avoir LPP actuel */
  currentCapital: number;
  /** Capital LPP projeté à 65 ans */
  projectedCapitalAt65: number;
  /** Capacité de rachat LPP non exploitée */
  buybackCapacity: number;
  /** Rente annuelle estimée à la retraite */
  annualPension: number;
  /** Rente mensuelle estimée */
  monthlyPension: number;
}

export interface DashboardPillar3a {
  /** Plafond effectif applicable au client (CHF) */
  effectiveCap: number;
  /** Versement actuel renseigné dans la fiche */
  currentContribution: number;
  /** Espace 3a non utilisé (cap - actuel) */
  unusedRoom: number;
  /** Capital 3a projeté à 65 ans (avec versement actuel) */
  projectedCapitalAt65: number;
  /** Économie d'impôt approximative grâce au versement actuel */
  taxSavings: number;
}

export interface DashboardRetirement {
  /** Recommandation issue de la comparaison rente vs capital */
  recommendation: "annuity" | "lump_sum" | "mixed";
  /** Total perçu en mode rente (espérance de vie résiduelle) */
  totalAnnuity: number;
  /** Total perçu en mode capital (placé) */
  totalLumpSum: number;
}

export interface DashboardCantonRow {
  code: string;
  name: string;
  total: number;
  effectiveRate: number;
  delta: number; // vs canton actuel
}
export interface DashboardCantonCompare {
  current: { code: string; total: number };
  best3: DashboardCantonRow[];
  /** Économie max si déménagement vers le canton le moins cher (CHF/an) */
  maxSavings: number;
}

export interface DashboardAvs {
  referenceAge: number;
  retirementYear: number;
  effectiveYears: number;
  missingYears: number;
  monthlyPension: number;
  annualPension: number;
  combinedMonthlyPension?: number;
  cappedCouple: boolean;
}

export interface ClientDashboard {
  /** Indique si la fiche contient assez de données pour calculer quoi que ce soit. */
  hasEnoughData: boolean;
  age: number | null;
  yearsToRetirement: number | null;
  fortune: number;
  tax: DashboardTax | null;
  lpp: DashboardLPP | null;
  pillar3a: DashboardPillar3a | null;
  retirement: DashboardRetirement | null;
  cantonCompare: DashboardCantonCompare | null;
  avs: DashboardAvs | null;
  suggestions: Optimization[];
}

// ────────────────────────────────────────────────────────────────────────────
// Implémentation
// ────────────────────────────────────────────────────────────────────────────

// Réservé à runOptimizer(), qui attend spécifiquement un IncomeTaxInput
// (résident ordinaire) — l'optimiseur de suggestions n'est pas dans le
// périmètre de cette refonte, qui porte sur les CHIFFRES AFFICHÉS
// (tax/cantonCompare/pillar3a/retirement), voir buildTaxGlobalInput ci-dessous.
function buildOptimizerTaxInput(b: ClientBundle): IncomeTaxInput | null {
  if (!b.client.canton) return null;
  if (!CANTON_SCALES[b.client.canton]) return null;

  const partial = toIncomeTaxInput(b);
  const children = parseChildren(b.client.children);
  const fortune = computeFortune(b.assets);

  const grossSalary = partial.grossSalary ?? 0;
  if (grossSalary <= 0 && (partial.otherIncome ?? 0) <= 0) return null;

  return {
    canton: partial.canton ?? b.client.canton,
    status:
      partial.status ?? (children.some(ch => ch.in_household) ? "single_with_children" : "single"),
    confession: partial.confession ?? "other",
    children: partial.children ?? children.length,
    grossSalary,
    spouseGrossSalary: partial.spouseGrossSalary ?? 0,
    bonus: partial.bonus ?? 0,
    otherIncome: partial.otherIncome ?? 0,
    pillar3aContributions: partial.pillar3aContributions ?? 0,
    lppBuyback: 0,
    mortgageInterest: partial.mortgageInterest ?? 0,
    realEstateMaintenance: partial.realEstateMaintenance ?? 0,
    netWealth: partial.netWealth ?? fortune,
  };
}

// Source unique pour TOUS les chiffres fiscaux affichés dans la fiche
// client (charge fiscale, comparateur cantonal, taux marginal pour
// rente-vs-capital, économie 3a) : le MÊME moteur multi-régimes que le
// calculateur Fiscal Global (computeTaxGlobal), avec les MÊMES données de
// fiche (toTaxGlobalInput, déjà utilisé pour préremplir ce calculateur) et
// les mêmes valeurs par défaut pour ce qui n'est pas dans la fiche
// (createDefaultInput) — exactement ce que verrait le courtier en ouvrant
// Fiscal Global pour ce client sans rien changer. Avant cette refonte, ce
// module appelait directement computeIncomeTax (résident suisse ordinaire)
// pour TOUS les clients, y compris frontaliers et imposés à la source :
// deux chiffres différents pour la même personne selon l'écran ouvert.
function buildTaxGlobalInput(b: ClientBundle): TaxGlobalInput | null {
  if (!b.client.canton) return null;
  if (!CANTON_SCALES[b.client.canton]) return null;

  const partial = toTaxGlobalInput(b);
  const grossSalary = partial.grossSalary ?? 0;
  if (grossSalary <= 0 && (partial.otherIncome ?? 0) <= 0) return null;

  return {
    ...createDefaultInput(),
    ...stripUndefined(partial as unknown as Record<string, unknown>),
  } as TaxGlobalInput;
}

function buildTax(input: TaxGlobalInput | null): DashboardTax | null {
  if (!input) return null;
  try {
    const r = computeTaxGlobal(input);
    const monthlySource = r.source ? Math.round(r.source.monthlyTax) : null;
    return {
      annualBurden: Math.round(r.totalTaxCHF),
      monthlySourceTax: monthlySource,
      marginalRate: r.marginalRate,
      effectiveRate: r.effectiveRate,
      grossIncome: Math.round(r.grossIncomeCHF),
    };
  } catch {
    return null;
  }
}

function buildLPP(b: ClientBundle, _age: number | null): DashboardLPP | null {
  const proj = projectClientLPP(b);
  if (!proj) return null;
  return {
    currentCapital: proj.currentCapital,
    projectedCapitalAt65: proj.projectedCapitalAt65,
    buybackCapacity: proj.buybackCapacity,
    annualPension: proj.annualPension,
    monthlyPension: proj.monthlyPension,
  };
}

function buildPillar3a(
  b: ClientBundle,
  _age: number | null,
  taxInput: TaxGlobalInput | null,
): DashboardPillar3a | null {
  const rules = getWorkStatusRules(b.client.work_status);
  const cap = effectivePillar3aCap(
    b.client.work_status,
    Number(b.client.gross_annual_salary ?? 0),
  );
  if (cap <= 0 && rules.pillar3aCap <= 0) return null;

  const current = Number(b.pension?.pillar_3a_annual_contribution ?? 0);
  const unused = Math.max(0, cap - current);
  // Délègue à la projection centrale (inclut le solde 3a existant).
  const central = projectClient3a(b);
  const projected = central?.projectedCapitalAt65 ?? 0;

  let savings = 0;
  if (current > 0 && taxInput) {
    try {
      // Régime-aware : un rachat/versement 3a n'est pas déductible de la
      // même façon pour un frontalier accord 1983 (imposition exclusive en
      // France, déduction ignorée) que pour un résident ordinaire — voir
      // computeTaxGlobal(). computeIncomeTax() seul appliquait toujours la
      // règle "résident" quel que soit le régime réel du client.
      const baseline = computeTaxGlobal({ ...taxInput, pillar3aContributions: 0 });
      const scenario = computeTaxGlobal({ ...taxInput, pillar3aContributions: current });
      savings = Math.round(baseline.totalTaxCHF - scenario.totalTaxCHF);
    } catch {
      savings = 0;
    }
  }

  return {
    effectiveCap: cap,
    currentContribution: current,
    unusedRoom: unused,
    projectedCapitalAt65: projected,
    taxSavings: Math.max(0, savings),
  };
}

function buildRetirement(
  b: ClientBundle,
  lpp: DashboardLPP | null,
  tax: DashboardTax | null,
): DashboardRetirement | null {
  if (!lpp || lpp.projectedCapitalAt65 <= 0 || !b.client.canton) return null;
  const status =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership"
      ? "married"
      : parseChildren(b.client.children).some(ch => ch.in_household)
        ? "single_with_children"
        : "single";

  try {
    const { total: lumpSumTax } = capitalWithdrawalTax({
      capital: lpp.projectedCapitalAt65,
      canton: b.client.canton,
      status,
    });
    const result = annuityVsLumpSum({
      capital: lpp.projectedCapitalAt65,
      yearsAlive: LIFE_EXPECTANCY_AT_65,
      // Réutilise le taux marginal déjà calculé par buildTax() (régime-aware)
      // au lieu de le recalculer avec computeIncomeTax() seul, qui ignorait
      // le régime fiscal réel du client (frontalier, source...).
      rentMarginalRate: tax ? tax.marginalRate : 25,
      lumpSumTax,
    });
    return {
      recommendation: result.recommendation,
      totalAnnuity: result.netAnnuity,
      totalLumpSum: result.netLumpSum,
    };
  } catch {
    return null;
  }
}

function buildCantonCompare(
  b: ClientBundle,
  taxInput: TaxGlobalInput | null,
): DashboardCantonCompare | null {
  if (!taxInput || !b.client.canton) return null;
  const rows: DashboardCantonRow[] = [];
  let currentTotal = 0;

  for (const code of Object.keys(CANTON_SCALES)) {
    try {
      // computeTaxGlobal() redétecte le régime pour CHAQUE canton candidat
      // (ex. GE => frontalier genevois, un autre canton frontière => accord
      // 1983) : pour un frontalier, "comparer les cantons" doit comparer les
      // VRAIS régimes applicables selon le canton de travail, pas appliquer
      // partout la formule résident ordinaire.
      const r = computeTaxGlobal({ ...taxInput, canton: code });
      rows.push({
        code,
        name: CANTON_SCALES[code]?.capital ?? code,
        total: Math.round(r.totalTaxCHF),
        effectiveRate: r.effectiveRate,
        delta: 0,
      });
      if (code === b.client.canton) currentTotal = Math.round(r.totalTaxCHF);
    } catch {
      // ignore canton incomplet
    }
  }
  if (rows.length === 0) return null;
  rows.forEach((r) => (r.delta = r.total - currentTotal));
  const best3 = [...rows].sort((a, b2) => a.total - b2.total).slice(0, 3);
  const cheapest = best3[0]?.total ?? currentTotal;
  return {
    current: { code: b.client.canton, total: currentTotal },
    best3,
    maxSavings: Math.max(0, currentTotal - cheapest),
  };
}

function buildAvs(b: ClientBundle): DashboardAvs | null {
  if (!b.client.date_of_birth) return null;
  const birthYear = new Date(b.client.date_of_birth).getFullYear();
  if (!Number.isFinite(birthYear)) return null;

  const gender = (b.client.gender as Gender | null) ?? null;
  const referenceAge = getReferenceAge(birthYear, gender);
  const retirementYear = birthYear + Math.round(referenceAge);

  // Approximation revenu moyen carrière = revenu brut total (salaire +
  // bonus + autres revenus), même source que le reste de l'app
  // (src/lib/clients/income.ts) : une formule locale n'incluant que
  // salaire+bonus divergerait silencieusement de la carte "Prestations
  // consolidées" juste en dessous, qui utilise déjà getTotalGrossIncome.
  const avgIncome = getTotalGrossIncome(b.client);
  if (avgIncome <= 0) return null;

  // Début de cotisation : par défaut, à 21 ans (ou première année si déjà passé).
  const contributionStartYear = birthYear + 21;

  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  const spouseBirthYear = b.client.spouse_date_of_birth
    ? new Date(b.client.spouse_date_of_birth).getFullYear()
    : null;
  const spouseIncome = Number(b.client.spouse_gross_annual_salary ?? 0);

  try {
    const proj = projectAvsPension({
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
    return {
      referenceAge,
      retirementYear,
      effectiveYears: proj.primary.effectiveYears,
      missingYears: proj.primary.missingYears,
      monthlyPension: proj.primary.monthlyPension,
      annualPension: proj.primary.annualPension,
      combinedMonthlyPension: proj.combinedMonthlyPension,
      cappedCouple: proj.cappedCouple,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Entrée publique
// ────────────────────────────────────────────────────────────────────────────

export function computeClientDashboard(b: ClientBundle): ClientDashboard {
  const age = ageFromDob(b.client.date_of_birth);
  const yearsToRetirement =
    age !== null ? Math.max(0, RETIREMENT_AGE_DEFAULT - age) : null;
  const fortune = computeFortune(b.assets);

  const taxInput = buildTaxGlobalInput(b);
  const tax = buildTax(taxInput);
  const lpp = buildLPP(b, age);
  const pillar3a = buildPillar3a(b, age, taxInput);
  const retirement = buildRetirement(b, lpp, tax);
  const cantonCompare = buildCantonCompare(b, taxInput);
  const avs = buildAvs(b);

  // Suggestions = optimizer existant (réutilisation pure). Reste sur
  // computeIncomeTax/IncomeTaxInput (buildOptimizerTaxInput) : hors périmètre
  // de cette refonte, qui porte sur les chiffres affichés ci-dessus.
  const optimizerTaxInput = buildOptimizerTaxInput(b);
  let suggestions: Optimization[] = [];
  if (optimizerTaxInput) {
    try {
      const ctx = getClientTaxContext(b.client);
      suggestions = runOptimizer({
        taxInput: optimizerTaxInput,
        lppBuybackCapacity: Number(b.pension?.lpp_max_buyback ?? 0),
        pillar3aCurrent: Number(b.pension?.pillar_3a_annual_contribution ?? 0),
        pillar3aBalance: 0,
        hasLPP: Number(b.pension?.lpp_current_balance ?? 0) > 0,
        age: age ?? undefined,
        lppBalance: Number(b.pension?.lpp_current_balance ?? 0),
        taxStatus: ctx.taxStatus,
        workStatus: ctx.workStatus,
      });
    } catch {
      suggestions = [];
    }
  }

  const hasEnoughData = tax !== null || lpp !== null || pillar3a !== null;

  return {
    hasEnoughData,
    age,
    yearsToRetirement,
    fortune,
    tax,
    lpp,
    pillar3a,
    retirement,
    cantonCompare,
    avs,
    suggestions,
  };
}
