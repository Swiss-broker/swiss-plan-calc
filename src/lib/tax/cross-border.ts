// Module frontaliers · régime France-Suisse (Suisse romande v1).
// Sources : Convention fiscale FR-CH 1966, Accord 1983 (4.5%).
//
// === SCOPE V1, Suisse romande ===
//
// Régimes couverts :
//   - "fr_accord_45" : VD, VS, NE, JU, FR
//                      (la liste fédérale complète est BE, BL, BS, JU, NE,
//                      SO, VD, VS, BE/BL/BS/SO hors scope v1)
//   - "fr_geneva"    : GE (IS genevoise classique + rétrocession 3.5 %)
//
// Régime "it_ticino" (accord italo-suisse 2023) RETIRÉ en v1 puisque le
// Tessin est hors scope. Sera réintégré quand TI deviendra selectable.

export type CrossBorderRegime =
  | "fr_accord_45" // VD, VS, NE, JU, FR (v1, sous-ensemble romand de l'accord fédéral)
  | "fr_geneva"; // GE : imposition à la source genevoise + rétrocession

export interface CrossBorderInput {
  /** Canton de travail */
  workCanton: string;
  /** Salaire annuel brut (CHF) */
  grossAnnualSalary: number;
  /** Statut civil pour barème français estimé */
  status: "single" | "married";
  /** Nombre d'enfants à charge (impact fiscalité du pays de résidence) */
  children?: number;
  /** Conjoint qui travaille (impact barème C en CH) */
  spouseEmployed?: boolean;
  /** Salaire conjoint annuel (CHF) si travaille en CH ou équivalent EUR converti */
  spouseGrossSalary?: number;
  /** Taux de change EUR/CHF (défaut 0.95) */
  eurChfRate?: number;
  /**
   * Déductions FR-éligibles (en CHF, converties en EUR par le moteur).
   * Côté France, sont déductibles de l'assiette : intérêts d'emprunt résidence
   * principale (crédit d'impôt en pratique mais traités ici comme abattement),
   * frais de garde, dons à organismes d'intérêt général.
   * Le 3e pilier A / rachat LPP suisses ne sont PAS déductibles côté FR.
   */
  mortgageInterestCHF?: number;
  childCareCostsCHF?: number;
  donationsCHF?: number;
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
  /** Taux marginal côté pays de résidence (%, dernière tranche FR atteinte) */
  marginalRate: number;
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

/**
 * Cantons romands appliquant l'accord franco-suisse 1983 (retenue 4.5%
 * rétrocédée à FR). Sous-ensemble romand de la liste fédérale complète
 * ["BE","BL","BS","JU","NE","SO","VD","VS"]. Hors scope v1 : BE, BL, BS, SO.
 */
export const FR_ACCORD_CANTONS = ["JU", "NE", "VD", "VS", "FR"] as const;

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

/** Taux marginal FR (%, taux de la tranche atteinte par revenu/part). */
function frenchMarginalRate(taxableEur: number, status: "single" | "married", children: number): number {
  let parts = status === "married" ? 2 : 1;
  parts += children >= 3 ? 1 + (children - 1) : children * 0.5;
  const perPart = taxableEur / parts;
  const brackets = [
    { upTo: 11_497, rate: 0 },
    { upTo: 29_315, rate: 11 },
    { upTo: 83_823, rate: 30 },
    { upTo: 180_294, rate: 41 },
    { upTo: Infinity, rate: 45 },
  ];
  for (const b of brackets) {
    if (perPart <= b.upTo) return b.rate;
  }
  return 45;
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
  const baseAfterAbatement = (grossEur + spouseEur) * 0.9;
  // Déductions FR-éligibles (intérêts d'emprunt résidence principale FR,
  // frais de garde, dons), converties en EUR.
  const frEligibleChf =
    (input.mortgageInterestCHF ?? 0) +
    (input.childCareCostsCHF ?? 0) +
    (input.donationsCHF ?? 0);
  const frEligibleEur = frEligibleChf * eur;
  const taxableFR = Math.max(0, baseAfterAbatement - frEligibleEur);
  const marginal = frenchMarginalRate(taxableFR, input.status, children);
  const hasFrDeductions = frEligibleChf > 0;

  // ===== Régime 1 : Accord 4.5% (cantons romands sauf GE) =====
  if (isFrAccordCanton(input.workCanton)) {
    const swissTax = input.grossAnnualSalary * 0.045;
    const frTax = frenchIncomeTax(taxableFR, input.status, children);
    const frTaxChf = frTax / eur;
    const total = swissTax + frTaxChf;
    const notes = [
      "Retenue suisse : 4.5 % du brut, intégralement rétrocédée à la France.",
      "Imposition principale en France au barème progressif après abattement 10 %.",
      "Le crédit d'impôt français évite la double imposition (méthode du taux effectif).",
    ];
    if (hasFrDeductions) {
      notes.push(
        `Déductions FR-éligibles appliquées : ${Math.round(frEligibleChf).toLocaleString("fr-CH")} CHF (intérêts d'emprunt résidence principale FR, frais de garde, dons). 3e pilier A et rachat LPP suisses ignorés (non déductibles côté FR sous accord 1983).`,
      );
    } else {
      notes.push(
        "3a, rachat LPP, primes LAMal CH : NON déductibles côté FR. Seuls intérêts d'emprunt résidence FR, frais de garde et dons réduisent l'assiette française.",
      );
    }
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
      marginalRate: marginal,
      notes,
    };
  }

  // ===== Régime 2 : Genève (résident FR travaille à GE) =====
  if (input.workCanton === "GE") {
    const swissTax = genevaSourceTax(input.grossAnnualSalary, input.status, children);
    // Imposition principale en Suisse, France garde un crédit d'impôt (taux effectif).
    // Approximation : impôt FR ramené à 0 sauf si revenus FR séparés (hors scope ici).
    const frTaxChf = 0;
    const total = swissTax + frTaxChf;
    // Comparatif : si GE était sous accord 4.5 %
    const altSwiss = input.grossAnnualSalary * 0.045;
    const altFR = frenchIncomeTax(taxableFR, input.status, children) / eur;
    const altTotal = altSwiss + altFR;
    return {
      regime: "fr_geneva",
      regimeLabel: "Genève, IS genevoise + rétrocession à la France",
      swissTax: Math.round(swissTax),
      swissRate: Math.round((swissTax / input.grossAnnualSalary) * 1000) / 10,
      foreignTax: Math.round(frTaxChf),
      foreignRate: 0,
      totalTax: Math.round(total),
      totalRate: Math.round((total / input.grossAnnualSalary) * 1000) / 10,
      netAnnual: Math.round(input.grossAnnualSalary - total),
      marginalRate: marginal,
      notes: [
        "Genève applique sa propre imposition à la source (pas l'accord 4.5 %).",
        "GE rétrocède 3.5 % du brut au département français de résidence.",
        "Imposition principale en CH ; la France n'impose que via taux effectif (crédit d'impôt = impôt FR).",
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

  // ===== Hors scope v1 =====
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

