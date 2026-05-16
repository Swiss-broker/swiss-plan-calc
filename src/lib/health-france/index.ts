// CMU / CNTFS — assurance santé pour frontaliers français travaillant en Suisse.
// Paramètres 2026.
//
// Sources :
// - CMU frontalier (Cotisation Subsidiaire Maladie - URSSAF) :
//   8% sur le RFR au-dessus d'un abattement par part fiscale.
//   Réf : https://www.urssaf.fr/accueil/employeur/cotisations/cotisation-subsidiaire-maladie.html
//   et https://www.cleiss.fr/docs/regimes/regime_france_salaries.html
//   Abattement 2026 estimé ≈ 27'000 EUR / part fiscale.
// - CNTFS (Caisse Nationale Travailleurs Frontaliers Suisse) :
//   adhésion volontaire — cotisation ≈ 7% du revenu brut suisse SANS abattement,
//   plus surcoût enfants. Barèmes indicatifs à valider chaque année.
//   Réf : https://www.cntfs.fr

export interface HealthFranceInput {
  swissGrossSalaryCHF: number;
  spouseFrenchSalaryEUR: number;
  spouseHasOwnCoverage: boolean;
  civilStatus: "single" | "married";
  childrenCount: number;
  chfToEurRate: number;
  privateInsuranceCHF?: number;
  taxYear: number;
  [key: string]: unknown;
}

export interface BreakdownLine {
  label: string;
  value: string;
}

export interface HealthFranceResult {
  rfrEUR: number;
  partsFiscales: number;
  cmuThresholdEUR: number;
  cmuBaseEUR: number;
  cmuAnnualEUR: number;
  cmuAnnualCHF: number;
  cntfsRatePct: number;
  cntfsAnnualEUR: number;
  cntfsAnnualCHF: number;
  privateAnnualCHF: number | null;
  recommended: "CMU" | "CNTFS" | "PRIVATE";
  recommendedAnnualCHF: number;
  savingsVsWorstCHF: number;
  savingsVsPrivateCHF: number | null;
  cmuBreakdown: BreakdownLine[];
  cntfsBreakdown: BreakdownLine[];
  privateBreakdown: BreakdownLine[];
  notes: string[];
}

// Paramètres 2026.
export const HEALTH_FRANCE_PARAMS_2026 = {
  // CMU frontalier (Cotisation Subsidiaire Maladie)
  cmuRate: 0.08,
  cmuAbatementPerPartEUR: 27_000, // abattement par part fiscale
  // CNTFS — cotisation indicative (% du revenu brut suisse, sans abattement)
  cntfsRate: 0.07,
  cntfsPerChildEUR: 900,
  // Prime LAMal moyenne annuelle célibataire Suisse romande
  lamalDefaultSingleCHF: 3_600,
  lamalDefaultCoupleCHF: 7_200,
  lamalPerChildCHF: 1_200,
};

function computeParts(civilStatus: "single" | "married", children: number): number {
  const base = civilStatus === "married" ? 2 : 1;
  const kids = Math.max(0, children);
  // Quotient familial français : +0.5 par enfant pour les 2 premiers, +1 ensuite
  const childParts = kids <= 2 ? kids * 0.5 : 1 + (kids - 2);
  return base + childParts;
}

const fmtEUR = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} EUR`;
const fmtCHF = (n: number) => `${Math.round(n).toLocaleString("fr-CH")} CHF`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

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

  // CMU — Cotisation Subsidiaire Maladie
  const partsFiscales = computeParts(input.civilStatus, input.childrenCount);
  const cmuThresholdEUR = Math.round(p.cmuAbatementPerPartEUR * partsFiscales);
  const cmuBaseEUR = Math.max(0, rfrEUR - cmuThresholdEUR);
  const cmuAnnualEUR = Math.round(cmuBaseEUR * p.cmuRate);
  const cmuAnnualCHF = Math.round(chfFromEur(cmuAnnualEUR));

  // CNTFS — % du revenu brut suisse SANS abattement + surcoût enfants
  const cntfsBaseEUR = Math.round(swissEUR);
  const cntfsAnnualEUR = Math.round(
    cntfsBaseEUR * p.cntfsRate + Math.max(0, input.childrenCount) * p.cntfsPerChildEUR,
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
  const savingsVsPrivateCHF =
    privateAnnualCHF !== null ? privateAnnualCHF - recommended.chf : null;

  // Encarts pédagogiques "Détail du calcul"
  const cmuBreakdown: BreakdownLine[] = [
    { label: "Salaire suisse brut", value: `${fmtCHF(input.swissGrossSalaryCHF)} × ${rate} = ${fmtEUR(swissEUR)}` },
    ...(spouseEUR > 0 ? [{ label: "Revenu conjoint ajouté", value: fmtEUR(spouseEUR) }] : []),
    { label: "RFR estimé", value: fmtEUR(rfrEUR) },
    { label: "Parts fiscales", value: partsFiscales.toString() },
    { label: "Abattement (27'000 €/part)", value: fmtEUR(cmuThresholdEUR) },
    { label: "Assiette de cotisation", value: `${fmtEUR(rfrEUR)} − ${fmtEUR(cmuThresholdEUR)} = ${fmtEUR(cmuBaseEUR)}` },
    { label: "Taux CMU", value: fmtPct(p.cmuRate) },
    { label: "Cotisation CMU annuelle", value: `${fmtEUR(cmuBaseEUR)} × ${fmtPct(p.cmuRate)} = ${fmtEUR(cmuAnnualEUR)} (≈ ${fmtCHF(cmuAnnualCHF)})` },
  ];

  const cntfsBreakdown: BreakdownLine[] = [
    { label: "Assiette (salaire suisse brut)", value: `${fmtEUR(swissEUR)} (pas d'abattement)` },
    { label: "Taux CNTFS indicatif", value: fmtPct(p.cntfsRate) },
    { label: "Cotisation de base", value: `${fmtEUR(swissEUR)} × ${fmtPct(p.cntfsRate)} = ${fmtEUR(swissEUR * p.cntfsRate)}` },
    ...(input.childrenCount > 0
      ? [{ label: `Surcoût enfants (${input.childrenCount} × 900 €)`, value: fmtEUR(input.childrenCount * p.cntfsPerChildEUR) }]
      : []),
    { label: "Cotisation CNTFS annuelle", value: `${fmtEUR(cntfsAnnualEUR)} (≈ ${fmtCHF(cntfsAnnualCHF)})` },
  ];

  const privateBreakdown: BreakdownLine[] =
    privateAnnualCHF !== null
      ? [
          { label: "Prime annuelle LAMal", value: fmtCHF(privateAnnualCHF) },
          { label: "Couverture", value: "Suisse — LAMal de base obligatoire si droit d'option exercé" },
          { label: "À ajuster selon", value: "canton de résidence, caisse, franchise choisie" },
        ]
      : [];

  const notes = [
    `Revenu fiscal de référence estimé : ${rfrEUR.toLocaleString("fr-FR")} EUR (taux ${rate} CHF/EUR).`,
    `Abattement CMU : ${p.cmuAbatementPerPartEUR.toLocaleString("fr-FR")} EUR × ${partsFiscales} part(s) = ${cmuThresholdEUR.toLocaleString("fr-FR")} EUR.`,
    "CMU = cotisation subsidiaire (8% au-delà de l'abattement). CNTFS = adhésion volontaire frontalier (~7% du brut suisse, sans abattement).",
    "Barèmes CNTFS indicatifs — à confirmer avec un devis CNTFS pour le cas réel.",
  ];

  return {
    rfrEUR,
    partsFiscales,
    cmuThresholdEUR,
    cmuBaseEUR,
    cmuAnnualEUR,
    cmuAnnualCHF,
    cntfsRatePct: p.cntfsRate,
    cntfsAnnualEUR,
    cntfsAnnualCHF,
    privateAnnualCHF,
    recommended: recommended.key,
    recommendedAnnualCHF: recommended.chf,
    savingsVsWorstCHF,
    savingsVsPrivateCHF,
    cmuBreakdown,
    cntfsBreakdown,
    privateBreakdown,
    notes,
  };
}
