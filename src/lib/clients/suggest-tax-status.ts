// Suggestion automatique du statut fiscal selon nationalité, permis,
// pays de résidence et canton de travail.
// IMPORTANT : ne sert que de pré-remplissage initial (création).
// Le courtier garde la main en cas de cas particulier.

import type { TaxStatus, Permit } from "@/lib/swiss/enums";

export interface TaxStatusSuggestionInput {
  nationality?: string | null;
  permit?: Permit | null;
  country_of_residence?: string | null;
  canton?: string | null;
}

const CROSS_BORDER_FR_1983_CANTONS = new Set([
  "VD",
  "VS",
  "NE",
  "JU",
  "FR",
  "BE",
]);

export function suggestTaxStatus(
  i: TaxStatusSuggestionInput,
): TaxStatus | null {
  const nat = (i.nationality ?? "").toUpperCase();
  const country = (i.country_of_residence ?? "").toUpperCase();
  const canton = (i.canton ?? "").toUpperCase();
  const permit = i.permit ?? null;

  // Suisse / établi → résident ordinaire
  if (nat === "CH" || permit === "swiss" || permit === "C") {
    return "resident";
  }

  // Frontalier (résidence hors Suisse)
  if (country && country !== "CH") {
    if (canton === "GE") return "cross_border_ge";
    if (CROSS_BORDER_FR_1983_CANTONS.has(canton) && country === "FR") {
      return "cross_border_fr_1983";
    }
    // Autre cas frontalier non couvert → laisse le courtier choisir
    return null;
  }

  // Résident en Suisse avec permis B/L/Ci/F → imposé à la source
  if (
    permit === "B" ||
    permit === "L" ||
    permit === "Ci" ||
    permit === "F"
  ) {
    return "source_taxed";
  }

  return null;
}
