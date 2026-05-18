// Centralisé : conversion d'un dossier client (Client + ClientPension + ClientAssets)
// vers les inputs typés acceptés par chaque calculateur.
//
// Règles :
// - Champs présents dans la fiche → valeurs ; champs nuls / manquants → undefined.
//   Le calculateur est libre de garder ses défauts (via merge).
// - PRÉSERVE le canton (pas de fallback silencieux).
// - PRÉSERVE le statut fiscal (utilisé par l'optimizer + bandeaux d'avertissement).
// - AUCUNE écriture vers la fiche : le mapping est unidirectionnel.

import type { Client, ClientPension, ClientAssets } from "./types";
import { ageFromDob, parseChildren } from "./types";
import type { IncomeTaxInput } from "@/lib/tax/income";
import type { TaxStatusContext, WorkStatusContext } from "@/lib/optimizer";
import { getTotalGrossIncomeOrUndef } from "./income";

export interface ClientBundle {
  client: Client;
  pension: ClientPension | null;
  assets: ClientAssets | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers de mapping
// ──────────────────────────────────────────────────────────────────────────

export function mapStatus(
  c: Client,
  hasChildren: boolean,
): IncomeTaxInput["status"] {
  if (c.civil_status === "married" || c.civil_status === "registered_partnership") {
    return "married";
  }
  if (hasChildren) return "single_with_children";
  return "single";
}

export function mapConfession(c: Client): IncomeTaxInput["confession"] {
  switch (c.confession) {
    case "roman_catholic":
    case "christian_catholic":
      return "catholic";
    case "protestant":
      return "protestant";
    case "none":
      return "none";
    default:
      return "other";
  }
}

export function computeFortune(a: ClientAssets | null): number {
  if (!a) return 0;
  return (
    Number(a.bank_accounts ?? 0) +
    Number(a.securities ?? 0) +
    Number(a.real_estate_value ?? 0) +
    Number(a.vehicles ?? 0) +
    Number(a.other_assets ?? 0) -
    Number(a.mortgage_debt ?? 0) -
    Number(a.other_debts ?? 0)
  );
}

export function getClientTaxContext(c: Client): {
  taxStatus: TaxStatusContext;
  workStatus: WorkStatusContext;
} {
  return {
    taxStatus: c.tax_status as TaxStatusContext,
    workStatus: c.work_status as WorkStatusContext,
  };
}

export function getClientDisplayName(c: Client): string {
  return `${c.first_name} ${c.last_name.toUpperCase()}`.trim();
}

// ──────────────────────────────────────────────────────────────────────────
// Mappers par calculateur (renvoient des Partial<form> mergés côté composant)
// ──────────────────────────────────────────────────────────────────────────

/** income-tax · TOU · base commune */
export function toIncomeTaxInput(b: ClientBundle) {
  const children = parseChildren(b.client.children);
  return {
    canton: b.client.canton ?? undefined,
    taxStatus: b.client.tax_status,
    status: mapStatus(b.client, children.length > 0),
    confession: mapConfession(b.client),
    children: children.length,
    grossSalary: numOrUndef(b.client.gross_annual_salary),
    spouseGrossSalary: numOrUndef(b.client.spouse_gross_annual_salary),
    bonus: numOrUndef(b.client.bonus),
    otherIncome: numOrUndef(b.client.other_income),
    pillar3aContributions: numOrUndef(b.pension?.pillar_3a_annual_contribution),
    lppBuyback: 0,
    mortgageInterest: numOrUndef(b.assets?.mortgage_interest),
    realEstateMaintenance: numOrUndef(b.assets?.real_estate_maintenance),
    netWealth: computeFortune(b.assets),
    lppBuybackCapacity: numOrUndef(b.pension?.lpp_max_buyback),
    pillar3aBalance: 0,
  };
}

/** source-tax */
export function toSourceTaxInput(b: ClientBundle) {
  const married =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  const hasKids = parseChildren(b.client.children).length > 0;
  const spouseSalary = Number(b.client.spouse_gross_annual_salary ?? 0);
  // Barème par défaut : C si marié biactif, B si marié monoactif, H si monoparental, A sinon.
  const defaultScale: "A" | "B" | "C" | "H" = married
    ? spouseSalary > 0
      ? "C"
      : "B"
    : hasKids
      ? "H"
      : "A";
  const scale = ((b.client.source_tax_scale as string | null) ?? defaultScale) as
    | "A"
    | "B"
    | "C"
    | "H";
  return {
    canton: b.client.canton ?? undefined,
    scale,
    children: parseChildren(b.client.children).length,
    monthlyGross: b.client.gross_annual_salary
      ? Math.round(Number(b.client.gross_annual_salary) / 12)
      : undefined,
    spouseMonthlyGross:
      spouseSalary > 0 ? Math.round(spouseSalary / 12) : undefined,
    church: b.client.confession && b.client.confession !== "none" ? true : undefined,
    isCrossBorderFR:
      b.client.tax_status === "cross_border_fr_1983" ||
      (b.client.tax_status === "cross_border_ge" &&
        b.client.country_of_residence === "FR")
        ? true
        : undefined,
  };
}

/** cross-border (frontalier FR/IT) */
export function toCrossBorderInput(b: ClientBundle) {
  const married =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  return {
    workCanton: b.client.canton ?? undefined,
    grossAnnualSalary: getTotalGrossIncomeOrUndef(b.client),
    status: (married ? "married" : "single") as "single" | "married",
    children: parseChildren(b.client.children).length,
    spouseGrossSalary: numOrUndef(b.client.spouse_gross_annual_salary),
  };
}

/** TOU / quasi-résident */
export function toTouInput(b: ClientBundle) {
  const base = toIncomeTaxInput(b);
  return {
    ...base,
    worldwideIncome: getTotalGrossIncomeOrUndef(b.client),
    isEUEFTAResident: b.client.tax_status === "tou",
  };
}

/** LPP & rachats */
export function toLppInput(b: ClientBundle) {
  return {
    canton: b.client.canton ?? undefined,
    status: mapStatus(b.client, parseChildren(b.client.children).length > 0),
    children: parseChildren(b.client.children).length,
    confession: mapConfession(b.client),
    currentAge: ageFromDob(b.client.date_of_birth) ?? undefined,
    retirementAge: undefined,
    grossSalary: getTotalGrossIncomeOrUndef(b.client),
    spouseGrossSalary: numOrUndef(b.client.spouse_gross_annual_salary),
    insuredSalary: numOrUndef(b.pension?.lpp_insured_salary),
    currentBalance: numOrUndef(b.pension?.lpp_current_balance),
    buybackCapacity: numOrUndef(b.pension?.lpp_max_buyback),
    conversionRate: numOrUndef(b.pension?.lpp_conversion_rate),
    pillar3aContributions: numOrUndef(b.pension?.pillar_3a_annual_contribution),
    mortgageInterest: numOrUndef(b.assets?.mortgage_interest),
    realEstateMaintenance: numOrUndef(b.assets?.real_estate_maintenance),
  };
}

/** Libre passage */
export function toVestedBenefitsInput(b: ClientBundle) {
  const age = ageFromDob(b.client.date_of_birth);
  const vestedSum = sumAccountBalances(b.pension?.vested_benefits_accounts);
  return {
    withdrawalCanton: b.client.canton ?? undefined,
    initialBalance: vestedSum > 0 ? vestedSum : numOrUndef(b.pension?.lpp_current_balance),
    yearsToRetirement: age !== null ? Math.max(1, 65 - age) : undefined,
  };
}

/** Pilier 3a */
export function toPillar3aInput(b: ClientBundle) {
  const age = ageFromDob(b.client.date_of_birth);
  const pillar3aSum = sumAccountBalances(b.pension?.pillar_3a_accounts);
  return {
    canton: b.client.canton ?? undefined,
    status: mapStatus(b.client, parseChildren(b.client.children).length > 0),
    grossSalary: getTotalGrossIncomeOrUndef(b.client),
    contribution: numOrUndef(b.pension?.pillar_3a_annual_contribution),
    currentBalance: pillar3aSum > 0 ? pillar3aSum : undefined,
    yearsToRetirement: age !== null ? Math.max(1, 65 - age) : undefined,
    hasLPP: Number(b.pension?.lpp_current_balance ?? 0) > 0,
  };
}

/** Comparateur cantonal */
export function toCantonCompareInput(b: ClientBundle) {
  // Le formulaire n'a qu'un seul champ "Salaire brut" : on agrège
  // salaire + bonus + autres revenus pour refléter la base imposable totale.
  return {
    referenceCanton: b.client.canton ?? undefined,
    status: mapStatus(b.client, parseChildren(b.client.children).length > 0),
    children: parseChildren(b.client.children).length,
    grossSalary: getTotalGrossIncomeOrUndef(b.client),
    spouseGrossSalary: numOrUndef(b.client.spouse_gross_annual_salary),
    netWealth: computeFortune(b.assets) || undefined,
  };
}

/** Rente vs capital */
export function toRetirementInput(b: ClientBundle) {
  const married =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  return {
    canton: b.client.canton ?? undefined,
    status: (married ? "married" : "single") as
      | "single"
      | "married"
      | "single_with_children",
    capital: numOrUndef(b.pension?.lpp_current_balance),
  };
}

/** AVS/AI · 1er pilier */
export function toAvsAiInput(b: ClientBundle) {
  const birthYear = b.client.date_of_birth
    ? new Date(b.client.date_of_birth).getFullYear()
    : undefined;
  const spouseBirthYear = b.client.spouse_date_of_birth
    ? new Date(b.client.spouse_date_of_birth).getFullYear()
    : undefined;
  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  const gender = (b.client.gender as "male" | "female" | "other" | null) ?? undefined;
  // AVS = revenu soumis à cotisations : salaire + bonus + autres revenus d'activité.
  const avgIncome =
    Number(b.client.gross_annual_salary ?? 0) +
    Number(b.client.bonus ?? 0) +
    Number(b.client.other_income ?? 0);

  // Référence : âge 65 par défaut, ajusté côté composant via getReferenceAge.
  const retirementYear =
    birthYear !== undefined ? birthYear + (gender === "female" && birthYear <= 1963 ? 64 : 65) : undefined;
  const spouseRetirementYear =
    spouseBirthYear !== undefined ? spouseBirthYear + 65 : undefined;

  // Priorité : valeur explicite (avs_contribution_start_year) > arrival/cross_border > 21 ans révolus.
  const explicitStart = numOrUndef(b.client.avs_contribution_start_year);
  const isCrossBorder =
    b.client.tax_status === "cross_border_fr_1983" ||
    b.client.tax_status === "cross_border_ge";
  const arrivalStart = isCrossBorder
    ? numOrUndef(b.client.cross_border_start_year)
    : numOrUndef(b.client.arrival_year_ch);
  const default18 = birthYear !== undefined ? birthYear + 21 : undefined;
  const contributionStartYear =
    explicitStart ?? (arrivalStart !== undefined && default18 !== undefined ? Math.max(arrivalStart, default18) : (arrivalStart ?? default18));

  return {
    birthYear,
    gender,
    contributionStartYear,
    retirementYear,
    averageAnnualIncome: avgIncome > 0 ? avgIncome : undefined,
    isCouple: isCouple ? true : undefined,
    spouseBirthYear,
    spouseGender: undefined,
    spouseContributionStartYear:
      spouseBirthYear !== undefined ? spouseBirthYear + 21 : undefined,
    spouseRetirementYear,
    spouseAverageAnnualIncome: numOrUndef(b.client.spouse_gross_annual_salary),
  };
}

/** Comparateur d'investissements · préremplit l'hypothèse A à partir de l'épargne disponible du client. */
export function toInvestmentCompareInput(b: ClientBundle) {
  const age = ageFromDob(b.client.date_of_birth);
  const liquid =
    Number(b.assets?.bank_accounts ?? 0) + Number(b.assets?.securities ?? 0);
  const initialCapital = liquid > 0 ? Math.round(liquid) : undefined;
  const durationYears = age !== null ? Math.max(1, 65 - age) : undefined;
  const name = `${b.client.first_name ?? ""}`.trim()
    ? `Situation actuelle · ${b.client.first_name}`
    : "Situation actuelle";
  return {
    name,
    initialCapital,
    durationYears,
  };
}
// ──────────────────────────────────────────────────────────────────────────

/** Somme les soldes ("balance" / "amount" / "value") d'un tableau JSONB de comptes. */
export function sumAccountBalances(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((acc, item) => {
    if (typeof item !== "object" || item === null) return acc;
    const rec = item as Record<string, unknown>;
    const raw = rec.balance ?? rec.amount ?? rec.value ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? acc + n : acc;
  }, 0);
}

function numOrUndef(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Retire les undefined d'un objet — utile pour merger sans écraser des défauts. */
export function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(o) as Array<keyof T>) {
    if (o[k] !== undefined) out[k] = o[k];
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// SANTÉ FRONTALIERS (CMU / CNTFS)
// ──────────────────────────────────────────────────────────────────────────
export function toHealthInsuranceFranceInput(b: ClientBundle) {
  const main = numOrUndef(b.client.gross_annual_salary);
  const spouse = numOrUndef(b.client.spouse_gross_annual_salary);
  const childrenCount = parseChildren(b.client.children).length;
  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  return {
    swissGrossSalaryCHF: main,
    spouseFrenchSalaryEUR: spouse !== undefined ? Math.round(spouse) : undefined,
    civilStatus: isCouple ? ("married" as const) : ("single" as const),
    childrenCount,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// HEURES SUPPLÉMENTAIRES FRONTALIERS
// ──────────────────────────────────────────────────────────────────────────
export function toOvertimeInput(b: ClientBundle) {
  const main = numOrUndef(b.client.gross_annual_salary);
  const spouse = numOrUndef(b.client.spouse_gross_annual_salary);
  const childrenCount = parseChildren(b.client.children).length;
  const isCouple =
    b.client.civil_status === "married" ||
    b.client.civil_status === "registered_partnership";
  // Estimation : net imposable ≈ 80% du brut (charges sociales suisses).
  const estimatedNetCHF = main !== undefined ? Math.round(main * 0.8) : undefined;
  return {
    workCanton: b.client.canton ?? undefined,
    annualNetSalary: estimatedNetCHF,
    salaryCurrency: estimatedNetCHF !== undefined ? ("CHF" as const) : undefined,
    civilStatus: isCouple ? ("married" as const) : ("single" as const),
    childrenCount,
    spouseEmployed: spouse !== undefined && spouse > 0 ? true : undefined,
    spouseAnnualSalaryCHF: spouse,
  };
}

