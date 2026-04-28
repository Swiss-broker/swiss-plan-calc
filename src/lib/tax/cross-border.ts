// Module frontaliers · régimes France-Suisse et Italie-Tessin
// Sources : Convention fiscale FR-CH 1966, Accord 1983 (4.5%), accord italo-suisse 2020.

export type CrossBorderRegime =
  | "fr_accord_45" // 8 cantons : BE, BL, BS, JU, NE, SO, VD, VS
  | "fr_geneva" // GE : imposition à la source genevoise + rétrocession
  | "it_ticino"; // TI : nouvel accord 2023 (résidents italiens travaillant TI)

export interface CrossBorderInput {
  /** Canton de travail */
  workCanton: string;
  /** Salaire annuel brut (CHF) */
  grossAnnualSalary: number;
  /** Statut civil pour barème français/italien estimé */
  status: "single" | "married";
  /** Nombre d'enfants à charge (impact fiscalité du pays de résidence) */
  children?: number;
  /** Conjoint qui travaille (impact barème C en CH) */
  spouseEmployed?: boolean;
  /** Salaire conjoint annuel (CHF) si travaille en CH ou équivalent EUR converti */
  spouseGrossSalary?: number;
  /** Taux de change EUR/CHF (défaut 0.95) */
  eurChfRate?: number;
}

export interface CrossBorderResult {
  regime: CrossBorderRegime;
  regimeLabel: string;
  swissTax: number; // retenue suisse annuelle CHF
  swissRate: number; // %
  foreignTax: number; // impôt pays de résidence CHF (estimation)
  foreignRate: number; // %
  totalTax: number;
  totalRate: number;
  netAnnual: number;
  notes: string[];
  // Comparatif si plusieurs régimes possibles
  alternative?: {
    regime: CrossBorderRegime;
    label: string;
    totalTax: number;
    netAnnual: number;
    delta: number; // positif = ce régime est plus cher que celui retenu
  };
}

// Cantons appliquant l'accord franco-suisse 1983 (retenue 4.5% rétrocédée à FR)
export const FR_ACCORD_CANTONS = ["BE", "BL", "BS", "JU", "NE", "SO", "VD", "VS"] as const;

export function isFrAccordCanton(canton: string): boolean {
  return (FR_ACCORD_CANTONS as readonly string[]).includes(canton);
}

/**
 * Estimation barème impôt sur le revenu France 2026 (célibataire / couple)
 * Tranches officielles 2025 indexées (DGFiP).
 */
function frenchIncomeTax(taxableEur: number, status: "single" | "married", children: number): number {
  // Quotient familial : 1 part célib, 2 parts couple, +0.5 par enfant (1 et 2), +1 dès le 3ème
  let parts = status === "married" ? 2 : 1;
  parts += children >= 3 ? 1 + (children - 1) : children * 0.5;
  const perPart = taxableEur / parts;

  // Barème 2025 (à partir 2026 selon LFI)
  const brackets = [
    { upTo: 11_497, rate: 0 },
    { upTo: 29_315, rate: 0.11 },
    { upTo: 83_823, rate: 0.30 },
    { upTo: 180_294, rate: 0.41 },
    { upTo: Infinity, rate: 0.45 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (perPart > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (perPart - prev) * b.rate;
      break;
    }
  }
  return Math.max(0, tax * parts);
}

/**
 * Estimation IRPEF Italie 2026 (résident italien, travaille au Tessin)
 * Barèmes IRPEF 2024-2026 + addizionali régionale/communale moyennes (~2%).
 */
function italianIncomeTax(taxableEur: number, children: number): number {
  // Barème IRPEF 2024 (3 tranches)
  const brackets = [
    { upTo: 28_000, rate: 0.23 },
    { upTo: 50_000, rate: 0.35 },
    { upTo: Infinity, rate: 0.43 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (taxableEur > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (taxableEur - prev) * b.rate;
      break;
    }
  }
  // Addizionali régionale + communale (Lombardie ~1.7% + 0.8%)
  tax += taxableEur * 0.025;
  // Détraction enfants à charge (~950 EUR par enfant)
  tax = Math.max(0, tax - children * 950);
  return tax;
}

/** Approximation impôt à la source GE pour résidents français */
function genevaSourceTax(grossAnnual: number, status: "single" | "married", children: number): number {
  // GE est l'un des cantons à fiscalité élevée à la source.
  // Approximation moyenne calibrée sur les barèmes A0–A6 / B0–B6 GE 2026.
  const monthly = grossAnnual / 12;
  let rate = 0;
  if (status === "single") {
    if (monthly < 4_000) rate = 4;
    else if (monthly < 7_000) rate = 4 + ((monthly - 4_000) / 3_000) * 8;
    else if (monthly < 12_000) rate = 12 + ((monthly - 7_000) / 5_000) * 9;
    else if (monthly < 20_000) rate = 21 + ((monthly - 12_000) / 8_000) * 6;
    else rate = 27;
  } else {
    if (monthly < 5_500) rate = 1.5;
    else if (monthly < 9_000) rate = 1.5 + ((monthly - 5_500) / 3_500) * 7;
    else if (monthly < 15_000) rate = 8.5 + ((monthly - 9_000) / 6_000) * 8;
    else if (monthly < 25_000) rate = 16.5 + ((monthly - 15_000) / 10_000) * 5;
    else rate = 22;
  }
  // Réduction enfants
  rate = Math.max(0, rate - children * 1.2);
  return (grossAnnual * rate) / 100;
}

export function computeCrossBorder(input: CrossBorderInput): CrossBorderResult {
  const eur = input.eurChfRate ?? 0.95;
  const children = input.children ?? 0;
  const grossEur = input.grossAnnualSalary * eur;
  const spouseEur = (input.spouseGrossSalary ?? 0) * eur;
  // Abattement forfaitaire 10% (frais professionnels FR)
  const taxableFR = (grossEur + spouseEur) * 0.9;

  // ===== Régime 1 : Accord 4.5% (8 cantons) =====
  if (isFrAccordCanton(input.workCanton)) {
    const swissTax = input.grossAnnualSalary * 0.045;
    const frTax = frenchIncomeTax(taxableFR, input.status, children);
    const frTaxChf = frTax / eur;
    const total = swissTax + frTaxChf;
    return {
      regime: "fr_accord_45",
      regimeLabel: `Accord franco-suisse 4.5 % (${input.workCanton})`,
      swissTax: Math.round(swissTax),
      swissRate: 4.5,
      foreignTax: Math.round(frTaxChf),
      foreignRate: Math.round((frTaxChf / input.grossAnnualSalary) * 1000) / 10,
      totalTax: Math.round(total),
      totalRate: Math.round((total / input.grossAnnualSalary) * 1000) / 10,
      netAnnual: Math.round(input.grossAnnualSalary - total),
      notes: [
        "Retenue suisse : 4.5 % du brut, intégralement rétrocédée à la France.",
        "Imposition principale en France au barème progressif après abattement 10 %.",
        "Le crédit d'impôt français évite la double imposition (méthode du taux effectif).",
      ],
    };
  }

  // ===== Régime 2 : Genève (résident FR travaille à GE) =====
  if (input.workCanton === "GE") {
    const swissTax = genevaSourceTax(input.grossAnnualSalary, input.status, children);
    // Imposition principale en Suisse, France garde un crédit d'impôt
    const frTaxResidual = frenchIncomeTax(taxableFR, input.status, children) * 0.05; // marginal ~5%
    const frTaxChf = frTaxResidual / eur;
    const total = swissTax + frTaxChf;
    // Comparatif : si GE était sous accord 4.5 %
    const altSwiss = input.grossAnnualSalary * 0.045;
    const altFR = frenchIncomeTax(taxableFR, input.status, children) / eur;
    const altTotal = altSwiss + altFR;
    return {
      regime: "fr_geneva",
      regimeLabel: "Genève · IS genevoise + rétrocession à la France",
      swissTax: Math.round(swissTax),
      swissRate: Math.round((swissTax / input.grossAnnualSalary) * 1000) / 10,
      foreignTax: Math.round(frTaxChf),
      foreignRate: Math.round((frTaxChf / input.grossAnnualSalary) * 1000) / 10,
      totalTax: Math.round(total),
      totalRate: Math.round((total / input.grossAnnualSalary) * 1000) / 10,
      netAnnual: Math.round(input.grossAnnualSalary - total),
      notes: [
        "Genève applique sa propre imposition à la source (pas l'accord 4.5 %).",
        "GE rétrocède 3.5 % du brut au département français de résidence.",
        "Imposition principale en CH ; la France n'impose que le revenu mondial via taux effectif.",
        "Vérifier l'éligibilité TOU si déductions élevées (intérêts d'emprunt résidence principale, 3a).",
      ],
      alternative: {
        regime: "fr_accord_45",
        label: "Si accord 4.5 % s'appliquait",
        totalTax: Math.round(altTotal),
        netAnnual: Math.round(input.grossAnnualSalary - altTotal),
        delta: Math.round(altTotal - total),
      },
    };
  }

  // ===== Régime 3 : Tessin · accord italo-suisse 2023 =====
  if (input.workCanton === "TI") {
    // Nouveaux frontaliers (à partir du 17.07.2023) : imposés en CH (max 80 % de l'IS)
    // ET en Italie (avec crédit d'impôt). Anciens frontaliers : imposés uniquement en CH.
    const monthly = input.grossAnnualSalary / 12;
    let rate = 0;
    if (monthly < 4_000) rate = 6;
    else if (monthly < 8_000) rate = 6 + ((monthly - 4_000) / 4_000) * 6;
    else if (monthly < 14_000) rate = 12 + ((monthly - 8_000) / 6_000) * 6;
    else rate = 18;
    rate -= children * 0.8;
    rate = Math.max(0, rate * 0.8); // accord : retenue limitée à 80 % de l'IS standard
    const swissTax = (input.grossAnnualSalary * rate) / 100;
    const itTax = italianIncomeTax(grossEur, children);
    const itTaxChf = itTax / eur;
    // Crédit d'impôt italien ~ impôt CH (méthode imputation)
    const itResidual = Math.max(0, itTaxChf - swissTax);
    const total = swissTax + itResidual;
    return {
      regime: "it_ticino",
      regimeLabel: "Tessin · accord italo-suisse 2023",
      swissTax: Math.round(swissTax),
      swissRate: Math.round(rate * 10) / 10,
      foreignTax: Math.round(itResidual),
      foreignRate: Math.round((itResidual / input.grossAnnualSalary) * 1000) / 10,
      totalTax: Math.round(total),
      totalRate: Math.round((total / input.grossAnnualSalary) * 1000) / 10,
      netAnnual: Math.round(input.grossAnnualSalary - total),
      notes: [
        "Nouveaux frontaliers (depuis 17.07.2023) : imposition partagée CH/IT, retenue suisse plafonnée à 80 % de l'IS standard.",
        "Anciens frontaliers : imposition exclusive en Suisse (régime transitoire).",
        "L'Italie accorde un crédit d'impôt pour l'impôt déjà payé en CH (méthode d'imputation).",
        "Franchise IRPEF de 10 000 EUR pour les frontaliers (loi 83/2023).",
      ],
    };
  }

  // ===== Hors régime spécifique =====
  return {
    regime: "fr_accord_45",
    regimeLabel: `Canton ${input.workCanton} · pas d'accord frontalier spécifique`,
    swissTax: 0,
    swissRate: 0,
    foreignTax: 0,
    foreignRate: 0,
    totalTax: 0,
    totalRate: 0,
    netAnnual: input.grossAnnualSalary,
    notes: [
      `Le canton ${input.workCanton} n'a pas d'accord frontalier France-Suisse.`,
      "Régime applicable à étudier au cas par cas (frontaliers DE pour BS/BL/SH/ZH/TG/AG ; AT pour SG/GR).",
    ],
  };
}
