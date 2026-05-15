// CMU / CNTFS — assurance santé pour frontaliers français travaillant en Suisse.
// Paramètres 2026 (à valider avec un conseiller fiscal pour cas particuliers).
//
// Sources publiques (CMU / Caisse Primaire / CNTFS) :
// - Cotisation CMU : 8% de (RFR - seuil), seuil 50% du PASS (~ 23'200 EUR en 2026).
// - CNTFS : adhésion alternative, cotisation forfaitaire approximative.
// Ces valeurs sont des approximations et doivent être confirmées chaque année.

export interface HealthFranceInput {
  swissGrossSalaryCHF: number;
  /** Salaire annuel du conjoint en France (EUR). 0 si non applicable. */
  spouseFrenchSalaryEUR: number;
  /** Conjoint a sa propre couverture santé en France. */
  spouseHasOwnCoverage: boolean;
  civilStatus: "single" | "married";
  childrenCount: number;
  /** Taux de change CHF -> EUR (1 CHF = X EUR). */
  chfToEurRate: number;
  /** Comparaison optionnelle avec assurance privée suisse (CHF/an). */
  privateInsuranceCHF?: number;
  taxYear: number;
}

export interface HealthFranceResult {
  rfrEUR: number;
  cmuThresholdEUR: number;
  cmuAnnualEUR: number;
  cmuAnnualCHF: number;
  cntfsAnnualEUR: number;
  cntfsAnnualCHF: number;
  privateAnnualCHF: number | null;
  recommended: "CMU" | "CNTFS" | "PRIVATE";
  recommendedAnnualCHF: number;
  savingsVsWorstCHF: number;
  notes: string[];
}

// Paramètres 2026 (approximatifs).
export const HEALTH_FRANCE_PARAMS_2026 = {
  cmuRate: 0.08,
  cmuThresholdSingleEUR: 13_426,
  cmuThresholdCoupleEUR: 26_852,
  childExtraThresholdEUR: 4_026,
  // CNTFS — adhésion forfaitaire (ordre de grandeur, à valider).
  cntfsBaseSingleEUR: 6_900,
  cntfsBaseCoupleEUR: 9_800,
  cntfsPerChildEUR: 1_200,
};

export function computeHealthFrance(input: HealthFranceInput): HealthFranceResult {
  const p = HEALTH_FRANCE_PARAMS_2026;
  const rate = input.chfToEurRate > 0 ? input.chfToEurRate : 1.05;
  const eurFromChf = (chf: number) => chf * rate;
  const chfFromEur = (eur: number) => eur / rate;

  const swissEUR = eurFromChf(input.swissGrossSalaryCHF);
  const spouseEUR =
    input.civilStatus === "married" && !input.spouseHasOwnCoverage
      ? Math.max(0, input.spouseFrenchSalaryEUR)
      : 0;
  const rfrEUR = Math.round(swissEUR + spouseEUR);

  const baseThreshold =
    input.civilStatus === "married"
      ? p.cmuThresholdCoupleEUR
      : p.cmuThresholdSingleEUR;
  const cmuThresholdEUR =
    baseThreshold + Math.max(0, input.childrenCount) * p.childExtraThresholdEUR;

  const cmuAnnualEUR = Math.max(0, Math.round((rfrEUR - cmuThresholdEUR) * p.cmuRate));
  const cmuAnnualCHF = Math.round(chfFromEur(cmuAnnualEUR));

  const cntfsBase =
    input.civilStatus === "married" ? p.cntfsBaseCoupleEUR : p.cntfsBaseSingleEUR;
  const cntfsAnnualEUR = Math.round(
    cntfsBase + Math.max(0, input.childrenCount) * p.cntfsPerChildEUR,
  );
  const cntfsAnnualCHF = Math.round(chfFromEur(cntfsAnnualEUR));

  const privateAnnualCHF =
    input.privateInsuranceCHF && input.privateInsuranceCHF > 0
      ? Math.round(input.privateInsuranceCHF)
      : null;

  const candidates: Array<{ key: HealthFranceResult["recommended"]; chf: number }> = [
    { key: "CMU", chf: cmuAnnualCHF },
    { key: "CNTFS", chf: cntfsAnnualCHF },
  ];
  if (privateAnnualCHF !== null) candidates.push({ key: "PRIVATE", chf: privateAnnualCHF });
  candidates.sort((a, b) => a.chf - b.chf);
  const recommended = candidates[0];
  const worst = candidates[candidates.length - 1];
  const savingsVsWorstCHF = Math.max(0, worst.chf - recommended.chf);

  const notes = [
    `Revenu fiscal de référence estimé : ${rfrEUR.toLocaleString("fr-FR")} EUR (taux ${rate} CHF/EUR).`,
    `Seuil d'exonération CMU appliqué : ${cmuThresholdEUR.toLocaleString("fr-FR")} EUR.`,
    "Les barèmes CMU et CNTFS évoluent chaque année. Calculs basés sur les paramètres connus pour 2026. À valider avec votre conseiller fiscal pour les cas particuliers (changement de statut, départ en cours d'année, etc.).",
  ];

  return {
    rfrEUR,
    cmuThresholdEUR,
    cmuAnnualEUR,
    cmuAnnualCHF,
    cntfsAnnualEUR,
    cntfsAnnualCHF,
    privateAnnualCHF,
    recommended: recommended.key,
    recommendedAnnualCHF: recommended.chf,
    savingsVsWorstCHF,
    notes,
  };
}
