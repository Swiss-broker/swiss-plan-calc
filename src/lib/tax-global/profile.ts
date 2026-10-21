// Détection automatique du régime fiscal à partir de l'input unifié.
// Réutilise les règles déjà encodées dans le projet (suggestTaxStatus, cross-border).

import type { TaxGlobalInput, Regime, GlobalCivilStatus } from "./types";
import { isFrAccordCanton } from "@/lib/tax/cross-border";

export interface RegimeDetection {
  regime: Regime;
  regimeLabel: string;
  reason: string;
}

/** Couple fiscal (CH) : seulement mariage + partenariat enregistré. */
export function isCoupleStatus(s: GlobalCivilStatus): boolean {
  return s === "married" || s === "registered_partnership";
}

/** Convertit un statut "global" vers le statut attendu par les moteurs (income/source). */
export function toTaxStatus(
  s: GlobalCivilStatus,
  children: number,
): "single" | "married" | "single_with_children" {
  if (isCoupleStatus(s)) return "married";
  return children > 0 ? "single_with_children" : "single";
}

/** Statut binaire FR (frontalier) : couple = mariage/partenariat seulement. */
export function toFrenchStatus(s: GlobalCivilStatus): "single" | "married" {
  return isCoupleStatus(s) ? "married" : "single";
}

export function detectRegime(input: TaxGlobalInput): RegimeDetection {
  const country = (input.countryOfResidence || "").toUpperCase();
  const permit = input.permit;
  const canton = (input.canton || "").toUpperCase();
  const livesAbroad = country !== "" && country !== "CH";

  // ─── Statut connu (fiche client, champ tax_status) : prioritaire sur la
  // déduction par permis/pays/part du revenu ci-dessous. Cette déduction
  // automatique ne peut pas savoir qu'un permis B est en réalité déjà en
  // imposition ordinaire (ex. assujettissement déjà obtenu, conjoint
  // suisse, dépassement de seuil cantonal...) — des cas réels où le
  // courtier avait correctement enregistré "Résident" sur la fiche, mais
  // où le calcul recalculait quand même "Imposé à la source" à partir du
  // seul permis, mettant à zéro toute économie d'impôt 3a/rachat LPP (voir
  // regime-aware-deduction.ts) alors que le client était bien en
  // imposition ordinaire.
  if (input.knownTaxStatus === "resident") {
    return {
      regime: "resident_ordinary",
      regimeLabel: "Résident, taxation ordinaire",
      reason: `Statut fiscal "Résident" enregistré sur la fiche client : déclaration ordinaire (revenu + fortune), quel que soit le permis.`,
    };
  }
  if (input.knownTaxStatus === "source_taxed" || input.knownTaxStatus === "tou") {
    const totalIncomeKnown =
      input.grossSalary + input.bonus + input.spouseGrossSalary + input.otherIncome + input.rentalIncome;
    const worldwideKnown = totalIncomeKnown + input.foreignIncome;
    const swissShareKnown = worldwideKnown > 0 ? totalIncomeKnown / worldwideKnown : 1;
    if (swissShareKnown >= 0.9) {
      return {
        regime: "tou",
        regimeLabel: "Imposé à la source, éligible TOU (quasi-résident)",
        reason: `Statut fiscal "Imposé à la source" enregistré sur la fiche client, avec ${(swissShareKnown * 100).toFixed(0)}% du revenu mondial en CH : TOU possible (rectification déductions).`,
      };
    }
    return {
      regime: "source_taxed",
      regimeLabel: "Imposé à la source",
      reason: `Statut fiscal "Imposé à la source" enregistré sur la fiche client : impôt à la source mensuel (barème ${canton || "n/a"}).`,
    };
  }
  if (input.knownTaxStatus === "cross_border_fr_1983") {
    return {
      regime: "cross_border_fr_1983",
      regimeLabel: `Frontalier accord franco-suisse 1983 (${canton || "canton à préciser"})`,
      reason: `Statut fiscal "Frontalier accord 1983" enregistré sur la fiche client : imposition en France uniquement, attestation 2041-AS.`,
    };
  }
  if (input.knownTaxStatus === "cross_border_ge") {
    return {
      regime: "cross_border_ge",
      regimeLabel: "Frontalier Genève (IS genevoise + rétrocession)",
      reason: `Statut fiscal "Frontalier Genève" enregistré sur la fiche client : IS genevoise (4.5% rétrocédés à la France) puis imposition en France.`,
    };
  }

  // ─── Résidence à l'étranger → frontalier (peu importe le permis saisi) ───
  if (livesAbroad) {
    if (canton === "GE") {
      return {
        regime: "cross_border_ge",
        regimeLabel: "Frontalier Genève (IS genevoise + rétrocession)",
        reason: `Résidence ${country} + travail à GE : IS genevoise (4.5% rétrocédés à la France) puis imposition en France`,
      };
    }
    if (isFrAccordCanton(canton)) {
      return {
        regime: "cross_border_fr_1983",
        regimeLabel: `Frontalier accord franco-suisse 1983 (${canton})`,
        reason: `Résidence ${country} + travail dans ${canton} (accord 1983) : imposition en France uniquement, attestation 2041-AS`,
      };
    }
    return {
      regime: "cross_border_other",
      regimeLabel: `Frontalier ${canton || "canton à préciser"} (IS canton de travail + impôt pays de résidence)`,
      reason: `Résidence ${country} hors accord 1983 pour ${canton || "ce canton"} : IS suisse + imposition pays de résidence`,
    };
  }

  if (permit === "swiss" || permit === "C") {
    return {
      regime: "resident_ordinary",
      regimeLabel: "Résident, taxation ordinaire",
      reason: "Permis C ou nationalité suisse : déclaration ordinaire (revenu + fortune)",
    };
  }
  if (permit === "G") {
    return {
      regime: "resident_ordinary",
      regimeLabel: "Résident, taxation ordinaire (permis G + résidence CH inhabituel)",
      reason: "Permis G mais résidence CH : vérifier le statut, traité comme résident ordinaire",
    };
  }
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
      regimeLabel: "Imposé à la source, éligible TOU (quasi-résident)",
      reason: `Permis ${permit} résident CH avec ${(swissShare * 100).toFixed(0)}% du revenu mondial en CH : TOU possible (rectification déductions)`,
    };
  }
  return {
    regime: "source_taxed",
    regimeLabel: "Imposé à la source",
    reason: `Permis ${permit} résident CH : impôt à la source mensuel (barème ${canton || "n/a"})`,
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
    workStatus: "employee",
    grossSalary: 120_000,
    bonus: 0,
    familyAllowances: 0,
    spouseGrossSalary: 0,
    otherIncome: 0,
    rentalIncome: 0,
    imputedRent: 0,
    foreignIncome: 0,
    netWealth: 0,
    pillar3aContributions: 0,
    pillar3bContributions: 0,
    lppBuyback: 0,
    mortgageInterest: 0,
    realEstateMaintenance: 0,
    healthInsurancePremiums: 0,
    childCareCosts: 0,
    donations: 0,
    medicalExpenses: 0,
    eurChfRate: 0.95,
    chfToEurRate: 1.05,
    taxYear: 2026,
    lamalAdultMonthlyCHF: 200,
    lamalChildMonthlyCHF: 49.4,
  };
}
