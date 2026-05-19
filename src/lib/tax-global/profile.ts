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
  const livesAbroad = country !== "" && country !== "CH";

  // ─── Résidence à l'étranger → frontalier (peu importe le permis saisi) ───
  if (livesAbroad) {
    if (canton === "GE") {
      return {
        regime: "cross_border_ge",
        regimeLabel: "Frontalier · Genève (IS genevoise + rétrocession)",
        reason: `Résidence ${country} + travail à GE → IS genevoise (4.5% rétrocédés à la France) puis imposition en France`,
      };
    }
    if (isFrAccordCanton(canton)) {
      return {
        regime: "cross_border_fr_1983",
        regimeLabel: `Frontalier · Accord franco-suisse 1983 (${canton})`,
        reason: `Résidence ${country} + travail dans ${canton} (accord 1983) → imposition en France uniquement, attestation 2041-AS`,
      };
    }
    // Autres cantons : par défaut, IS suisse + impôt résidence (proche modèle GE)
    return {
      regime: "cross_border_ge",
      regimeLabel: `Frontalier · ${canton || "canton à préciser"} (modèle source CH + impôt résidence)`,
      reason: `Résidence ${country} hors accord 1983 pour ${canton || "ce canton"} → IS suisse + imposition pays de résidence`,
    };
  }

  // ─── Résident CH ───
  if (permit === "swiss" || permit === "C") {
    return {
      regime: "resident_ordinary",
      regimeLabel: "Résident · Taxation ordinaire",
      reason: "Permis C ou nationalité suisse → déclaration ordinaire (revenu + fortune)",
    };
  }
  if (permit === "G") {
    // Cas atypique : résident CH déclaré avec permis G → traite comme ordinaire
    return {
      regime: "resident_ordinary",
      regimeLabel: "Résident · Taxation ordinaire (permis G + résidence CH = inhabituel)",
      reason: "Permis G mais résidence CH : vérifier le statut, traité comme résident ordinaire",
    };
  }
  // Permis B / L / Ci / F → source, avec règle TOU si revenu CH ≥ 90% revenu mondial
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
      reason: `Permis ${permit} résident CH avec ${(swissShare * 100).toFixed(0)}% du revenu mondial en CH → TOU possible (rectification déductions)`,
    };
  }
  return {
    regime: "source_taxed",
    regimeLabel: "Imposé à la source",
    reason: `Permis ${permit} résident CH → impôt à la source mensuel (barème ${canton || "—"})`,
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
