// Module frontaliers · régime France-Suisse (Suisse romande v1).
// Sources : Convention fiscale FR-CH 1966, Accord 1983 (4.5%).
//
// === SCOPE V1, Suisse romande ===
//
// Régimes couverts :
//   - "fr_accord_45" : VD, VS, NE, JU, FR
//   - "fr_geneva"    : GE (IS genevoise classique + rétrocession 3.5 %)
//
// CALIBRATION genevaSourceTax 04/06/2026 :
// Taux effectifs officiels tar26GE 2026 (Swissdec ELM 5.0).
// Source : État de Genève, barèmes perception IS 2026.
// Interpolation linéaire entre points de référence officiels.

export type CrossBorderRegime =
  | "fr_accord_45"
  | "fr_geneva";

export interface CrossBorderInput {
  workCanton: string;
  grossAnnualSalary: number;
  status: "single" | "married";
  children?: number;
  spouseEmployed?: boolean;
  spouseGrossSalary?: number;
  eurChfRate?: number;
  mortgageInterestCHF?: number;
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

export const FR_ACCORD_CANTONS = ["JU", "NE", "VD", "VS", "FR"] as const;

export function isFrAccordCanton(canton: string): boolean {
  return (FR_ACCORD_CANTONS as readonly string[]).includes(canton);
}

function frenchIncomeTax(taxableEur: number, status: "single" | "married", children: number): number {
  let parts = status === "married" ? 2 : 1;
  parts += children >= 3 ? 1 + (children - 1) : children * 0.5;
  const perPart = taxableEur / parts;
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

// =====================================================================
// Barèmes IS Genève 2026 — taux effectifs officiels tar26GE
// [revenu_annuel_CHF, taux_%] — interpolation linéaire
// =====================================================================
const GE_IS_RATES_2026: Record<string, [number, number][]> = {
  // Source : Barèmes IS GE 2026 officiels (tar26GE) — lecture directe PDF
  // Points : [revenu_annuel_CHF, taux_%]

  A0: [
    [29_400, 0], [36_000, 1.82], [48_000, 3.85], [60_000, 5.52],
    [72_000, 7.14], [96_000, 12.08], [120_000, 15.56], [150_000, 18.03],
    [200_000, 21.05], [300_000, 26.03],
  ],
  A1: [
    [29_400, 0], [48_000, 0], [60_000, 0.17], [72_000, 0.15],
    [84_000, 3.54], [96_000, 7.06], [120_000, 10.15], [150_000, 13.01],
    [200_000, 16.94], [300_000, 22.02],
  ],
  A2: [
    [29_400, 0], [60_000, 0], [72_000, 0], [84_000, 0],
    [96_000, 2.75], [120_000, 6.12], [150_000, 9.20], [200_000, 13.18],
    [300_000, 19.00],
  ],
  B0: [
    [29_400, 0], [48_000, 0], [60_000, 2.00], [72_000, 4.36],
    [84_000, 6.51], [96_000, 9.69], [120_000, 11.03], [150_000, 14.11],
    [200_000, 17.64], [300_000, 22.83],
  ],
  B1: [
    [29_400, 0], [60_000, 0], [72_000, 0], [84_000, 1.34],
    [96_000, 4.87], [120_000, 7.83], [150_000, 11.09], [200_000, 15.06],
    [300_000, 20.44],
  ],
  B2: [
    [29_400, 0], [60_000, 0], [72_000, 0], [84_000, 0],
    [100_000, 0.21], [120_000, 0.39], [150_000, 0.80], [200_000, 1.51],
    [300_000, 3.73],
  ],
  C0: [
    [29_400, 0], [48_000, 0.83], [60_000, 4.56], [72_000, 7.20],
    [84_000, 9.25], [96_000, 11.08], [120_000, 13.90], [150_000, 16.11],
    [200_000, 19.21], [300_000, 23.64],
  ],
  C1: [
    [29_400, 0], [48_000, 0], [60_000, 2.29], [72_000, 4.84],
    [84_000, 7.00], [96_000, 9.13], [120_000, 12.03], [150_000, 14.29],
    [200_000, 17.72], [300_000, 22.10],
  ],
  C2: [
    [29_400, 0], [48_000, 0], [60_000, 0], [72_000, 2.00],
    [84_000, 4.59], [96_000, 7.06], [120_000, 9.98], [150_000, 12.32],
    [200_000, 16.04], [300_000, 20.92],
  ],
  H0: [
    [29_400, 0], [48_000, 0.94], [60_000, 4.02], [72_000, 6.64],
    [84_000, 8.87], [96_000, 11.08], [120_000, 13.90], [150_000, 16.17],
    [200_000, 19.21], [300_000, 23.68],
  ],
  H1: [
    [29_400, 0], [60_000, 0], [72_000, 1.34], [84_000, 3.82],
    [96_000, 6.64], [120_000, 9.76], [150_000, 12.65], [200_000, 16.39],
    [300_000, 21.23],
  ],
  H2: [
    [29_400, 0], [60_000, 0], [72_000, 0], [84_000, 1.06],
    [96_000, 4.09], [120_000, 7.46], [150_000, 10.57], [200_000, 14.64],
    [300_000, 20.15],
  ],
};

function interpolateGERate(annualGross: number, scaleKey: string): number {
  const pts = GE_IS_RATES_2026[scaleKey] ?? GE_IS_RATES_2026["A0"];
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

function genevaSourceTax(
  grossAnnual: number,
  status: "single" | "married",
  children: number,
  spouseEmployed: boolean = false,
): number {
  const n = Math.min(children, 2);

  let scaleKey: string;
  if (status === "single") {
    scaleKey = n > 0 ? `A${n}` : "A0";
  } else {
    if (spouseEmployed) {
      scaleKey = n > 0 ? `C${n}` : "C0";
    } else {
      scaleKey = n > 0 ? `B${n}` : "B0";
    }
  }

  if (!GE_IS_RATES_2026[scaleKey]) scaleKey = "A0";

  const rate = interpolateGERate(grossAnnual, scaleKey);
  return Math.round((grossAnnual * rate) / 100);
}

export function computeCrossBorder(input: CrossBorderInput): CrossBorderResult {
  const eur = input.eurChfRate ?? 0.95;
  const children = input.children ?? 0;
  const grossEur = input.grossAnnualSalary * eur;
  const spouseEur = (input.spouseGrossSalary ?? 0) * eur;
  const baseAfterAbatement = (grossEur + spouseEur) * 0.9;
  const frEligibleChf =
    (input.mortgageInterestCHF ?? 0) +
    (input.childCareCostsCHF ?? 0) +
    (input.donationsCHF ?? 0);
  const frEligibleEur = frEligibleChf * eur;
  const taxableFR = Math.max(0, baseAfterAbatement - frEligibleEur);
  const marginal = frenchMarginalRate(taxableFR, input.status, children);
  const hasFrDeductions = frEligibleChf > 0;

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

  if (input.workCanton === "GE") {
    const spouseEmployed = input.spouseEmployed ?? false;
    const swissTax = genevaSourceTax(
      input.grossAnnualSalary,
      input.status,
      children,
      spouseEmployed,
    );
    const frTaxChf = 0;
    const total = swissTax + frTaxChf;
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