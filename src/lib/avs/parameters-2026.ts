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

  /** Revenu annuel moyen plancher (en deçà → rente min) = 12 × rente min. */
  minDeterminingIncome: 15_120,
  /** Revenu annuel moyen plafond (au-delà → rente max) = 72 × rente
   *  mensuelle min (art. 34 LAVS). 88'200 était la valeur 2023-2024. */
  maxDeterminingIncome: 90_720,
  /** Revenu charnière de la formule de rente = 36 × rente mensuelle min
   *  (art. 34 al. 2 LAVS). */
  hingeIncome: 45_360,

  /** Nombre de rentes de VIEILLESSE versées par an : 13 depuis décembre
   *  2026 (13e rente AVS, votation du 3 mars 2024). Ne concerne ni les
   *  rentes AI, ni les rentes de survivants, ni les rentes pour enfants. */
  oldAgePensionsPerYear: 13,

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
