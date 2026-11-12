// Module frontaliers · régime France-Suisse (Suisse romande v1).
// Sources : Convention fiscale FR-CH 1966, Accord du 11.04.1983.
//
// === SCOPE V1, Suisse romande ===
//
// Régimes couverts :
//   - "fr_accord_45" : VD, VS, NE, JU (accord de 1983 : imposition du
//                      salaire en France uniquement ; la compensation de
//                      4,5 % est versée d'État à État, jamais retenue sur
//                      le salaire)
//   - "fr_geneva"    : GE (IS genevoise ; reversement de 3,5 % de la masse
//                      salariale aux départements français, accord de 1973)
//   - "fr_fribourg"  : FR (IS cantonale Fribourg, hors accord 1983)
//
// CALIBRATION genevaSourceTax 04/06/2026 :
// Taux effectifs officiels tar26GE 2026 (Swissdec ELM 5.0).
// Source : État de Genève, barèmes perception IS 2026.
// Interpolation linéaire entre points de référence officiels.

import { estimateSocialContributions } from "./income";
import { GE_IS_RATES_2026 } from "./ge-source-2026";
import { interpolateRate, officialSourceRate } from "./source-tables";

export type CrossBorderRegime =
  | "fr_accord_45"
  | "fr_geneva"
  | "fr_fribourg";

export interface CrossBorderInput {
  workCanton: string;
  grossAnnualSalary: number;
  status: "single" | "married";
  children?: number;
  /** Nombre d'enfants de moins de 6 ans (crédit d'impôt français pour frais
   *  de garde hors du domicile). Non renseigné = tous les enfants à charge. */
  childrenUnder6?: number;
  spouseEmployed?: boolean;
  spouseGrossSalary?: number;
  /** Cours fiscal : 1 EUR = X CHF (même convention que AFC_ANNUAL_RATES). */
  eurChfRate?: number;
  /** Âge, plan LPP et salaire assuré : servent uniquement à estimer les
   *  cotisations sociales suisses (AVS/AI/APG, AC, AANP, LPP), déductibles
   *  du salaire imposable en France — mêmes règles que l'impôt ordinaire
   *  (estimateSocialContributions), pour que le net social d'un même client
   *  soit identique d'un calculateur à l'autre. */
  age?: number;
  lppPlan?: "mandatory" | "cadres" | "1e";
  lppInsuredSalary?: number;
  childCareCostsCHF?: number;
  donationsCHF?: number;
}

export interface CrossBorderResult {
  regime: CrossBorderRegime;
  regimeLabel: string;
  swissTax: number;
  swissRate: number;
  foreignTax: number;
  foreignRate: number;
  totalTax: number;
  totalRate: number;
  netAnnual: number;
  marginalRate: number;
  notes: string[];
  alternative?: {
    regime: CrossBorderRegime;
    label: string;
    totalTax: number;
    netAnnual: number;
    delta: number;
  };
}

export const FR_ACCORD_CANTONS = ["JU", "NE", "VD", "VS"] as const;
export function isFrAccordCanton(canton: string): boolean {
  return (FR_ACCORD_CANTONS as readonly string[]).includes(canton);
}

// =====================================================================
// Impôt sur le revenu français — barème 2026 (revenus 2025), loi de
// finances pour 2026 du 19.02.2026 (revalorisation de 0,9 %).
// =====================================================================
export const FR_IR_2026 = {
  brackets: [
    { upTo: 11_600, rate: 0 },
    { upTo: 29_579, rate: 0.11 },
    { upTo: 84_577, rate: 0.3 },
    { upTo: 181_917, rate: 0.41 },
    { upTo: Infinity, rate: 0.45 },
  ],
  /** Déduction forfaitaire de 10 % pour frais professionnels, par salarié. */
  abatementRate: 0.1,
  abatementMin: 509,
  abatementMax: 14_556,
  /** Avantage maximal par demi-part supplémentaire (plafonnement du quotient familial). */
  quotientCapPerHalfPart: 1_807,
  /** Décote : plafond − 45,25 % de l'impôt brut. */
  decoteSingle: 897,
  decoteCouple: 1_483,
  decoteRate: 0.4525,
  /** Crédit d'impôt garde d'enfants de moins de 6 ans hors du domicile. */
  childcareCreditRate: 0.5,
  childcareCapPerChild: 3_500,
  /** Réduction d'impôt pour dons (66 %, dans la limite de 20 % du revenu imposable). */
  donationReductionRate: 0.66,
  donationIncomeCap: 0.2,
} as const;

/** Nombre de parts pour charges de famille : ½ part pour chacun des deux
 *  premiers enfants, 1 part entière à partir du troisième. */
export function frenchChildParts(children: number): number {
  const n = Math.max(0, Math.floor(children));
  return n <= 2 ? n * 0.5 : n - 1;
}

function frenchBracketTax(perPart: number): number {
  let tax = 0;
  let prev = 0;
  for (const b of FR_IR_2026.brackets) {
    if (perPart > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += Math.max(0, perPart - prev) * b.rate;
      break;
    }
  }
  return tax;
}

/** Impôt brut français sur un revenu net imposable (EUR), avec quotient
 *  familial plafonné et décote. Exportée pour les tests. */
export function frenchIncomeTax(
  taxableEur: number,
  status: "single" | "married",
  children: number,
): number {
  const taxable = Math.max(0, taxableEur);
  const baseParts = status === "married" ? 2 : 1;
  const childParts = frenchChildParts(children);
  const taxFor = (parts: number) => frenchBracketTax(taxable / parts) * parts;
  const withoutChildren = taxFor(baseParts);
  const withChildren = taxFor(baseParts + childParts);
  // Plafonnement du quotient familial : les parts des enfants ne peuvent pas
  // réduire l'impôt de plus de 1'807 € par demi-part.
  const capped = Math.max(
    withChildren,
    withoutChildren - childParts * 2 * FR_IR_2026.quotientCapPerHalfPart,
  );
  const decoteCap = status === "married" ? FR_IR_2026.decoteCouple : FR_IR_2026.decoteSingle;
  const decote = Math.max(0, decoteCap - FR_IR_2026.decoteRate * capped);
  return Math.max(0, capped - decote);
}

/** Déduction forfaitaire de 10 % (bornée) sur un salaire net de cotisations. */
function afterFrenchAbatement(netSalaryEur: number): number {
  if (netSalaryEur <= 0) return 0;
  const abatement = Math.min(
    FR_IR_2026.abatementMax,
    Math.max(FR_IR_2026.abatementMin, netSalaryEur * FR_IR_2026.abatementRate),
  );
  return Math.max(0, netSalaryEur - abatement);
}

export interface FrenchTaxableSalary {
  /** Cotisations sociales suisses estimées (AVS/AI/APG, AC, AANP, LPP), CHF. */
  socialCHF: number;
  /** Salaire net de cotisations, converti en euros. */
  netEur: number;
  /** Déduction forfaitaire de 10 % (bornée), en euros. */
  abatementEur: number;
  /** Salaire net imposable en France, en euros. */
  taxableEur: number;
}

/** Salaire suisse tel qu'il entre dans le revenu imposable français : net des
 *  cotisations sociales suisses, converti en euros, après déduction
 *  forfaitaire de 10 %. Source unique pour l'impôt français du frontalier ET
 *  pour le revenu fiscal de référence servant d'assiette à la CMU. */
export function frenchTaxableSalary(opts: {
  grossCHF: number;
  /** 1 EUR = X CHF */
  eurChfRate: number;
  age?: number;
  lppPlan?: "mandatory" | "cadres" | "1e";
  lppInsuredSalary?: number;
}): FrenchTaxableSalary {
  const gross = Math.max(0, opts.grossCHF);
  const social = estimateSocialContributions(
    gross,
    opts.age ?? 40,
    opts.lppPlan ?? "mandatory",
    opts.lppInsuredSalary,
  );
  const socialCHF = social.avs + social.ac + social.anp + social.lpp;
  const netEur = Math.max(0, gross - socialCHF) / opts.eurChfRate;
  const taxableEur = afterFrenchAbatement(netEur);
  return { socialCHF, netEur, abatementEur: netEur - taxableEur, taxableEur };
}

interface FrenchSide {
  /** Impôt français du foyer, en CHF. */
  taxCHF: number;
  /** Cotisations sociales suisses déduites du salaire (CHF). */
  socialCHF: number;
  /** Crédit garde d'enfants + réduction dons effectivement imputés (CHF). */
  reliefCHF: number;
}

/** Impôt français du foyer pour un salaire suisse donné (résident fiscal
 *  français, déclaration 2042 + 2047). */
function frenchSide(input: CrossBorderInput, grossCHF: number): FrenchSide {
  const eurChf = input.eurChfRate && input.eurChfRate > 0 ? input.eurChfRate : 0.95;
  const toEur = (chf: number) => chf / eurChf;
  const toChf = (eur: number) => eur * eurChf;
  const children = input.children ?? 0;

  const own = frenchTaxableSalary({
    grossCHF,
    eurChfRate: eurChf,
    age: input.age,
    lppPlan: input.lppPlan,
    lppInsuredSalary: input.lppInsuredSalary,
  });
  const socialCHF = own.socialCHF;
  const ownTaxable = own.taxableEur;
  // Conjoint : lieu de travail inconnu (France ou Suisse), salaire repris
  // tel que saisi, sans déduction de cotisations suisses.
  const spouseTaxable =
    input.status === "married" ? afterFrenchAbatement(toEur(input.spouseGrossSalary ?? 0)) : 0;
  const taxableEur = ownTaxable + spouseTaxable;

  const grossTaxEur = frenchIncomeTax(taxableEur, input.status, children);
  const donationsEur = Math.min(
    toEur(input.donationsCHF ?? 0),
    taxableEur * FR_IR_2026.donationIncomeCap,
  );
  const eligibleChildren = Math.min(children, input.childrenUnder6 ?? children);
  const childcareEur = Math.min(
    toEur(input.childCareCostsCHF ?? 0),
    eligibleChildren * FR_IR_2026.childcareCapPerChild,
  );
  const reliefEur = Math.min(
    grossTaxEur,
    donationsEur * FR_IR_2026.donationReductionRate +
      childcareEur * FR_IR_2026.childcareCreditRate,
  );
  return {
    taxCHF: toChf(grossTaxEur - reliefEur),
    socialCHF,
    reliefCHF: toChf(reliefEur),
  };
}

/** Taux marginal (%) par dérivée numérique : impôt supplémentaire pour
 *  1'200 CHF de salaire annuel en plus (100 CHF/mois, même pas que
 *  computeSourceTax). */
const MARGINAL_STEP_CHF = 1_200;
function numericMarginalRate(taxAt: (gross: number) => number, gross: number): number {
  const delta = taxAt(gross + MARGINAL_STEP_CHF) - taxAt(gross);
  return Math.max(0, Math.round((delta / MARGINAL_STEP_CHF) * 1000) / 10);
}

// Barèmes IS Genève 2026 : tables officielles complètes (A0, B0-B5, C0-C5,
// H1-H5) dans ./ge-source-2026.ts, générées depuis le document « Barèmes
// 2026 impôt à la source » de l'État de Genève.
export { GE_IS_RATES_2026 };

const FR_IS_RATES_2026: Record<string, [number, number][]> = {
  // Source : calculette officielle fr.ch — relevés officiels 04/06/2026
  A0: [
    [29_400, 0], [50_000, 8.65], [100_000, 14.97],
    [150_000, 18.90], [200_000, 22.83], [300_000, 27.05],
  ],
  // B1 interpolé entre A0 et B2
  B1: [
    [29_400, 0], [50_000, 2.50], [100_000, 7.80],
    [150_000, 12.00], [200_000, 16.00], [300_000, 21.90],
  ],
  B0: [
    [29_400, 0], [50_000, 4.38], [100_000, 9.97],
    [150_000, 13.67], [200_000, 17.49], [300_000, 23.09],
  ],
  B2: [
    [29_400, 0], [50_000, 0.37], [100_000, 5.59],
    [150_000, 10.37], [200_000, 14.19], [300_000, 20.74],
  ],
  B3: [
    [29_400, 0], [50_000, 0], [100_000, 3.70],
    [150_000, 8.53], [200_000, 12.58], [300_000, 19.49],
  ],
  C0: [
    [29_400, 0], [50_000, 8.42], [100_000, 13.71],
    [150_000, 17.29], [200_000, 20.67], [300_000, 25.24],
  ],
  // C1 interpolé entre C0 et C2
  C1: [
    [29_400, 0], [50_000, 5.80], [100_000, 11.30],
    [150_000, 15.20], [200_000, 19.00], [300_000, 24.00],
  ],
  // C2 interpolé entre C1 et C3
  C2: [
    [29_400, 0], [50_000, 4.00], [100_000, 10.10],
    [150_000, 14.30], [200_000, 18.20], [300_000, 23.40],
  ],
  C3: [
    [29_400, 0], [50_000, 2.25], [100_000, 8.95],
    [150_000, 13.50], [200_000, 17.51], [300_000, 22.89],
  ],
  G0: [
    [29_400, 0], [50_000, 11.18], [100_000, 17.46],
    [150_000, 21.67], [200_000, 25.59], [300_000, 29.37],
  ],
  // H0 interpolé entre G0 et H1
  H0: [
    [29_400, 0], [50_000, 6.50], [100_000, 12.90],
    [150_000, 17.00], [200_000, 20.90], [300_000, 26.00],
  ],
  H1: [
    [29_400, 0], [50_000, 1.83], [100_000, 8.37],
    [150_000, 12.58], [200_000, 16.72], [300_000, 22.55],
  ],
  H2: [
    [29_400, 0], [50_000, 0.43], [100_000, 5.98],
    [150_000, 10.95], [200_000, 15.04], [300_000, 21.38],
  ],
  H3: [
    [29_400, 0], [50_000, 0], [100_000, 4.05],
    [150_000, 9.13], [200_000, 13.37], [300_000, 20.12],
  ],
};

function interpolateFRRate(annualGross: number, scaleKey: string): number {
  const pts = FR_IS_RATES_2026[scaleKey] ?? FR_IS_RATES_2026["A0"];
  if (annualGross <= pts[0][0]) return 0;
  if (annualGross >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (annualGross <= x1) {
      return y0 + ((annualGross - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Taux d'un barème avec enfants quand la table ne va pas assez loin : au-delà
 * du dernier sous-indice disponible, chaque enfant supplémentaire retire le
 * même écart que le dernier enfant couvert par la table.
 */
function rateWithChildren(
  lookup: (scaleKey: string) => number,
  letter: string,
  children: number,
  maxIndexed: number,
): number {
  const n = Math.max(0, Math.floor(children));
  if (n <= maxIndexed) return lookup(`${letter}${n}`);
  const last = lookup(`${letter}${maxIndexed}`);
  const step = Math.max(0, lookup(`${letter}${maxIndexed - 1}`) - last);
  return Math.max(0, last - (n - maxIndexed) * step);
}

export function interpolateGERate(annualGross: number, scaleKey: string): number {
  return interpolateRate(GE_IS_RATES_2026[scaleKey] ?? GE_IS_RATES_2026["A0"], annualGross);
}

/** Taux IS Genève 2026 (%) pour un barème (lettre A/B/C/H) et un nombre
 *  d'enfants — barème officiel, voir source-tables.ts. */
export function geSourceRate(annualGross: number, letter: string, children: number): number {
  return officialSourceRate("GE", annualGross, letter, children) ?? 0;
}

/** Taux IS Fribourg 2026 (%) pour un barème et un nombre d'enfants (tables
 *  jusqu'à 3 enfants). */
export function frSourceRate(annualGross: number, letter: string, children: number): number {
  return rateWithChildren((k) => interpolateFRRate(annualGross, k), letter, children, 3);
}

/**
 * Barème retenu par l'employeur pour un frontalier, d'après sa déclaration :
 *  - marié : B (un seul revenu) ou C (deux revenus), avec le nombre
 *    d'enfants à charge (B1, C2…), appliqué d'office ;
 *  - non marié : A0, même avec des enfants — le barème H (famille
 *    monoparentale) ne s'obtient que sur demande de rectification.
 */
function crossBorderScale(
  status: "single" | "married",
  children: number,
  spouseEmployed: boolean,
): { letter: string; children: number } {
  if (status === "single") return { letter: "A", children: 0 };
  return { letter: spouseEmployed ? "C" : "B", children };
}

function friburgSourceTax(
  grossAnnual: number,
  status: "single" | "married",
  children: number,
  spouseEmployed: boolean = false,
): number {
  const scale = crossBorderScale(status, children, spouseEmployed);
  const rate = frSourceRate(grossAnnual, scale.letter, scale.children);
  return Math.round((grossAnnual * rate) / 100);
}

function genevaSourceTax(
  grossAnnual: number,
  status: "single" | "married",
  children: number,
  spouseEmployed: boolean = false,
): number {
  const scale = crossBorderScale(status, children, spouseEmployed);
  const rate = geSourceRate(grossAnnual, scale.letter, scale.children);
  return Math.round((grossAnnual * rate) / 100);
}

export function computeCrossBorder(input: CrossBorderInput): CrossBorderResult {
  const children = input.children ?? 0;
  const gross = Math.max(0, input.grossAnnualSalary);
  const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 1000) / 10 : 0);
  const fr = frenchSide(input, gross);
  const frenchTaxAt = (g: number) => frenchSide(input, g).taxCHF;
  const hasFrRelief = fr.reliefCHF > 0;

  if (isFrAccordCanton(input.workCanton)) {
    // Accord du 11 avril 1983 : le salaire n'est imposable QUE dans l'État de
    // résidence. Aucun impôt n'est retenu sur le salaire en Suisse (sur
    // remise de l'attestation de résidence fiscale à l'employeur) ; les
    // 4,5 % sont une compensation versée d'État à État, pas un impôt du
    // salarié.
    // Taux rapportés au revenu du foyer : l'impôt français porte sur les
    // deux salaires du couple (imposition commune).
    const householdGross =
      gross + (input.status === "married" ? Math.max(0, input.spouseGrossSalary ?? 0) : 0);
    const total = fr.taxCHF;
    const notes = [
      "Accord franco-suisse de 1983 : salaire imposé uniquement en France. Aucun impôt à la source n'est retenu en Suisse, à condition de remettre chaque année à l'employeur l'attestation de résidence fiscale française (formulaire 2041-AS).",
      "Les 4,5 % de l'accord sont une compensation versée par la France au canton sur la masse salariale : ils ne sont pas prélevés sur le salaire du frontalier.",
      `Impôt français estimé au barème 2026 : salaire converti en euros, net des cotisations sociales suisses (AVS/AI/APG, AC, AANP, LPP ≈ ${Math.round(fr.socialCHF).toLocaleString("fr-CH")} CHF), déduction forfaitaire de 10 %, quotient familial plafonné.`,
      hasFrRelief
        ? `Avantages fiscaux français pris en compte : ${Math.round(fr.reliefCHF).toLocaleString("fr-CH")} CHF (crédit d'impôt garde d'enfants de moins de 6 ans, réduction pour dons).`
        : "3e pilier A, rachat LPP facultatif, intérêts hypothécaires : pas de déduction côté français. Seuls les frais de garde (enfants de moins de 6 ans) et les dons ouvrent un avantage fiscal en France.",
    ];
    return {
      regime: "fr_accord_45",
      regimeLabel: `Accord franco-suisse de 1983, imposition en France (${input.workCanton})`,
      swissTax: 0,
      swissRate: 0,
      foreignTax: Math.round(fr.taxCHF),
      foreignRate: pct(fr.taxCHF, householdGross),
      totalTax: Math.round(total),
      totalRate: pct(total, householdGross),
      netAnnual: Math.round(householdGross - total),
      marginalRate: numericMarginalRate(frenchTaxAt, gross),
      notes,
    };
  }

  // Marié : les enfants sont déjà dans le barème (B1, C2…). Non marié avec
  // enfants : barème A0 par défaut, le barème H se demande par rectification.
  const rectificationNote =
    children > 0 && input.status === "single"
      ? [
          `Barème A0 appliqué par défaut, sans ${children > 1 ? "les enfants" : "l'enfant"} à charge : le barème H (famille monoparentale) s'obtient sur demande de rectification auprès de l'administration cantonale, avant le 31 mars de l'année suivante.`,
        ]
      : [];

  if (input.workCanton === "FR") {
    const spouseEmployed = input.spouseEmployed ?? false;
    const taxAt = (g: number) => friburgSourceTax(g, input.status, children, spouseEmployed);
    const swissTax = taxAt(gross);
    return {
      regime: "fr_fribourg",
      regimeLabel: "Fribourg, impôt à la source (barème cantonal FR)",
      swissTax: Math.round(swissTax),
      swissRate: pct(swissTax, gross),
      foreignTax: 0,
      foreignRate: 0,
      totalTax: Math.round(swissTax),
      totalRate: pct(swissTax, gross),
      netAnnual: Math.round(gross - swissTax),
      marginalRate: numericMarginalRate(taxAt, gross),
      notes: [
        "Fribourg n'est pas couvert par l'accord franco-suisse de 1983.",
        "L'impôt est prélevé à la source par l'employeur selon le barème cantonal FR ; la France accorde un crédit d'impôt équivalent à l'impôt français sur ce salaire.",
        "Possibilité de demander la TOU si quasi-résident (≥90% des revenus en CH).",
        ...rectificationNote,
      ],
    };
  }
  if (input.workCanton === "GE") {
    const spouseEmployed = input.spouseEmployed ?? false;
    const taxAt = (g: number) => genevaSourceTax(g, input.status, children, spouseEmployed);
    const swissTax = taxAt(gross);
    const total = swissTax;
    // Repère : ce que le même salaire coûterait s'il était imposé en France
    // (régime de l'accord de 1983).
    const altTotal = fr.taxCHF;
    return {
      regime: "fr_geneva",
      regimeLabel: "Genève, impôt à la source genevois",
      swissTax: Math.round(swissTax),
      swissRate: pct(swissTax, gross),
      foreignTax: 0,
      foreignRate: 0,
      totalTax: Math.round(total),
      totalRate: pct(total, gross),
      netAnnual: Math.round(gross - total),
      marginalRate: numericMarginalRate(taxAt, gross),
      notes: [
        "Genève impose le salaire à la source (accord de 1973, pas l'accord de 1983).",
        "Genève reverse 3,5 % de la masse salariale brute aux départements français de résidence : ce reversement ne change rien à l'impôt du frontalier.",
        "En France, le salaire genevois est déclaré mais ouvre droit à un crédit d'impôt égal à l'impôt français correspondant : pas de double imposition. Les autres revenus du foyer restent imposés en France au taux effectif.",
        "Vérifier l'éligibilité TOU (quasi-résident) si déductions élevées : 3e pilier A, rachat LPP, intérêts hypothécaires.",
        ...rectificationNote,
      ],
      alternative: {
        regime: "fr_accord_45",
        label: "Si le salaire était imposé en France (accord 1983)",
        totalTax: Math.round(altTotal),
        netAnnual: Math.round(gross - altTotal),
        delta: Math.round(altTotal - total),
      },
    };
  }

  return {
    regime: "fr_accord_45",
    regimeLabel: `Canton ${input.workCanton} (hors scope v1)`,
    swissTax: 0,
    swissRate: 0,
    foreignTax: 0,
    foreignRate: 0,
    totalTax: 0,
    totalRate: 0,
    netAnnual: input.grossAnnualSalary,
    marginalRate: 0,
    notes: [
      `Le canton ${input.workCanton} n'est pas couvert en v1 (Suisse romande uniquement).`,
      "Cantons disponibles v1 : GE, VD, VS, FR, NE, JU.",
    ],
  };
}
