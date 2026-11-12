// Calculs LPP (2e pilier) · rachats, retraits, conversion en rente, projections.
// Bases : LPP / OPP2 valables 2026.

import { computeIncomeTax, type IncomeTaxInput } from "../tax/income";
import { computeIFD } from "../tax/ifd";
import { computeCantonalCommunal } from "../tax/cantons";
import { LPP_2026 } from "./parameters-2026";

// Constantes 2026 — dérivées de LPP_2026 (parameters-2026.ts), seule source
// de vérité : deux listes de constantes recopiées à la main finissent
// toujours par diverger à la prochaine indexation.
export const LPP_COORDINATION_DEDUCTION_2026: number = LPP_2026.coordinationDeduction;
export const LPP_MAX_INSURED_SALARY_2026: number = LPP_2026.maxInsuredSalary; // 7.5x rente AVS max
export const LPP_MIN_ANNUAL_SALARY_2026: number = LPP_2026.minAnnualSalary;
export const LPP_CONVERSION_RATE_2026: number = LPP_2026.conversionRate; // taux retenu (taux légal minimal = 6.8%)
export const LPP_INTEREST_MIN_2026: number = LPP_2026.minInterestRate; // taux minimal LPP 2026

/** Plancher légal du salaire coordonné LPP 2026 (art. 8 al. 2 LPP), garanti
 *  pour tout salarié soumis à la LPP (donc dès qu'il dépasse le seuil
 *  d'entrée), même si brut − déduction de coordination donne un résultat
 *  plus bas. */
export const LPP_MIN_COORDINATED_SALARY_2026 = 3_780;

/** Nombre d'années sur lesquelles étaler un rachat planifié
 *  (client_pension.lpp_planned_buybacks), déduit du nombre d'années
 *  DISTINCTES présentes dans les rachats enregistrés (une entrée par
 *  année de versement). Fonction PARTAGÉE entre le préremplissage du
 *  calculateur LPP (to-calculator-input.ts) et la projection "dossier"
 *  (client-dashboard/lpp-projection.ts) : avant, les deux avaient chacun
 *  leur propre règle (l'une comptait les années distinctes, l'autre
 *  étalait sur TOUTES les années restantes jusqu'à la retraite), donc un
 *  même rachat enregistré produisait deux capitaux projetés différents
 *  dès l'ouverture du calculateur, sans qu'aucun paramètre n'ait été
 *  modifié. */
export function deriveBuybackYears(planned: Array<{ year: number }>): number {
  if (planned.length === 0) return 1;
  return Math.max(1, new Set(planned.map((p) => p.year)).size);
}

export function computeLppInsuredSalary(
  grossSalary: number,
  insuredSalaryCap = LPP_MAX_INSURED_SALARY_2026,
): number {
  // Sous le seuil d'entrée, la personne n'est pas soumise à la LPP
  // obligatoire : salaire assuré = 0, le plancher légal ne s'applique pas.
  if (grossSalary < LPP_MIN_ANNUAL_SALARY_2026) return 0;

  // Salaire coordonné = min(salaire brut ; plafond assuré) − déduction de coordination.
  // La déduction s'applique APRÈS le plafonnement au salaire assuré maximal.
  const cappedSalary = Math.min(grossSalary, insuredSalaryCap);
  const raw = cappedSalary - LPP_COORDINATION_DEDUCTION_2026;
  // Plancher légal : jamais moins que 3'780 CHF pour un salarié assujetti.
  return Math.round(Math.max(LPP_MIN_COORDINATED_SALARY_2026, raw));
}

/** Bonifications de vieillesse LPP · barème légal */
export const LPP_AGE_CREDITS: Record<string, number> = {
  // Tranches d'âge → % du salaire coordonné
  "25-34": 0.07,
  "35-44": 0.1,
  "45-54": 0.15,
  "55-65": 0.18,
};

export function lppCreditRate(age: number): number {
  if (age < 25) return 0;
  if (age <= 34) return LPP_AGE_CREDITS["25-34"];
  if (age <= 44) return LPP_AGE_CREDITS["35-44"];
  if (age <= 54) return LPP_AGE_CREDITS["45-54"];
  if (age <= 65) return LPP_AGE_CREDITS["55-65"];
  return 0;
}

export interface LPPProjectionInput {
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  insuredSalary: number;
  /** Taux de croissance annuel attendu de la caisse, brut (default 1.25%) */
  expectedReturnRate?: number;
  /** Frais annuels (TER + frais admin) appliqués sur le capital, en % (default 0) */
  feeRate?: number;
  /** Croissance salariale annuelle (default 1%) */
  salaryGrowthRate?: number;
  /** Taux de conversion à la retraite (default 6.0 (taux légal minimal 6.8%) ou propre à la caisse) */
  conversionRate?: number;
  /** Bonifications additionnelles plan sur-obligatoire (% sup.) */
  extraCreditRate?: number;
  /** Rachat annuel additionnel injecté chaque année (CHF) */
  yearlyBuyback?: number;
  /** Nombre d'années sur lesquelles s'applique le rachat (default = jusqu'à la retraite) */
  buybackYears?: number;
  /** Plafond du salaire coordonné assuré. Default = LPP_MAX_INSURED_SALARY_2026 (90 720). Augmenter pour plans 1e / surobligatoires (cadres). */
  insuredSalaryCap?: number;
}

export interface LPPProjectionResult {
  /** Capital projeté à la retraite */
  projectedBalance: number;
  /** Capital projeté SANS rendement (référence) */
  projectedBalanceNoYield: number;
  /** Capital projeté SANS frais (rendement brut uniquement) */
  projectedBalanceGross: number;
  /** Rente annuelle estimée */
  annualPension: number;
  /** Rente mensuelle */
  monthlyPension: number;
  /** Taux net effectivement appliqué (%) = brut - frais */
  netReturnRate: number;
  /** Total des frais cumulés sur la période (CHF) */
  totalFees: number;
  /** Total des rachats injectés (CHF) */
  totalBuybacks: number;
  /** Détail année par année */
  yearly: Array<{
    age: number;
    /** Salaire COORDONNÉ projeté cette année-là (après coordination et
     *  plafonnement, avant application du plancher légal) — pas le
     *  salaire brut, qui n'est pas connu par cette fonction. */
    salary: number;
    /** Salaire coordonné effectivement utilisé pour la bonification (après
     *  plancher légal de 3'780 CHF et plafonnement). */
    coordinated: number;
    credit: number;
    interest: number;
    fees: number;
    buyback: number;
    balance: number;
    balanceNoYield: number;
  }>;
}

export function projectLPP(input: LPPProjectionInput): LPPProjectionResult {
  const yearsToRetire = Math.max(0, input.retirementAge - input.currentAge);
  const grossReturn = (input.expectedReturnRate ?? 1.25) / 100;
  const fee = (input.feeRate ?? 0) / 100;
  const netReturn = grossReturn - fee;
  const salaryGrowth = (input.salaryGrowthRate ?? 1) / 100;
  const conversionRate = (input.conversionRate ?? LPP_CONVERSION_RATE_2026) / 100;
  const extraCredit = (input.extraCreditRate ?? 0) / 100;
  const yearlyBuyback = Math.max(0, input.yearlyBuyback ?? 0);
  const buybackYears = Math.max(0, input.buybackYears ?? yearsToRetire);

  let balance = input.currentBalance;
  let balanceNoYield = input.currentBalance;
  let balanceGross = input.currentBalance;
  // input.insuredSalary est DÉJÀ le salaire coordonné (après déduction de
  // coordination 26'460 CHF et plafonnement) — c'est ce que produit
  // computeLppInsuredSalary() et ce que contient le certificat de
  // prévoyance (client_pension.lpp_insured_salary). La déduction de
  // coordination ne doit donc PAS être réappliquée ici : avant ce
  // correctif, elle l'était une seconde fois à chaque année de la
  // projection, sous-estimant le salaire coordonné (et donc le capital
  // projeté) d'environ 40% dans un cas typique — voir cantons.ts/SCOPE.md
  // pour la convention équivalente côté arrondis, et computeIncomeTax
  // (tax/income.ts) qui utilise déjà ce même champ correctement, sans
  // re-déduire.
  let coordinatedSalary = input.insuredSalary;
  let totalFees = 0;
  let totalBuybacks = 0;
  const yearly: LPPProjectionResult["yearly"] = [];

  const insuredCap = Math.max(0, input.insuredSalaryCap ?? LPP_MAX_INSURED_SALARY_2026);
  // Plafond du salaire coordonné lui-même (pas du brut) : sert à borner la
  // croissance simulée du salaire coordonné au fil des années.
  const coordinatedCap = Math.max(0, insuredCap - LPP_COORDINATION_DEDUCTION_2026);

  for (let i = 0; i < yearsToRetire; i++) {
    const age = input.currentAge + i;
    // Plancher légal (3'780 CHF), sauf si le salarié n'est pas assujetti à
    // la LPP (salaire coordonné nul ou négatif en entrée — déjà déterminé
    // en amont par computeLppInsuredSalary selon le seuil d'entrée brut).
    const coordinated =
      coordinatedSalary <= 0
        ? 0
        : Math.max(LPP_MIN_COORDINATED_SALARY_2026, Math.min(coordinatedSalary, coordinatedCap));
    const creditRate = lppCreditRate(age) + extraCredit;
    const credit = coordinated * creditRate;
    const grossInterest = balance * grossReturn;
    const fees = balance * fee;
    const interest = grossInterest - fees;
    const buyback = i < buybackYears ? yearlyBuyback : 0;

    balance = balance + credit + interest + buyback;
    balanceNoYield = balanceNoYield + credit + buyback;
    balanceGross = balanceGross + credit + grossInterest + buyback;
    totalFees += fees;
    totalBuybacks += buyback;

    yearly.push({
      age: age + 1,
      salary: Math.round(coordinatedSalary),
      coordinated,
      credit: Math.round(credit),
      interest: Math.round(interest),
      fees: Math.round(fees),
      buyback: Math.round(buyback),
      balance: Math.round(balance),
      balanceNoYield: Math.round(balanceNoYield),
    });
    coordinatedSalary *= 1 + salaryGrowth;
  }

  const annualPension = balance * conversionRate;
  return {
    projectedBalance: Math.round(balance),
    projectedBalanceNoYield: Math.round(balanceNoYield),
    projectedBalanceGross: Math.round(balanceGross),
    annualPension: Math.round(annualPension),
    monthlyPension: Math.round(annualPension / 12),
    netReturnRate: Math.round(netReturn * 10000) / 100,
    totalFees: Math.round(totalFees),
    totalBuybacks: Math.round(totalBuybacks),
    yearly,
  };
}

export interface LPPBuybackPlanInput {
  /** Capacité de rachat totale (CHF), informatif (plafond caisse) */
  buybackCapacity: number;
  /** Montant effectivement racheté (CHF). Si non fourni, on utilise buybackCapacity (compat). */
  actualBuyback?: number;
  /** Sur combien d'années étaler */
  years: number;
  /** Situation fiscale du contribuable */
  taxInput: IncomeTaxInput;
}

export interface LPPBuybackPlanResult {
  /** Versement annuel prévu */
  yearlyAmount: number;
  /** Montant total effectivement racheté (CHF) */
  totalBought: number;
  /** Économie d'impôt totale sur la période */
  totalTaxSavings: number;
  /** Taux marginal effectif appliqué (impact fiscal moyen sur la 1re année) */
  effectiveMarginalRate: number;
  /** Taux marginal théorique baseline (avant rachat) */
  baselineMarginalRate: number;
  /** Revenu net imposable baseline (référence pour l'utilisateur) */
  baselineTaxableIncome: number;
  /** Détail année par année */
  yearly: Array<{
    year: number;
    amount: number;
    taxSavings: number;
    effectiveCost: number;
  }>;
  /** ROI fiscal moyen (savings / total versé) */
  averageReturn: number;
}

/**
 * Simule un plan de rachat LPP étalé.
 * Pour chaque année, on calcule l'impôt avec et sans rachat.
 */
export function simulateBuybackPlan(input: LPPBuybackPlanInput): LPPBuybackPlanResult {
  const totalBought = Math.max(0, input.actualBuyback ?? input.buybackCapacity);
  const years = Math.max(1, input.years);
  const yearlyAmount = Math.round(totalBought / years);
  const baseline = computeIncomeTax(input.taxInput);
  let totalSavings = 0;

  const yearly = Array.from({ length: years }, (_, i) => {
    const scenario = computeIncomeTax({
      ...input.taxInput,
      lppBuyback: yearlyAmount,
    });
    const taxSavings = baseline.totalTax - scenario.totalTax;
    totalSavings += taxSavings;
    return {
      year: i + 1,
      amount: yearlyAmount,
      taxSavings: Math.round(taxSavings),
      effectiveCost: Math.round(yearlyAmount - taxSavings),
    };
  });

  // Taux marginal effectif observé sur le rachat de la 1re année.
  const effectiveMarginalRate =
    yearlyAmount > 0 && yearly[0]
      ? Math.round((yearly[0].taxSavings / yearlyAmount) * 1000) / 10
      : 0;

  return {
    yearlyAmount,
    totalBought,
    totalTaxSavings: Math.round(totalSavings),
    effectiveMarginalRate,
    baselineMarginalRate: baseline.marginalRate,
    baselineTaxableIncome: baseline.taxableIncomeCC,
    yearly,
    averageReturn: totalBought > 0 ? Math.round((totalSavings / totalBought) * 1000) / 10 : 0,
  };
}

/**
 * Calcule rétroactivement l'avoir LPP estimé d'un assuré qui a cotisé depuis
 * `entryAge` jusqu'à son âge actuel, sur la base d'un salaire stable et d'un
 * taux d'intérêt minimal LPP.
 *
 * Hypothèses :
 * - salaire constant (sur le salaire courant), communiqué clairement à l'UI
 * - taux d'intérêt = LPP_INTEREST_MIN_2026 (1.25%)
 * - bonifications légales selon barème par tranche d'âge
 */
export function estimateRetroactiveLppBalance(opts: {
  entryAge: number;
  currentAge: number;
  insuredSalary: number;
  interestRate?: number;
}): number {
  const start = Math.max(25, Math.floor(opts.entryAge));
  const end = Math.max(start, Math.floor(opts.currentAge));
  const rate = (opts.interestRate ?? LPP_INTEREST_MIN_2026) / 100;
  let balance = 0;
  for (let age = start; age < end; age++) {
    const credit = opts.insuredSalary * lppCreditRate(age);
    balance = balance * (1 + rate) + credit;
  }
  return Math.round(balance);
}

/**
 * Compare rente vs capital à la retraite.
 * Hypothèse : impôt unique sur capital (1/5 du barème) ou rente annuelle au barème.
 */
export interface AnnuityVsLumpSumInput {
  capital: number;
  conversionRate?: number;
  /** Espérance de vie résiduelle en années */
  yearsAlive: number;
  /** Taux de placement net du capital si retiré (%) */
  selfReturnRate?: number;
  /** Taux marginal d'impôt sur la rente (%) */
  rentMarginalRate: number;
  /** Impôt unique sur le capital (CHF) déjà calculé */
  lumpSumTax: number;
}

export interface AnnuityVsLumpSumResult {
  totalRente: number;
  /** Total des retraits possibles sur la période si le capital net est
   *  placé et consommé progressivement jusqu'à épuisement. */
  totalCapital: number;
  /** Solde total perçu sur la période */
  netAnnuity: number;
  netLumpSum: number;
  /** Retrait annuel constant finançable par le capital net sur la période. */
  annualDrawdown: number;
  /** Recommandation textuelle */
  recommendation: "annuity" | "lump_sum" | "mixed";
}

/**
 * Les deux scénarios sont comparés sur la même base : ce que le retraité
 * peut réellement dépenser pendant `yearsAlive` années.
 * - Rente : rentes annuelles nettes d'impôt, versées chaque année.
 * - Capital : capital net d'impôt, placé au rendement indiqué et consommé
 *   par retraits annuels égaux jusqu'à épuisement (annuité certaine).
 * Comparer la somme des rentes dépensées à un capital qui fructifierait
 * 20 ans sans jamais être touché avantagerait artificiellement le capital.
 */
export function annuityVsLumpSum(input: AnnuityVsLumpSumInput): AnnuityVsLumpSumResult {
  const cr = (input.conversionRate ?? LPP_CONVERSION_RATE_2026) / 100;
  const years = Math.max(0, input.yearsAlive);
  const annualPension = input.capital * cr;
  const totalRente = annualPension * years;
  const totalRenteAfterTax = totalRente * (1 - input.rentMarginalRate / 100);

  const r = (input.selfReturnRate ?? 1.25) / 100;
  const netCapital = Math.max(0, input.capital - input.lumpSumTax);
  // Retrait annuel constant (fin d'année) épuisant le capital en `years` ans.
  const annualDrawdown =
    years <= 0
      ? 0
      : Math.abs(r) < 1e-9
        ? netCapital / years
        : (netCapital * r) / (1 - Math.pow(1 + r, -years));
  const totalCapital = years <= 0 ? netCapital : annualDrawdown * years;

  let recommendation: "annuity" | "lump_sum" | "mixed";
  const diff = totalCapital - totalRenteAfterTax;
  if (Math.abs(diff) < input.capital * 0.05) recommendation = "mixed";
  else if (diff > 0) recommendation = "lump_sum";
  else recommendation = "annuity";

  return {
    totalRente: Math.round(totalRente),
    totalCapital: Math.round(totalCapital),
    netAnnuity: Math.round(totalRenteAfterTax),
    netLumpSum: Math.round(totalCapital),
    annualDrawdown: Math.round(annualDrawdown),
    recommendation,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Impôt sur les prestations en capital de la prévoyance (2e pilier, libre
// passage, 3a) — part cantonale + communale, chef-lieu du canton.
//
// Calcul UNIQUE pour toute l'app : « Rente vs capital », « Libre passage »,
// 3e pilier, comparateur cantonal et prestations consolidées affichent le
// même impôt pour un même capital dans un même canton.
//
// L'impôt est PROGRESSIF (comme la loi) : deux retraits de 100'000 CHF sur
// deux années coûtent moins qu'un retrait unique de 200'000 CHF — c'est ce
// qui chiffre l'intérêt d'échelonner les retraits 3a / libre passage.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cantons qui imposent le capital à une FRACTION du barème ordinaire de
 * l'impôt sur le revenu, appliquée au capital seul (sans déduction) :
 *  - GE : un cinquième (art. 45 LIPP) ;
 *  - VD : un cinquième (art. 49 LI) ;
 *  - NE : un quart, taux minimal de 2,5 % pour le canton et autant pour la
 *    commune (art. 42 LCdir) ;
 *  - ZG : un tiers environ (fraction calée sur les montants publiés).
 * Recoupé avec les montants publiés 2025-2026 : NE 100'000 CHF et VD
 * 100'000 CHF au franc près, GE 500'000 CHF à 0,4 % près.
 */
const CAPITAL_TAX_SCALE_FRACTION: Record<string, { divisor: number; minRate?: number }> = {
  GE: { divisor: 5 },
  VD: { divisor: 5 },
  NE: { divisor: 4, minRate: 0.05 },
  ZG: { divisor: 3 },
};

type CapitalTaxPoints = Array<[capital: number, tax: number]>;

/**
 * Cantons à BARÈME SPÉCIAL (FR, JU) : impôt cantonal + communal relevé sur
 * les comparatifs publiés 2025-2026 (chef-lieu, sans confession), IFD
 * déduit ; interpolation linéaire entre les points, prolongée au-delà du
 * dernier point avec la pente du dernier segment.
 */
const CAPITAL_TAX_POINTS: Record<string, { single: CapitalTaxPoints; family?: CapitalTaxPoints }> = {
  FR: {
    single: [
      [100_000, 2_722],
      [250_000, 13_580],
      [500_000, 36_080],
      [1_000_000, 80_999],
    ],
    family: [
      [100_000, 2_360],
      [250_000, 12_686],
      [500_000, 35_186],
      [1_000_000, 80_100],
    ],
  },
  JU: {
    single: [
      [100_000, 5_636],
      [250_000, 17_493],
      [500_000, 37_680],
      [1_000_000, 78_056],
    ],
  },
};

function interpolateCapitalTax(capital: number, points: CapitalTaxPoints): number {
  const [firstCapital, firstTax] = points[0];
  // Sous le premier point : taux moyen du premier point.
  if (capital <= firstCapital) return (capital * firstTax) / firstCapital;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (capital <= x1) return y0 + ((capital - x0) / (x1 - x0)) * (y1 - y0);
  }
  const [x0, y0] = points[points.length - 2];
  const [x1, y1] = points[points.length - 1];
  return y1 + ((capital - x1) * (y1 - y0)) / (x1 - x0);
}

/**
 * Valais : taux propre aux prestations en capital, constant jusqu'à
 * 250'000 CHF puis croissant linéairement jusqu'à 1'000'000 CHF, plafonné
 * au-delà (canton + commune de Sion : 4,22 % → 8,0 % ; couples : environ
 * 2 % de moins). Calé sur les montants publiés 2025-2026.
 */
function valaisCapitalTax(capital: number, family: boolean): number {
  const LOW = 0.0422;
  const HIGH = 0.08;
  const rate =
    capital <= 250_000
      ? LOW
      : capital >= 1_000_000
        ? HIGH
        : LOW + ((capital - 250_000) / 750_000) * (HIGH - LOW);
  return capital * rate * (family ? 0.98 : 1);
}

/**
 * Autres cantons : taux moyen constant (ordre de grandeur, non progressif).
 * L'avantage d'un retrait échelonné n'y est donc pas chiffré.
 */
export const CANTON_LUMP_SUM_RATE: Record<string, number> = {
  SZ: 0.03,
  OW: 0.032,
  NW: 0.033,
  AI: 0.033,
  UR: 0.035,
  AR: 0.038,
  LU: 0.038,
  GL: 0.042,
  TG: 0.044,
  SH: 0.045,
  SG: 0.045,
  GR: 0.047,
  AG: 0.048,
  SO: 0.05,
  ZH: 0.05,
  TI: 0.052,
  BE: 0.053,
  BL: 0.056,
  BS: 0.058,
};
const DEFAULT_LUMP_SUM_RATE = 0.045;

/** Part cantonale + communale de l'impôt sur une prestation en capital. */
export function cantonalCapitalTax(
  capital: number,
  canton: string,
  status: "single" | "married" | "single_with_children",
): number {
  if (capital <= 0) return 0;
  const family = status !== "single";

  const fraction = CAPITAL_TAX_SCALE_FRACTION[canton];
  if (fraction) {
    const ordinary = computeCantonalCommunal({
      canton,
      taxableIncome: capital,
      status,
      children: 0,
      confession: "none",
    });
    const tax = (ordinary.cantonal + ordinary.communal) / fraction.divisor;
    return Math.max(tax, capital * (fraction.minRate ?? 0));
  }
  if (canton === "VS") return valaisCapitalTax(capital, family);

  const points = CAPITAL_TAX_POINTS[canton];
  if (points) {
    return interpolateCapitalTax(capital, family && points.family ? points.family : points.single);
  }
  return capital * (CANTON_LUMP_SUM_RATE[canton] ?? DEFAULT_LUMP_SUM_RATE);
}

/** Impôt unique sur prestation en capital, imposée séparément du revenu.
 *
 * IFD (art. 38 LIFD) : un cinquième du barème ordinaire, appliqué au
 * capital lui-même — aucune déduction (ni cotisations sociales, ni frais
 * professionnels, ni déductions sociales), contrairement à un salaire.
 * Cantonal + communal : voir cantonalCapitalTax (progressif pour GE, VD,
 * NE, VS, FR, JU et ZG).
 */
export function capitalWithdrawalTax(opts: {
  capital: number;
  canton: string;
  status: "single" | "married" | "single_with_children";
}): { ifd: number; cantonal: number; total: number } {
  if (opts.capital <= 0) return { ifd: 0, cantonal: 0, total: 0 };
  const ifdReduced = computeIFD(opts.capital, opts.status) / 5;
  const cantonal = cantonalCapitalTax(opts.capital, opts.canton, opts.status);
  return {
    ifd: Math.round(ifdReduced),
    cantonal: Math.round(cantonal),
    total: Math.round(ifdReduced + cantonal),
  };
}
