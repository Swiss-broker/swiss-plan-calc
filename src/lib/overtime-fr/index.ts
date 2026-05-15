// Heures supplémentaires — fiscalité côté Suisse + côté France pour les frontaliers.
// Pour les frontaliers du régime 1983, exonération d'impôt sur le revenu en France
// jusqu'à un plafond annuel (7'500 EUR en 2026, à valider).

export type OvertimeTaxStatus =
  | "cross_border_fr_1983"
  | "cross_border_ge"
  | "source_taxed"
  | "tou";

export interface OvertimeInput {
  taxStatus: OvertimeTaxStatus;
  workCanton: string;
  /** Salaire de base annuel (CHF), hors heures sup. */
  baseAnnualSalaryCHF: number;
  /** Montant brut annuel des heures supplémentaires (CHF). */
  overtimeAmountCHF: number;
  civilStatus: "single" | "married";
  childrenCount: number;
  spouseEmployed: boolean;
  spouseAnnualSalaryCHF?: number;
  /** Taux EUR / CHF utilisé pour la conversion (1 CHF = X EUR). */
  chfToEurRate: number;
  /** Taux marginal IR France estimé (en %), pour le régime 1983. */
  estimatedFrenchMarginalRate: number;
}

export interface OvertimeResult {
  status: OvertimeTaxStatus;
  overtimeCHF: number;
  /** Plafond d'exonération France appliqué (EUR). */
  exemptionCapEUR: number;
  exemptedAmountEUR: number;
  exemptedAmountCHF: number;
  swissTaxOnOvertime: number;
  swissRate: number;
  frenchTaxOnOvertime: number;
  frenchRate: number;
  totalTaxOnOvertime: number;
  netOvertimeCHF: number;
  taxSavings: number;
  notes: string[];
  hasFrenchExemption: boolean;
}

// Plafond 2026 d'exonération heures supplémentaires (paramètre modifiable).
export const FRENCH_OVERTIME_EXEMPTION_CAP_EUR_2026 = 7_500;
// Retenue Suisse accord 1983 : 4.5% du salaire brut (libératoire en France pour
// l'impôt mais s'applique uniformément sur les heures sup également).
const SWISS_RATE_FR_ACCORD = 4.5;

export function computeOvertime(input: OvertimeInput): OvertimeResult {
  const overtime = Math.max(0, Math.round(input.overtimeAmountCHF));
  const rate = input.chfToEurRate > 0 ? input.chfToEurRate : 1.05;
  const notes: string[] = [];
  const exemptionCapEUR = FRENCH_OVERTIME_EXEMPTION_CAP_EUR_2026;
  let swissTax = 0;
  let swissRate = 0;
  let frenchTax = 0;
  let frenchRate = 0;
  let exemptedEUR = 0;
  let hasFrenchExemption = false;

  switch (input.taxStatus) {
    case "cross_border_fr_1983": {
      hasFrenchExemption = true;
      swissRate = SWISS_RATE_FR_ACCORD;
      swissTax = Math.round((overtime * swissRate) / 100);
      const overtimeEUR = overtime * rate;
      exemptedEUR = Math.min(overtimeEUR, exemptionCapEUR);
      const taxableEUR = Math.max(0, overtimeEUR - exemptedEUR);
      const marg = Math.max(0, input.estimatedFrenchMarginalRate);
      frenchRate = marg;
      frenchTax = Math.round((taxableEUR * marg) / 100 / rate);
      notes.push(
        `Régime frontalier 1983 (${input.workCanton}) : retenue Suisse libératoire ${swissRate}% + impôt français au barème progressif.`,
        `Exonération heures supplémentaires France : jusqu'à ${exemptionCapEUR.toLocaleString("fr-FR")} EUR/an. Taux marginal estimé : ${marg}%.`,
      );
      break;
    }
    case "cross_border_ge": {
      // Imposition à la source GE — barème ordinaire, pas d'exonération spécifique.
      swissRate = 12; // approximation barème IS GE pour heures sup
      swissTax = Math.round((overtime * swissRate) / 100);
      notes.push(
        "Frontalier Genève : imposition à la source genevoise selon barème. Pas d'exonération spécifique aux heures sup dans ce régime.",
      );
      break;
    }
    case "source_taxed":
    case "tou": {
      swissRate = 15; // approximation taux marginal IS suisse
      swissTax = Math.round((overtime * swissRate) / 100);
      notes.push(
        "Imposition à la source / TOU : heures sup taxées au taux marginal suisse, pas d'exonération spécifique.",
      );
      break;
    }
  }

  const totalTax = swissTax + frenchTax;
  const netOvertime = Math.max(0, overtime - totalTax);
  // Gain fiscal grâce à l'exonération = ce qui aurait été dû en France sans exonération.
  const taxSavings = hasFrenchExemption
    ? Math.round((exemptedEUR * input.estimatedFrenchMarginalRate) / 100 / rate)
    : 0;

  notes.push(
    "Les règles fiscales évoluent. Plafond d'exonération à vérifier pour l'année en cours. À valider avec votre conseiller fiscal.",
  );

  return {
    status: input.taxStatus,
    overtimeCHF: overtime,
    exemptionCapEUR,
    exemptedAmountEUR: Math.round(exemptedEUR),
    exemptedAmountCHF: Math.round(exemptedEUR / rate),
    swissTaxOnOvertime: swissTax,
    swissRate,
    frenchTaxOnOvertime: frenchTax,
    frenchRate,
    totalTaxOnOvertime: totalTax,
    netOvertimeCHF: netOvertime,
    taxSavings,
    notes,
    hasFrenchExemption,
  };
}
