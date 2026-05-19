// Détection automatique du régime fiscal à partir de l'input unifié.
// Réutilise les règles déjà encodées dans le projet (suggestTaxStatus, cross-border).

import type { TaxGlobalInput, Regime } from "./types";
import { isFrAccordCanton } from "@/lib/tax/cross-border";

export interface RegimeDetection {
  regime: Regime;
  regimeLabel: string;
  reason: string;
}

export function detectRegime(input: TaxGlobalInput): RegimeDetection {
  const country = (input.countryOfResidence || "").toUpperCase();
  const permit = input.permit;
  const canton = (input.canton || "").toUpperCase();

  // Frontalier (permis G, résidence hors CH)
  if (permit === "G" && country && country !== "CH") {
    if (canton === "GE") {
      return {
        regime: "cross_border_ge",
        regimeLabel: "Frontalier · Genève (IS genevoise + rétrocession)",
        reason: "Permis G + résidence FR + canton GE",
      };
    }
    if (isFrAccordCanton(canton)) {
      return {
        regime: "cross_border_fr_1983",
        regimeLabel: `Frontalier · Accord franco-suisse 1983 (${canton})`,
        reason: "Permis G + résidence FR + canton accord 1983",
      };
    }
  }

  // Résident CH
  if (country === "CH" || country === "") {
    if (permit === "swiss" || permit === "C") {
      return {
        regime: "resident_ordinary",
        regimeLabel: "Résident · Taxation ordinaire",
        reason: "Permis C ou nationalité suisse",
      };
    }
    if (permit === "B" || permit === "L" || permit === "Ci" || permit === "F") {
      // Quasi-résident potentiel si revenu suisse >= 90% revenu mondial
      const totalIncome =
        input.grossSalary +
        input.bonus +
        input.spouseGrossSalary +
        input.otherIncome +
        input.rentalIncome;
      const worldwide = totalIncome + input.foreignIncome;
      const swissShare = worldwide > 0 ? totalIncome / worldwide : 1;
      if (swissShare >= 0.9) {
        return {
          regime: "tou",
          regimeLabel: "Imposé à la source · Éligible TOU (quasi-résident)",
          reason: "Permis B/L résident CH avec ≥ 90% revenu mondial en CH",
        };
      }
      return {
        regime: "source_taxed",
        regimeLabel: "Imposé à la source",
        reason: "Permis B/L résident CH",
      };
    }
  }

  return {
    regime: "unknown",
    regimeLabel: "Régime à préciser",
    reason: "Combinaison permis/pays non couverte automatiquement",
  };
}

export function createDefaultInput(): TaxGlobalInput {
  return {
    canton: "GE",
    countryOfResidence: "CH",
    permit: "swiss",
    civilStatus: "single",
    spouseEmployed: false,
    children: 0,
    confession: "none",
    age: 40,
    grossSalary: 120_000,
    bonus: 0,
    spouseGrossSalary: 0,
    otherIncome: 0,
    rentalIncome: 0,
    imputedRent: 0,
    foreignIncome: 0,
    netWealth: 0,
    pillar3aContributions: 0,
    lppBuyback: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    healthInsurancePremiums: 0,
    childCareCosts: 0,
    donations: 0,
    eurChfRate: 0.95,
    chfToEurRate: 1.05,
    taxYear: 2026,
    lamalAdultMonthlyCHF: 200,
    lamalChildMonthlyCHF: 49.4,
  };
}
