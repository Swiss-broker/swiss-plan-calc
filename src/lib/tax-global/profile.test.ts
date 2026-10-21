// Non-régression : detectRegime() doit faire confiance au statut fiscal
// explicitement enregistré sur la fiche client (tax_status) quand il est
// connu, plutôt que de le re-déduire uniquement à partir du permis / pays /
// part du revenu suisse — cette dernière déduction ne peut pas savoir
// qu'un permis B est déjà en imposition ordinaire (ex. assujettissement
// déjà obtenu, conjoint suisse, dépassement de seuil cantonal...).
//
// Bug réel observé en rendez-vous client (deux dossiers, permis B) : un
// client enregistré "Résident" sur sa fiche se voyait recalculer en
// "quasi-résident TOU", ce qui mettait à zéro (ou conditionnait à une
// démarche TOU non pertinente) l'économie d'impôt d'un versement 3e
// pilier A pourtant bien déductible immédiatement pour lui.
import { describe, expect, it } from "vitest";
import { detectRegime, createDefaultInput } from "./profile";
import type { TaxGlobalInput } from "./types";

function buildInput(overrides: Partial<TaxGlobalInput>): TaxGlobalInput {
  return { ...createDefaultInput(), ...overrides };
}

describe("detectRegime — priorité au tax_status connu de la fiche client", () => {
  it('knownTaxStatus "resident" + permis B → resident_ordinary (pas une re-déduction par permis)', () => {
    const g = buildInput({
      permit: "B",
      countryOfResidence: "CH",
      grossSalary: 120_000,
      bonus: 10_000,
      otherIncome: 20_000,
      foreignIncome: 0,
      knownTaxStatus: "resident",
    });
    expect(detectRegime(g).regime).toBe("resident_ordinary");
  });

  it('sans knownTaxStatus, le même permis B 100% revenu CH est re-déduit "tou" (comportement legacy conservé)', () => {
    const g = buildInput({
      permit: "B",
      countryOfResidence: "CH",
      grossSalary: 120_000,
      bonus: 10_000,
      otherIncome: 20_000,
      foreignIncome: 0,
    });
    expect(detectRegime(g).regime).toBe("tou");
  });

  it('knownTaxStatus "source_taxed" + permis B → source_taxed quand la part suisse est sous le seuil TOU (90%)', () => {
    const g = buildInput({
      permit: "B",
      countryOfResidence: "CH",
      grossSalary: 55_000,
      foreignIncome: 20_000,
      knownTaxStatus: "source_taxed",
    });
    expect(detectRegime(g).regime).toBe("source_taxed");
  });

  it('knownTaxStatus "cross_border_fr_1983" prime sur une résidence CH mal saisie', () => {
    const g = buildInput({
      canton: "VD",
      countryOfResidence: "CH",
      knownTaxStatus: "cross_border_fr_1983",
    });
    expect(detectRegime(g).regime).toBe("cross_border_fr_1983");
  });

  it('knownTaxStatus "cross_border_ge" → cross_border_ge', () => {
    const g = buildInput({
      canton: "GE",
      countryOfResidence: "CH",
      knownTaxStatus: "cross_border_ge",
    });
    expect(detectRegime(g).regime).toBe("cross_border_ge");
  });

  it("permis C/suisse reste résident ordinaire même avec knownTaxStatus absent (comportement inchangé)", () => {
    const g = buildInput({ permit: "C", countryOfResidence: "CH" });
    expect(detectRegime(g).regime).toBe("resident_ordinary");
  });
});
