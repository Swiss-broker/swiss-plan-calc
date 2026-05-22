// Heures supplémentaires, méthode officielle française 2026 pour frontaliers.
//
// Méthode :
//   1. heures_annuelles      = heures_hebdo × 52
//   2. heures_exonérables    = min(max(0, heures_annuelles − 1840), 368)
//   3. salaire_exo_théorique = salaire_net_annuel_EUR × (heures_exo / heures_annuelles)
//   4. salaire_exo_retenu    = min(salaire_exo_théorique, 7'500 €)
//   5. économie              = salaire_exo_retenu × taux_marginal_IR_FR
//
// Hypothèse : l'exonération est française. Côté Suisse l'impôt est dû normalement,
// donc aucune économie suisse n'est ajoutée ici.

export type OvertimeTaxStatus =
  | "cross_border_fr_1983"
  | "cross_border_ge"
  | "source_taxed"
  | "tou";

export type SalaryCurrency = "EUR" | "CHF";

export interface OvertimeInput {
  taxStatus: OvertimeTaxStatus;
  workCanton: string;
  /** Heures hebdomadaires de travail (défaut 42). */
  weeklyHours: number;
  /** Salaire net annuel imposable saisi par l'utilisateur. */
  annualNetSalary: number;
  /** Devise de saisie du salaire. */
  salaryCurrency: SalaryCurrency;
  /** Taux CHF → EUR (combien d'EUR pour 1 CHF). Défaut 1.05. */
  chfToEurRate: number;
  /** Taux marginal IR France estimé (%). */
  estimatedFrenchMarginalRate: number;
  civilStatus: "single" | "married";
  childrenCount: number;
  spouseEmployed?: boolean;
  spouseAnnualSalaryCHF?: number;
  [key: string]: unknown;
}

export interface OvertimeResult {
  status: OvertimeTaxStatus;
  hasFrenchExemption: boolean;
  // Heures
  weeklyHours: number;
  annualHours: number;
  hoursThreshold: number; // 1840
  hoursCap: number; // 368
  exemptHoursTheoretical: number;
  exemptHoursRetained: number;
  // Salaire
  annualNetSalaryEUR: number;
  annualNetSalaryCHF: number;
  exemptSalaryTheoreticalEUR: number;
  exemptSalaryCapEUR: number; // 7500
  exemptSalaryRetainedEUR: number;
  exemptSalaryRetainedCHF: number;
  // Économie
  marginalRatePct: number;
  taxSavingsEUR: number;
  taxSavingsCHF: number;
  notes: string[];
  // Compat fields (anciens consommateurs : PDF / historique / extract-gain)
  overtimeCHF: number; // = exemptSalaryRetainedCHF (montant pertinent)
  netOvertimeCHF: number; // = exemptSalaryRetainedCHF
  exemptionCapEUR: number; // = exemptSalaryCapEUR
  exemptedAmountEUR: number;
  exemptedAmountCHF: number;
  swissTaxOnOvertime: number; // 0 (exonération côté FR uniquement)
  swissRate: number;
  frenchTaxOnOvertime: number; // évité (= économie)
  frenchRate: number;
  totalTaxOnOvertime: number; // 0
  taxSavings: number; // CHF
}

export const OVERTIME_PARAMS_2026 = {
  hoursThreshold: 1_840,
  hoursCapPerYear: 368,
  salaryCapEUR: 7_500,
  defaultWeeklyHours: 42,
  defaultChfToEurRate: 1.05,
} as const;

// Maintenu pour compat avec d'anciens imports
export const FRENCH_OVERTIME_EXEMPTION_CAP_EUR_2026 = OVERTIME_PARAMS_2026.salaryCapEUR;

export function computeOvertime(input: OvertimeInput): OvertimeResult {
  const P = OVERTIME_PARAMS_2026;
  const rate = input.chfToEurRate > 0 ? input.chfToEurRate : P.defaultChfToEurRate;
  const weeklyHours = Math.max(0, input.weeklyHours || 0);
  const annualHours = Math.round(weeklyHours * 52);

  const exemptHoursTheoretical = Math.max(0, annualHours - P.hoursThreshold);
  const exemptHoursRetained = Math.min(exemptHoursTheoretical, P.hoursCapPerYear);

  const salaryRaw = Math.max(0, input.annualNetSalary || 0);
  const annualNetSalaryEUR =
    input.salaryCurrency === "EUR" ? salaryRaw : salaryRaw * rate;
  const annualNetSalaryCHF =
    input.salaryCurrency === "CHF" ? salaryRaw : rate > 0 ? salaryRaw / rate : 0;

  const exemptSalaryTheoreticalEUR =
    annualHours > 0 ? annualNetSalaryEUR * (exemptHoursRetained / annualHours) : 0;
  const exemptSalaryRetainedEUR = Math.min(exemptSalaryTheoreticalEUR, P.salaryCapEUR);
  const exemptSalaryRetainedCHF = rate > 0 ? exemptSalaryRetainedEUR / rate : 0;

  const hasFrenchExemption = input.taxStatus === "cross_border_fr_1983";
  const marg = Math.max(0, input.estimatedFrenchMarginalRate || 0);
  const taxSavingsEUR = hasFrenchExemption ? (exemptSalaryRetainedEUR * marg) / 100 : 0;
  const taxSavingsCHF = rate > 0 ? taxSavingsEUR / rate : 0;

  const notes: string[] = [];
  if (hasFrenchExemption) {
    notes.push(
      "Régime frontalier 1983 : exonération d'impôt sur le revenu en France pour la part heures supplémentaires, dans la limite de 7'500 € net/an et 368 h/an.",
    );
  } else if (input.taxStatus === "cross_border_ge") {
    notes.push(
      "Frontalier Genève : imposition à la source genevoise selon le barème, pas d'exonération spécifique aux heures supplémentaires applicable côté France.",
    );
  } else {
    notes.push(
      "Statut hors régime frontalier 1983 : l'exonération française heures sup ne s'applique pas. Le calcul est affiché à titre indicatif.",
    );
  }
  notes.push(
    "Documents nécessaires : certificat de salaire suisse annuel, relevé annuel d'heures de travail, attestation employeur (heures hebdomadaires), formulaire fiscal français 2041-AE.",
  );
  notes.push(
    "Plafonds 2026 : 368 h/an et 7'500 € de revenu net exonéré. Méthode officielle française pour les frontaliers.",
  );

  return {
    status: input.taxStatus,
    hasFrenchExemption,
    weeklyHours,
    annualHours,
    hoursThreshold: P.hoursThreshold,
    hoursCap: P.hoursCapPerYear,
    exemptHoursTheoretical,
    exemptHoursRetained,
    annualNetSalaryEUR: Math.round(annualNetSalaryEUR),
    annualNetSalaryCHF: Math.round(annualNetSalaryCHF),
    exemptSalaryTheoreticalEUR: Math.round(exemptSalaryTheoreticalEUR),
    exemptSalaryCapEUR: P.salaryCapEUR,
    exemptSalaryRetainedEUR: Math.round(exemptSalaryRetainedEUR),
    exemptSalaryRetainedCHF: Math.round(exemptSalaryRetainedCHF),
    marginalRatePct: marg,
    taxSavingsEUR: Math.round(taxSavingsEUR),
    taxSavingsCHF: Math.round(taxSavingsCHF),
    notes,
    // Compat
    overtimeCHF: Math.round(exemptSalaryRetainedCHF),
    netOvertimeCHF: Math.round(exemptSalaryRetainedCHF),
    exemptionCapEUR: P.salaryCapEUR,
    exemptedAmountEUR: Math.round(exemptSalaryRetainedEUR),
    exemptedAmountCHF: Math.round(exemptSalaryRetainedCHF),
    swissTaxOnOvertime: 0,
    swissRate: 0,
    frenchTaxOnOvertime: Math.round(taxSavingsCHF),
    frenchRate: marg,
    totalTaxOnOvertime: 0,
    taxSavings: Math.round(taxSavingsCHF),
  };
}
