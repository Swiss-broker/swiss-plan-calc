// Paramètres AVS/AI 2026, source de vérité centralisée.
// Source : OFAS (Office fédéral des assurances sociales), bsv.admin.ch
// Indexation au 1er janvier 2025 (+2.9%) maintenue pour 2026.
// Vérifié : décembre 2025.

export const AVS_2026 = {
  /** Rente individuelle minimale (CHF/mois) */
  minMonthlyPension: 1_260,
  /** Rente individuelle maximale (CHF/mois) */
  maxMonthlyPension: 2_520,
  /** Plafond couple (150% rente individuelle max), CHF/mois */
  maxCoupleMonthlyPension: 3_780,

  /** Rente annuelle minimale (CHF/an) */
  minAnnualPension: 15_120,
  /** Rente annuelle maximale (CHF/an) */
  maxAnnualPension: 30_240,
  /** Plafond couple annuel (CHF/an) */
  maxCoupleAnnualPension: 45_360,

  /** Revenu annuel moyen plancher (en deçà → rente min) */
  minDeterminingIncome: 15_120,
  /** Revenu annuel moyen plafond (au-delà → rente max) */
  maxDeterminingIncome: 88_200,
  /** Revenu charnière formule de rente (point de cassure officiel ~ 4× min) */
  hingeIncome: 60_480,

  /** Durée de cotisation complète (ans) */
  fullContributionYears: 44,

  /** Âge de référence cible AVS21 (homme, et femme dès 1964) */
  referenceAgeMen: 65,
  referenceAgeWomenLegacy: 64, // femmes nées ≤ 1960
  referenceAgeMin: 62, // retraite anticipée
  referenceAgeMax: 70, // ajournement

  /** Délai de rachat rétroactif années manquantes (ans) */
  retroactiveContributionYears: 5,
} as const;

export type Avs2026 = typeof AVS_2026;
