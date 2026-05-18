// CMU/CNTFS — assurance santé pour frontaliers français travaillant en Suisse.
// Paramètres 2026.
//
// NOTE IMPORTANTE :
// "CMU" et "CNTFS" désignent le MÊME régime (Cotisation Subsidiaire Maladie
// gérée par l'URSSAF pour les frontaliers ayant exercé le droit d'option vers
// la Sécurité sociale française). On parle donc d'UNE SEULE cotisation, comparée
// à l'option alternative : rester sur la LAMal (assurance maladie suisse).
//
// Source : URSSAF — https://www.urssaf.fr — 8% du RFR au-dessus de l'abattement
// par part fiscale (≈ 27'000 EUR / part en 2026).

export interface HealthFranceInput {
  swissGrossSalaryCHF: number;
  spouseFrenchSalaryEUR: number;
  spouseHasOwnCoverage: boolean;
  civilStatus: "single" | "married";
  childrenCount: number;
  chfToEurRate: number;
  lamalAnnualCHF?: number;
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
  abatementEUR: number;
  cmuBaseEUR: number;
  cmuAnnualEUR: number;
  cmuAnnualCHF: number;
  lamalAnnualCHF: number;
  recommended: "CMU_CNTFS" | "LAMAL";
  recommendedAnnualCHF: number;
  savingsCHF: number; // économie annuelle de l'option recommandée vs l'autre
  cmuBreakdown: BreakdownLine[];
  lamalBreakdown: BreakdownLine[];
  notes: string[];
}

export const HEALTH_FRANCE_PARAMS_2026 = {
  cmuRate: 0.08,
  cmuAbatementPerPartEUR: 27_000,
  lamalDefaultSingleCHF: 3_600,
  lamalDefaultCoupleCHF: 7_200,
  lamalPerChildCHF: 1_200,
};

function computeParts(civilStatus: "single" | "married", children: number): number {
  const base = civilStatus === "married" ? 2 : 1;
  const kids = Math.max(0, children);
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

  // CMU/CNTFS — cotisation subsidiaire URSSAF
  const partsFiscales = computeParts(input.civilStatus, input.childrenCount);
  const abatementEUR = Math.round(p.cmuAbatementPerPartEUR * partsFiscales);
  const cmuBaseEUR = Math.max(0, rfrEUR - abatementEUR);
  const cmuAnnualEUR = Math.round(cmuBaseEUR * p.cmuRate);
  const cmuAnnualCHF = Math.round(chfFromEur(cmuAnnualEUR));

  // LAMal — prime estimée selon profil si non renseignée
  const defaultLamal =
    (input.civilStatus === "married" ? p.lamalDefaultCoupleCHF : p.lamalDefaultSingleCHF) +
    Math.max(0, input.childrenCount) * p.lamalPerChildCHF;
  const lamalAnnualCHF =
    input.lamalAnnualCHF && input.lamalAnnualCHF > 0
      ? Math.round(input.lamalAnnualCHF)
      : defaultLamal;

  const recommended: "CMU_CNTFS" | "LAMAL" =
    cmuAnnualCHF <= lamalAnnualCHF ? "CMU_CNTFS" : "LAMAL";
  const recommendedAnnualCHF = recommended === "CMU_CNTFS" ? cmuAnnualCHF : lamalAnnualCHF;
  const savingsCHF = Math.abs(lamalAnnualCHF - cmuAnnualCHF);

  const cmuBreakdown: BreakdownLine[] = [
    { label: "Salaire suisse brut", value: `${fmtCHF(input.swissGrossSalaryCHF)} × ${rate} = ${fmtEUR(swissEUR)}` },
    ...(spouseEUR > 0 ? [{ label: "Revenu conjoint ajouté", value: fmtEUR(spouseEUR) }] : []),
    { label: "RFR estimé", value: fmtEUR(rfrEUR) },
    { label: "Parts fiscales", value: partsFiscales.toString() },
    { label: "Abattement (27'000 €/part)", value: fmtEUR(abatementEUR) },
    { label: "Assiette de cotisation", value: `${fmtEUR(rfrEUR)} − ${fmtEUR(abatementEUR)} = ${fmtEUR(cmuBaseEUR)}` },
    { label: "Taux CMU/CNTFS", value: fmtPct(p.cmuRate) },
    { label: "Cotisation annuelle", value: `${fmtEUR(cmuBaseEUR)} × ${fmtPct(p.cmuRate)} = ${fmtEUR(cmuAnnualEUR)} (≈ ${fmtCHF(cmuAnnualCHF)})` },
  ];

  const lamalBreakdown: BreakdownLine[] = [
    { label: "Prime annuelle LAMal", value: fmtCHF(lamalAnnualCHF) },
    { label: "Couverture", value: "Assurance maladie suisse de base obligatoire (sans droit d'option)" },
    { label: "À ajuster selon", value: "canton de résidence, caisse, franchise, profil familial" },
  ];

  const notes = [
    "CMU et CNTFS désignent le même régime : la Cotisation Subsidiaire Maladie gérée par l'URSSAF pour les frontaliers ayant exercé le droit d'option vers la Sécurité sociale française.",
    `RFR estimé : ${rfrEUR.toLocaleString("fr-FR")} EUR (taux ${rate} CHF/EUR).`,
    `Abattement : ${p.cmuAbatementPerPartEUR.toLocaleString("fr-FR")} EUR × ${partsFiscales} part(s) = ${abatementEUR.toLocaleString("fr-FR")} EUR.`,
    "Le choix CMU/CNTFS vs LAMal est définitif au moment de la prise de fonction frontalier (droit d'option unique).",
  ];

  return {
    rfrEUR,
    partsFiscales,
    abatementEUR,
    cmuBaseEUR,
    cmuAnnualEUR,
    cmuAnnualCHF,
    lamalAnnualCHF,
    recommended,
    recommendedAnnualCHF,
    savingsCHF,
    cmuBreakdown,
    lamalBreakdown,
    notes,
  };
}
