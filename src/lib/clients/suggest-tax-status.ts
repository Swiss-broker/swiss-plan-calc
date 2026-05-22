// Suggestion automatique du statut fiscal selon nationalité, permis,
// pays de résidence et canton de travail.
// IMPORTANT : ne sert que de pré-remplissage initial (création).
// Le courtier garde la main en cas de cas particulier.
//
// Le statut 'tou' n'est JAMAIS suggéré automatiquement (choix administratif).

import type { TaxStatus, Permit } from "@/lib/swiss/enums";

export interface TaxStatusSuggestionInput {
  nationality?: string | null;
  permit?: Permit | null;
  country_of_residence?: string | null;
  canton?: string | null;
}

const FRONTIER_COUNTRIES = new Set(["FR", "IT", "AT", "DE", "LI"]);
const ACCORD_1983_CANTONS = new Set(["VD", "VS", "NE", "JU", "FR", "BE"]);

export function suggestTaxStatus(
  i: TaxStatusSuggestionInput,
): TaxStatus | null {
  const nationality = (i.nationality ?? "").toUpperCase() || null;
  const country = (i.country_of_residence ?? "").toUpperCase() || null;
  const canton = (i.canton ?? "").toUpperCase() || null;
  const permit = i.permit ?? null;

  // Étape 1, info minimale requise
  if (!country) return null;

  // Étape 2, résident en Suisse
  if (country === "CH") {
    // 2.A, Suisse, permis C, ou permis swiss → résident ordinaire
    if (nationality === "CH" || permit === "C" || permit === "swiss") {
      return "resident";
    }
    // 2.B, Étranger permis B/L/Ci/F → imposé à la source
    if (permit === "B" || permit === "L" || permit === "Ci" || permit === "F") {
      return "source_taxed";
    }
    // 2.C, cas non standard
    return null;
  }

  // Étape 3, résident étranger : frontalier permis G dans pays voisin
  if (permit === "G" && FRONTIER_COUNTRIES.has(country)) {
    if (canton === "GE") return "cross_border_ge";
    if (canton && ACCORD_1983_CANTONS.has(canton)) return "cross_border_fr_1983";
    return null;
  }

  // Étape 4, autre cas (expatrié, etc.)
  return null;
}
