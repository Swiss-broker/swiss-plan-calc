// CMU — Cotisation maladie pour frontaliers français travaillant en Suisse
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
  /** Salaire suisse brut annuel N-2 (CHF) — base de la cotisation CMU */
  swissGrossSalaryCHF: number;
  civilStatus: "single" | "married";
  childrenCount: number;
  chfToEurRate: number;
  taxYear: number;
  /** Tarif LAMal adulte (CHF/mois), modifiable */
  lamalAdultMonthlyCHF?: number;
  /** Tarif LAMal enfant (CHF/mois), modifiable */
  lamalChildMonthlyCHF?: number;
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

  // LAMal — calcul forfaitaire selon composition familiale
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
    { label: "Note", value: "Tarif indicatif — varie selon caisse, franchise, canton de domicile" },
  ];

  const notes = [
    "CMU et CNTFS désignent le même régime : la cotisation est calculée par l'URSSAF (CNTFS) pour les frontaliers ayant exercé le droit d'option vers la Sécurité sociale française.",
    `L'abattement CMU est forfaitaire et révisé chaque année par l'administration française (barème ${input.taxYear} : ${fmtEUR(abatementEUR)}). La cotisation est calculée sur les revenus N-2 (pour 2026 = revenus 2024).`,
    "La déclaration CMU est INDIVIDUELLE — la situation civile et les enfants n'impactent ni l'abattement ni l'assiette CMU.",
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
    cmuBreakdown,
    lamalBreakdown,
    notes,
  };
}
