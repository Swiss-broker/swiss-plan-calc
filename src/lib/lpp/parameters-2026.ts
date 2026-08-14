/**
 * Paramètres LPP / 2e pilier · Suisse 2026
 *
 * Source : Office fédéral des assurances sociales (OFAS), barème LPP 2026
 * publié au Recueil officiel, voir https://www.bsv.admin.ch (paramètres LPP).
 *
 * Ces constantes sont la **référence officielle** utilisée par le moteur
 * (src/lib/lpp/index.ts) et par la note pédagogique affichée dans les
 * calculateurs. Toute modification doit être justifiée par une publication
 * OFAS et reportée dans CHANGELOG.
 */

export const LPP_2026 = {
  /** Déduction de coordination (CHF) */
  coordinationDeduction: 26_460,
  /** Plafond du salaire assuré obligatoire (CHF), 7,5× rente AVS max */
  maxInsuredSalary: 90_720,
  /** Salaire annuel minimum d'assujettissement (CHF) */
  minAnnualSalary: 22_680,
  /** Taux d'intérêt minimal LPP (%) */
  minInterestRate: 1.25,
  /** Taux de conversion utilisé pour les PROJECTIONS long terme (%).
   *  Choix métier volontaire, PAS le taux légal actuel : le vrai taux
   *  légal minimum LPP 2026 pour la partie obligatoire est de 6.8%
   *  (confirmé après le rejet de la réforme LPP en votation populaire
   *  de septembre 2024). On projette prudemment à 6.0% pour anticiper
   *  la tendance à la baisse de ce taux sur le long terme (vieillissement
   *  démographique, taux d'intérêt bas). Ne pas "corriger" à 6.8 sans
   *  en discuter avec Karlyta : c'est un choix assumé, pas un bug. */
  conversionRate: 6.0,
  /** Bonifications de vieillesse (% du salaire coordonné) */
  ageCredits: {
    "25-34": 7,
    "35-44": 10,
    "45-54": 15,
    "55-65": 18,
  },
  /** Plafond plan 1e cadre (CHF), référence indicative */
  oneEPlanCap: 860_000,
} as const;

export const LPP_2026_SOURCE_NOTE =
  "Paramètres LPP 2026 publiés par l'Office fédéral des assurances sociales (OFAS).";
