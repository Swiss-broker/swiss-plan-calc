// CMU — Cotisation maladie pour frontaliers français travaillant en Suisse
// ayant exercé le droit d'option vers la Sécurité sociale française.
// La cotisation est gérée et collectée par le CNTFS via l'URSSAF.
// CMU et CNTFS désignent donc le MÊME régime (CNTFS = organisme collecteur).
//
// Paramètres 2026.
// Formule : (RFR personnel − abattement) × 8%
// Abattement = 25% du PASS 2026 (forfaitaire, individuel, NON multiplié par
// les parts fiscales — la déclaration est individuelle pour chaque frontalier).
// PASS 2026 = 47'100 EUR (Plafond Annuel de la Sécurité Sociale).
// Sources : urssaf.fr, ameli.fr (section travailleur frontalier suisse), frontalier.org

export interface HealthFranceInput {
  swissGrossSalaryCHF: number;
  civilStatus: "single" | "married";
  childrenCount: number; // info contextuelle uniquement, n'impacte pas la cotisation CMU
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
  passEUR: number;
  abatementEUR: number;
  cmuBaseEUR: number;
  cmuAnnualEUR: number;
  cmuAnnualCHF: number;
  lamalAnnualCHF: number;
  recommended: "CMU" | "LAMAL";
  recommendedAnnualCHF: number;
  savingsCHF: number;
  cmuBreakdown: BreakdownLine[];
  lamalBreakdown: BreakdownLine[];
  notes: string[];
}

export const HEALTH_FRANCE_PARAMS_2026 = {
  // Plafond Annuel de la Sécurité Sociale française 2026
  passEUR: 47_100,
  // Cotisation CMU
  cmuRate: 0.08,
  cmuAbatementRate: 0.25, // 25% du PASS, forfaitaire et individuel
  // Prime LAMal moyenne annuelle célibataire Suisse romande (indicatif)
  lamalDefaultSingleCHF: 3_600,
};

const fmtEUR = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} EUR`;
const fmtCHF = (n: number) => `${Math.round(n).toLocaleString("fr-CH")} CHF`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function computeHealthFrance(input: HealthFranceInput): HealthFranceResult {
  const p = HEALTH_FRANCE_PARAMS_2026;
  const rate = input.chfToEurRate > 0 ? input.chfToEurRate : 1.05;
  const eurFromChf = (chf: number) => chf * rate;
  const chfFromEur = (eur: number) => eur / rate;

  // RFR personnel estimé à partir du salaire suisse brut (revenus N-2 réels en pratique)
  const swissEUR = eurFromChf(input.swissGrossSalaryCHF);
  const rfrEUR = Math.round(swissEUR);

  // Abattement forfaitaire = 25% du PASS, INDIVIDUEL (pas de parts fiscales)
  const passEUR = p.passEUR;
  const abatementEUR = Math.round(passEUR * p.cmuAbatementRate);
  const cmuBaseEUR = Math.max(0, rfrEUR - abatementEUR);
  const cmuAnnualEUR = Math.round(cmuBaseEUR * p.cmuRate);
  const cmuAnnualCHF = Math.round(chfFromEur(cmuAnnualEUR));

  const lamalAnnualCHF =
    input.lamalAnnualCHF && input.lamalAnnualCHF > 0
      ? Math.round(input.lamalAnnualCHF)
      : p.lamalDefaultSingleCHF;

  const recommended: "CMU" | "LAMAL" =
    cmuAnnualCHF <= lamalAnnualCHF ? "CMU" : "LAMAL";
  const recommendedAnnualCHF = recommended === "CMU" ? cmuAnnualCHF : lamalAnnualCHF;
  const savingsCHF = Math.abs(lamalAnnualCHF - cmuAnnualCHF);

  const cmuBreakdown: BreakdownLine[] = [
    { label: "Étape 1 — Salaire suisse brut", value: `${fmtCHF(input.swissGrossSalaryCHF)} × ${rate} = ${fmtEUR(swissEUR)}` },
    { label: "RFR personnel estimé", value: fmtEUR(rfrEUR) },
    { label: "Étape 2 — PASS 2026", value: fmtEUR(passEUR) },
    { label: "Abattement (25% du PASS)", value: `${fmtEUR(passEUR)} × 25% = ${fmtEUR(abatementEUR)}` },
    { label: "Étape 3 — Assiette de cotisation", value: `${fmtEUR(rfrEUR)} − ${fmtEUR(abatementEUR)} = ${fmtEUR(cmuBaseEUR)}` },
    { label: "Étape 4 — Taux CMU", value: fmtPct(p.cmuRate) },
    { label: "Cotisation CMU annuelle", value: `${fmtEUR(cmuBaseEUR)} × ${fmtPct(p.cmuRate)} = ${fmtEUR(cmuAnnualEUR)} (≈ ${fmtCHF(cmuAnnualCHF)})` },
  ];

  const lamalBreakdown: BreakdownLine[] = [
    { label: "Prime annuelle LAMal", value: fmtCHF(lamalAnnualCHF) },
    { label: "Couverture", value: "Assurance maladie suisse de base obligatoire" },
    { label: "À ajuster selon", value: "canton de résidence, caisse, franchise" },
    { label: "Complémentaires", value: "Possibles en sus (LCA, dentaire, etc.)" },
  ];

  const notes = [
    "La cotisation CMU frontalier est INDIVIDUELLE : chaque frontalier déclare ses propres revenus, le foyer fiscal n'intervient pas.",
    "L'abattement (25% du PASS = 11'775 € en 2026) est forfaitaire — il n'est PAS multiplié par les parts fiscales.",
    "La cotisation est basée sur les revenus N-2 déclarés à l'URSSAF. Estimation ici à partir du salaire suisse actuel.",
    "Le droit d'option CMU vs LAMal doit être exercé dans les 3 mois suivant la prise de fonction frontalier — choix définitif tant que la situation ne change pas.",
  ];

  return {
    rfrEUR,
    passEUR,
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
