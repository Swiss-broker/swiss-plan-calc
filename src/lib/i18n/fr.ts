// Dictionnaire français · v1 (seule langue implémentée).
//
// Ajouter une clé ici → utilisable via `t('cle', { params })` côté UI.
// Pour ajouter DE/IT en v2, créer src/lib/i18n/de.ts / it.ts avec les mêmes
// clés et basculer la sélection dans src/lib/i18n/index.ts.

export const fr: Record<string, string> = {
  // === Cantons (selectable v1) ===
  "canton.GE": "Genève",
  "canton.VD": "Vaud",
  "canton.VS": "Valais",
  "canton.FR": "Fribourg",
  "canton.NE": "Neuchâtel",
  "canton.JU": "Jura",
  // === Cantons (comparable v1) ===
  "canton.ZG": "Zoug",

  // === Comparateur cantonal ===
  "comparator.scope.notice":
    "📍 Comparaison sur les 6 cantons romands + Zoug (référence). 19 autres cantons disponibles prochainement.",
  "comparator.zg.badge": "Référence fiscalité optimisée",
  "comparator.zg.tooltip":
    "Comparaison hors Suisse romande — non disponible comme canton de domicile en v1.",
  "comparator.section.romand": "Cantons romands",
  "comparator.section.reference": "Référence hors Suisse romande",

  // === Optimiseur · suggestions chiffrées (avec interpolation) ===
  "lpp.rachat.suggestion":
    "Capacité de rachat LPP : {montant} CHF. Économie estimée à votre taux marginal ({taux}%) : {economie} CHF.",
  "canton.move.suggestion":
    "Domicile à {ville} ({code}) : économie estimée de {economie} CHF/an par rapport à {actuel}.",

  // === Commun ===
  "common.year.short": "an",
  "common.years.short": "ans",
};
