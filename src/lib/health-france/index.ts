// CMU, Cotisation maladie pour frontaliers français travaillant en Suisse
// ayant exercé le droit d'option vers la Sécurité sociale française.
// La cotisation est gérée et collectée par le CNTFS via l'URSSAF.
// CMU et CNTFS désignent donc le MÊME régime (CNTFS = organisme collecteur).
//
// Formule : (RFR N-2 − abattement année courante) × 8%
// Abattement = barème officiel français révisé chaque année. Forfaitaire,
// INDIVIDUEL (déclaration individuelle, pas familiale, pas multiplié par
// les parts fiscales).
// LAMal frontalier = forfaitaire selon composition familiale, tarifs
// indicatifs modifiables par l'utilisateur (varient selon caisse, franchise,
// canton de domicile en France).

export const CMU_ABATTEMENT_BY_YEAR: Record<number, number> = {
  2023: 10_284,
  2024: 10_998,
  2025: 11_592,
  2026: 12_015,
};

export const LAMAL_TARIFS_DEFAULT = {
  adulteParMois: 200,
  enfantParMois: 49.4,
};

export const CMU_TAUX_COTISATION = 0.08;

export interface HealthFranceInput {
  /** Salaire suisse brut annuel N-2 (CHF), base de la cotisation CMU */
  swissGrossSalaryCHF: number;
  civilStatus: "single" | "married";
  childrenCount: number;
  chfToEurRate: number;
  taxYear: number;
  /** Tarif LAMal adulte (CHF/mois), modifiable */
  lamalAdultMonthlyCHF?: number;
  /** Tarif LAMal enfant (CHF/mois), modifiable */
  lamalChildMonthlyCHF?: number;
  /** Années restantes avant la retraite, pour chiffrer l'économie cumulée */
  yearsToRetirement?: number;
  /** Régime réellement choisi par le client aujourd'hui (droit d'option
   *  franco-suisse), s'il est connu. undefined = non renseigné : on ne doit
   *  alors jamais prétendre connaître sa situation actuelle. */
  currentRegime?: "CMU" | "LAMAL";
  [key: string]: unknown;
}

export interface BreakdownLine {
  label: string;
  value: string;
}

export interface HealthFranceResult {
  rfrEUR: number;
  abatementEUR: number;
  cmuBaseEUR: number;
  cmuAnnualEUR: number;
  cmuAnnualCHF: number;
  lamalAdultMonthlyCHF: number;
  lamalChildMonthlyCHF: number;
  lamalAdultAnnualCHF: number;
  lamalChildrenAnnualCHF: number;
  lamalAnnualCHF: number;
  recommended: "CMU" | "LAMAL";
  recommendedAnnualCHF: number;
  savingsCHF: number;
  /** Régime réellement choisi par le client aujourd'hui, repris tel quel de
   *  l'input. null = non renseigné : aucune des deux sections n'est alors
   *  "actuelle" ou "optimisation", les deux options sont présentées à
   *  égalité et seule une phrase de recommandation tranche. */
  currentRegime: "CMU" | "LAMAL" | null;
  currentAnnualCHF: number | null;
  alternativeRegime: "CMU" | "LAMAL" | null;
  alternativeAnnualCHF: number | null;
  /** true si le régime actuel du client est déjà le moins cher des deux. */
  isCurrentOptimal: boolean | null;
  /** Phrase de synthèse toujours renseignée, quel que soit le cas (régime
   *  connu optimal, régime connu à changer, ou non renseigné) : jamais de
   *  silence ni de recommandation tue. */
  recommendationText: string;
  /** Économie annuelle d'un passage CMU → LAMal (négatif si LAMal coûte plus cher). */
  cmuToLamalAnnualSavingsCHF: number;
  cmuToLamalMonthlySavingsCHF: number;
  /** Économie cumulée jusqu'à la retraite (cmuToLamalAnnualSavingsCHF × yearsToRetirement). */
  cmuToLamalCumulativeSavingsCHF: number | null;
  yearsToRetirement: number | null;
  cmuBreakdown: BreakdownLine[];
  lamalBreakdown: BreakdownLine[];
  notes: string[];
}

const fmtEUR = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} EUR`;
const fmtCHF = (n: number) => `${Math.round(n).toLocaleString("fr-CH")} CHF`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function getCmuAbatement(year: number): number {
  if (CMU_ABATTEMENT_BY_YEAR[year] != null) return CMU_ABATTEMENT_BY_YEAR[year];
  // Fallback : dernière valeur connue
  const years = Object.keys(CMU_ABATTEMENT_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
  const last = years[years.length - 1];
  return CMU_ABATTEMENT_BY_YEAR[last];
}

export function computeHealthFrance(input: HealthFranceInput): HealthFranceResult {
  const rate = input.chfToEurRate > 0 ? input.chfToEurRate : 1.05;
  const eurFromChf = (chf: number) => chf * rate;
  const chfFromEur = (eur: number) => eur / rate;

  // RFR estimé à partir du salaire suisse brut N-2 (déclaration individuelle)
  const swissEUR = eurFromChf(input.swissGrossSalaryCHF);
  const rfrEUR = Math.round(swissEUR);

  // Abattement forfaitaire annuel selon barème officiel français
  const abatementEUR = getCmuAbatement(input.taxYear);
  const cmuBaseEUR = Math.max(0, rfrEUR - abatementEUR);
  const cmuAnnualEUR = Math.round(cmuBaseEUR * CMU_TAUX_COTISATION);
  const cmuAnnualCHF = Math.round(chfFromEur(cmuAnnualEUR));

  // LAMal, calcul forfaitaire selon composition familiale
  const adultMonthly =
    input.lamalAdultMonthlyCHF && input.lamalAdultMonthlyCHF > 0
      ? input.lamalAdultMonthlyCHF
      : LAMAL_TARIFS_DEFAULT.adulteParMois;
  const childMonthly =
    input.lamalChildMonthlyCHF && input.lamalChildMonthlyCHF > 0
      ? input.lamalChildMonthlyCHF
      : LAMAL_TARIFS_DEFAULT.enfantParMois;
  const childrenCount = Math.max(0, Math.floor(input.childrenCount ?? 0));
  const lamalAdultAnnualCHF = Math.round(adultMonthly * 12);
  const lamalChildrenAnnualCHF = Math.round(childMonthly * 12 * childrenCount);
  const lamalAnnualCHF = lamalAdultAnnualCHF + lamalChildrenAnnualCHF;

  const recommended: "CMU" | "LAMAL" =
    cmuAnnualCHF <= lamalAnnualCHF ? "CMU" : "LAMAL";
  const recommendedAnnualCHF = recommended === "CMU" ? cmuAnnualCHF : lamalAnnualCHF;
  const savingsCHF = Math.abs(lamalAnnualCHF - cmuAnnualCHF);
  const regimeAnnualCHF = { CMU: cmuAnnualCHF, LAMAL: lamalAnnualCHF } as const;
  const regimeLabel = { CMU: "la CMU", LAMAL: "la LAMal" } as const;

  // Régime réellement choisi par le client aujourd'hui, s'il est connu : ne
  // jamais le déduire ou le présumer, uniquement reprendre ce qui a été
  // explicitement renseigné (fiche client → saisie manuelle du calculateur).
  const currentRegime: "CMU" | "LAMAL" | null = input.currentRegime ?? null;
  const alternativeRegime: "CMU" | "LAMAL" | null =
    currentRegime === "CMU" ? "LAMAL" : currentRegime === "LAMAL" ? "CMU" : null;
  const currentAnnualCHF = currentRegime ? regimeAnnualCHF[currentRegime] : null;
  const alternativeAnnualCHF = alternativeRegime ? regimeAnnualCHF[alternativeRegime] : null;
  const isCurrentOptimal =
    currentRegime !== null && currentAnnualCHF !== null && alternativeAnnualCHF !== null
      ? currentAnnualCHF <= alternativeAnnualCHF
      : null;

  let recommendationText: string;
  if (currentRegime === null) {
    recommendationText =
      `Aucun régime actuel n'est renseigné pour ce client dans sa fiche : nous ne pouvons donc pas dire s'il est aujourd'hui à la CMU ou à la LAMal. Sur la seule base des chiffres ci-dessus, ${regimeLabel[recommended]} serait la plus avantageuse ` +
      `(${fmtCHF(recommendedAnnualCHF)}/an contre ${fmtCHF(recommended === "CMU" ? lamalAnnualCHF : cmuAnnualCHF)}/an pour l'autre option).`;
  } else if (isCurrentOptimal) {
    recommendationText =
      savingsCHF > 0
        ? `Le client est déjà affilié à ${regimeLabel[currentRegime]}, l'option la plus avantageuse pour sa situation (${fmtCHF(savingsCHF)}/an de moins que ${regimeLabel[alternativeRegime as "CMU" | "LAMAL"]}).`
        : `Le client est déjà affilié à ${regimeLabel[currentRegime]} ; les deux options coûtent le même montant pour sa situation.`;
  } else {
    recommendationText = `Le client est actuellement affilié à ${regimeLabel[currentRegime]} (${fmtCHF(currentAnnualCHF as number)}/an), mais passer à ${regimeLabel[alternativeRegime as "CMU" | "LAMAL"]} lui ferait économiser ${fmtCHF(savingsCHF)}/an.`;
  }

  // Comparatif "avant/après" (situation actuelle CMU → optimisation LAMal),
  // pour la synthèse globale du PDF : économie signée, positive si LAMal est
  // meilleur marché, négative sinon.
  const cmuToLamalAnnualSavingsCHF = cmuAnnualCHF - lamalAnnualCHF;
  const cmuToLamalMonthlySavingsCHF = Math.round(cmuToLamalAnnualSavingsCHF / 12);
  const yearsToRetirement =
    input.yearsToRetirement && input.yearsToRetirement > 0 ? Math.round(input.yearsToRetirement) : null;
  const cmuToLamalCumulativeSavingsCHF =
    yearsToRetirement !== null ? cmuToLamalAnnualSavingsCHF * yearsToRetirement : null;

  const cmuBreakdown: BreakdownLine[] = [
    { label: "Salaire suisse brut N-2", value: fmtCHF(input.swissGrossSalaryCHF) },
    { label: "Taux de change CHF → EUR", value: String(rate) },
    { label: "RFR (Revenu Fiscal de Référence)", value: `${fmtCHF(input.swissGrossSalaryCHF)} × ${rate} = ${fmtEUR(rfrEUR)}` },
    { label: `Abattement officiel ${input.taxYear}`, value: fmtEUR(abatementEUR) },
    { label: "Assiette de cotisation", value: `${fmtEUR(rfrEUR)} − ${fmtEUR(abatementEUR)} = ${fmtEUR(cmuBaseEUR)}` },
    { label: "Taux CMU", value: fmtPct(CMU_TAUX_COTISATION) },
    { label: "Cotisation CMU annuelle (EUR)", value: `${fmtEUR(cmuBaseEUR)} × ${fmtPct(CMU_TAUX_COTISATION)} = ${fmtEUR(cmuAnnualEUR)}` },
    { label: "Conversion CHF", value: `${fmtEUR(cmuAnnualEUR)} / ${rate} = ${fmtCHF(cmuAnnualCHF)}/an` },
  ];

  const lamalBreakdown: BreakdownLine[] = [
    { label: "Tarif adulte (CHF/mois)", value: `${adultMonthly.toLocaleString("fr-CH")} CHF` },
    { label: "Prime adulte annuelle", value: `${adultMonthly} × 12 = ${fmtCHF(lamalAdultAnnualCHF)}` },
    { label: "Tarif enfant (CHF/mois)", value: `${childMonthly.toLocaleString("fr-CH")} CHF` },
    {
      label: "Prime enfants annuelle",
      value:
        childrenCount > 0
          ? `${childrenCount} × ${childMonthly} × 12 = ${fmtCHF(lamalChildrenAnnualCHF)}`
          : `${fmtCHF(0)} (0 enfant)`,
    },
    { label: "Total LAMal annuel", value: fmtCHF(lamalAnnualCHF) },
    { label: "Note", value: "Tarif indicatif, varie selon caisse, franchise, canton de domicile" },
  ];

  const notes = [
    "CMU et CNTFS désignent le même régime : la cotisation est calculée par l'URSSAF (CNTFS) pour les frontaliers ayant exercé le droit d'option vers la Sécurité sociale française.",
    `L'abattement CMU est forfaitaire et révisé chaque année par l'administration française (barème ${input.taxYear} : ${fmtEUR(abatementEUR)}). La cotisation est calculée sur les revenus N-2 (pour 2026 = revenus 2024).`,
    "La déclaration CMU est INDIVIDUELLE, la situation civile et les enfants n'impactent ni l'abattement ni l'assiette CMU.",
    "La prime LAMal frontalier est forfaitaire et varie selon la caisse maladie, la franchise et le canton de domicile en France. Les tarifs affichés sont indicatifs.",
    "Le droit d'option CMU vs LAMal doit être exercé dans les 3 mois suivant le début de l'activité frontalière. Ce choix est irrévocable.",
  ];

  return {
    rfrEUR,
    abatementEUR,
    cmuBaseEUR,
    cmuAnnualEUR,
    cmuAnnualCHF,
    lamalAdultMonthlyCHF: adultMonthly,
    lamalChildMonthlyCHF: childMonthly,
    lamalAdultAnnualCHF,
    lamalChildrenAnnualCHF,
    lamalAnnualCHF,
    recommended,
    recommendedAnnualCHF,
    savingsCHF,
    currentRegime,
    currentAnnualCHF,
    alternativeRegime,
    alternativeAnnualCHF,
    isCurrentOptimal,
    recommendationText,
    cmuToLamalAnnualSavingsCHF,
    cmuToLamalMonthlySavingsCHF,
    cmuToLamalCumulativeSavingsCHF,
    yearsToRetirement,
    cmuBreakdown,
    lamalBreakdown,
    notes,
  };
}
