import { describe, expect, it } from "vitest";
import { computeRegimeAwareDeduction } from "./regime-aware-deduction";
import type { ClientBundle } from "@/lib/clients/to-calculator-input";
import type { Client } from "@/lib/clients/types";

function bundle(overrides: Partial<Client> = {}): ClientBundle {
  const client = {
    canton: "GE",
    commune: null,
    country_of_residence: "FR",
    permit: "G",
    tax_status: "cross_border_ge",
    civil_status: "single",
    children: [],
    confession: "none",
    date_of_birth: "1993-07-15",
    work_status: "employee",
    gross_annual_salary: 60_000,
    bonus: 5_000,
    spouse_gross_annual_salary: null,
    other_income: 0,
    family_allowances: null,
    mortgage_interest_france: null,
    ...overrides,
  } as unknown as Client;
  return { client, pension: null, assets: null };
}

describe("computeRegimeAwareDeduction — frontalier GE, beneficial exposé", () => {
  it("beneficial=false quand la déduction ne bat pas la retenue source (note explicite avec le montant réel)", () => {
    const result = computeRegimeAwareDeduction({
      bundle: bundle(),
      fallbackTaxInput: { canton: "GE", status: "single", grossSalary: 65_000 },
      deductionAmount: 7_258 - 2_400,
      deductionField: "pillar3aContributions",
    });
    expect(result.applicable).toBe("conditional");
    expect(result.beneficial).toBe(false);
    expect(result.taxSavings).toBe(0);
    expect(result.note).toMatch(/coûterait/);
  });

  it("beneficial=true quand le rachat LPP est assez important pour battre la retenue source", () => {
    const result = computeRegimeAwareDeduction({
      bundle: bundle(),
      fallbackTaxInput: { canton: "GE", status: "single", grossSalary: 65_000 },
      deductionAmount: 30_000,
      deductionField: "lppBuyback",
    });
    expect(result.applicable).toBe("conditional");
    expect(result.beneficial).toBe(true);
    expect(result.taxSavings).toBeGreaterThan(0);
  });
});
