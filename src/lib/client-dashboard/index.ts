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
} from "@/lib/clients/to-calculator-input";
import {
  computeIncomeTax,
  estimateSocialContributions,
  type IncomeTaxInput,
} from "@/lib/tax/income";
import {
  annuityVsLumpSum,
  capitalWithdrawalTax,
} from "@/lib/lpp";
import { projectPillar3a } from "@/lib/pillar3";
import {
  projectClientLPP,
  projectClient3a,
} from "./lpp-projection";
import { computeSourceTax } from "@/lib/tax/source";
import { CANTON_SCALES } from "@/lib/tax/cantons";
import {
  effectivePillar3aCap,
  getWorkStatusRules,
} from "@/lib/clients/work-status-rules";
import { runOptimizer, type Optimization } from "@/lib/optimizer";
import { projectAvsPension, getReferenceAge, type Gender } from "@/lib/avs";

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

function safeIncomeTaxInput(b: ClientBundle): IncomeTaxInput | null {
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
      partial.status ?? (children.length > 0 ? "single_with_children" : "single"),
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

function buildTax(b: ClientBundle, taxInput: IncomeTaxInput | null): DashboardTax | null {
  if (!taxInput) return null;
  try {
    const r = computeIncomeTax(taxInput);
    let monthlySource: number | null = null;
    if (b.client.tax_status === "source_taxed" && b.client.gross_annual_salary) {
      try {
        const monthlyGross = Math.round(Number(b.client.gross_annual_salary) / 12);
        const src = computeSourceTax({
          canton: b.client.canton ?? "VD",
          scale: (b.client.source_tax_scale as "A" | "B" | "C" | "H" | null) ?? "A",
          children: parseChildren(b.client.children).length,
          monthlyGross,
          church:
            b.client.confession && b.client.confession !== "none" ? true : undefined,
        });
        monthlySource = Math.round(src.monthlyTax);
      } catch {
        monthlySource = null;
      }
    }
    return {
      annualBurden: Math.round(r.totalTax),
      monthlySourceTax: monthlySource,
      marginalRate: r.marginalRate,
      effectiveRate: r.effectiveRate,
      grossIncome: Math.round(r.grossIncome),
    };
  } catch {
    return null;
  }
}

function buildLPP(b: ClientBundle, age: number | null): DashboardLPP | null {
  const rules = getWorkStatusRules(b.client.work_status);
  const currentCapital = Number(b.pension?.lpp_current_balance ?? 0);
  const insuredSalary = Number(b.pension?.lpp_insured_salary ?? 0);
  const buybackCapacity = Number(b.pension?.lpp_max_buyback ?? 0);

  // Sans LPP affilié → on retourne au moins l'avoir actuel s'il existe (libre passage),
  // sinon null.
  if (!rules.hasLPP && currentCapital <= 0) return null;
  if (age === null) {
    return {
      currentCapital,
      projectedCapitalAt65: currentCapital,
      buybackCapacity,
      annualPension: 0,
      monthlyPension: 0,
    };
  }
  if (age >= RETIREMENT_AGE_DEFAULT) {
    const annualPension = currentCapital * (LPP_CONVERSION_RATE_2026 / 100);
    return {
      currentCapital,
      projectedCapitalAt65: currentCapital,
      buybackCapacity,
      annualPension: Math.round(annualPension),
      monthlyPension: Math.round(annualPension / 12),
    };
  }

  try {
    const proj = projectLPP({
      currentAge: age,
      retirementAge: RETIREMENT_AGE_DEFAULT,
      currentBalance: currentCapital,
      insuredSalary:
        insuredSalary > 0
          ? insuredSalary
          : Math.max(0, Number(b.client.gross_annual_salary ?? 0)),
      conversionRate: Number(b.pension?.lpp_conversion_rate ?? LPP_CONVERSION_RATE_2026),
    });
    return {
      currentCapital,
      projectedCapitalAt65: proj.projectedBalance,
      buybackCapacity,
      annualPension: proj.annualPension,
      monthlyPension: proj.monthlyPension,
    };
  } catch {
    return null;
  }
}

function buildPillar3a(
  b: ClientBundle,
  age: number | null,
  taxInput: IncomeTaxInput | null,
): DashboardPillar3a | null {
  const rules = getWorkStatusRules(b.client.work_status);
  const cap = effectivePillar3aCap(
    b.client.work_status,
    Number(b.client.gross_annual_salary ?? 0),
  );
  if (cap <= 0 && rules.pillar3aCap <= 0) return null;

  const current = Number(b.pension?.pillar_3a_annual_contribution ?? 0);
  const unused = Math.max(0, cap - current);
  const yearsToRetire =
    age !== null ? Math.max(0, RETIREMENT_AGE_DEFAULT - age) : 0;

  let projected = 0;
  if (yearsToRetire > 0 && current > 0) {
    try {
      const proj = projectPillar3a({
        currentBalance: 0,
        yearlyContribution: current,
        years: yearsToRetire,
      });
      projected = proj.finalBalance;
    } catch {
      projected = current * yearsToRetire;
    }
  }

  let savings = 0;
  if (current > 0 && taxInput) {
    try {
      const baseline = computeIncomeTax({ ...taxInput, pillar3aContributions: 0 });
      const scenario = computeIncomeTax({
        ...taxInput,
        pillar3aContributions: current,
      });
      savings = Math.round(baseline.totalTax - scenario.totalTax);
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
  taxInput: IncomeTaxInput | null,
): DashboardRetirement | null {
  if (!lpp || lpp.projectedCapitalAt65 <= 0 || !b.client.canton) return null;
  const status =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership"
      ? "married"
      : parseChildren(b.client.children).length > 0
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
      rentMarginalRate: taxInput ? computeIncomeTax(taxInput).marginalRate : 25,
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
  taxInput: IncomeTaxInput | null,
): DashboardCantonCompare | null {
  if (!taxInput || !b.client.canton) return null;
  const rows: DashboardCantonRow[] = [];
  let currentTotal = 0;

  for (const code of Object.keys(CANTON_SCALES)) {
    try {
      const r = computeIncomeTax({ ...taxInput, canton: code });
      rows.push({
        code,
        name: CANTON_SCALES[code]?.capital ?? code,
        total: Math.round(r.totalTax),
        effectiveRate: r.effectiveRate,
        delta: 0,
      });
      if (code === b.client.canton) currentTotal = Math.round(r.totalTax);
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

  // Approximation revenu moyen carrière = salaire actuel + bonus.
  const avgIncome =
    Number(b.client.gross_annual_salary ?? 0) + Number(b.client.bonus ?? 0);
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

  const taxInput = safeIncomeTaxInput(b);
  const tax = buildTax(b, taxInput);
  const lpp = buildLPP(b, age);
  const pillar3a = buildPillar3a(b, age, taxInput);
  const retirement = buildRetirement(b, lpp, taxInput);
  const cantonCompare = buildCantonCompare(b, taxInput);
  const avs = buildAvs(b);

  // Suggestions = optimizer existant (réutilisation pure).
  let suggestions: Optimization[] = [];
  if (taxInput) {
    try {
      const ctx = getClientTaxContext(b.client);
      suggestions = runOptimizer({
        taxInput,
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
