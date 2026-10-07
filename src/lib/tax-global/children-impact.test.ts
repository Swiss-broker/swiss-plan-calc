import { describe, expect, it } from "vitest";
import { computeChildrenImpact } from "./children-impact";
import { createDefaultInput } from "./profile";
import type { TaxGlobalInput } from "./types";

describe("computeChildrenImpact", () => {
  it("retourne null si le client a déjà un enfant", () => {
    const input: TaxGlobalInput = { ...createDefaultInput(), children: 1, childrenAges: [5] };
    expect(computeChildrenImpact(input)).toBeNull();
  });

  it("salarié sans enfant : économie d'impôt positive si un enfant arrivait, allocations informatives non ajoutées au net", () => {
    const input: TaxGlobalInput = {
      ...createDefaultInput(),
      canton: "GE",
      civilStatus: "single",
      grossSalary: 80_000,
      children: 0,
      childrenAges: [],
      familyAllowances: 4_000,
      workStatus: "employee",
    };
    const impact = computeChildrenImpact(input)!;
    expect(impact).not.toBeNull();
    expect(impact.taxSavingsCHF).toBeGreaterThan(0);
    expect(impact.familyAllowancesCHF).toBe(4_000);
    expect(impact.familyAllowancesIncludedInIncome).toBe(false);
    // Salarié : les allocations ne changent pas le revenu brut (déjà
    // comprises des deux côtés) → netImpact = taxSavings uniquement.
    expect(impact.netImpactCHF).toBeCloseTo(impact.taxSavingsCHF, 6);
  });

  it("indépendant sans enfant : allocations ajoutées si un enfant arrivait, netImpact = économie d'impôt + allocations", () => {
    const input: TaxGlobalInput = {
      ...createDefaultInput(),
      canton: "GE",
      civilStatus: "single",
      grossSalary: 80_000,
      children: 0,
      childrenAges: [],
      familyAllowances: 4_000,
      workStatus: "self_employed",
    };
    const impact = computeChildrenImpact(input)!;
    expect(impact.familyAllowancesIncludedInIncome).toBe(true);
    expect(impact.familyAllowancesCHF).toBe(4_000);
    // Indépendant : les allocations s'ajoutent au revenu brut (des deux
    // côtés de la comparaison, mais seulement présentes "avec enfant") —
    // netImpact = taxSavings + familyAllowances exactement (taxSavings
    // reflète déjà l'impôt supplémentaire généré par cette inclusion).
    expect(impact.netImpactCHF).toBeGreaterThanOrEqual(impact.taxSavingsCHF - 1e-6);
    expect(impact.netImpactCHF).toBeCloseTo(impact.taxSavingsCHF + impact.familyAllowancesCHF, 6);
  });
});
