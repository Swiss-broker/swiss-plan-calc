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

describe("computeRegimeAwareDeduction — frontalier GE avec enfants : la TOU elle-même est avantageuse", () => {
  const withKids = bundle({
    gross_annual_salary: 78_000,
    bonus: 0,
    children: [
      { date_of_birth: "2019-05-01", in_household: true },
      { date_of_birth: "2021-09-12", in_household: true },
    ],
  } as unknown as Partial<Client>);

  it("sans montant saisi : bandeau positif (TOU avantageuse), économie du versement à 0, pas de « pas avantageux »", () => {
    const r = computeRegimeAwareDeduction({
      bundle: withKids,
      fallbackTaxInput: { canton: "GE", status: "single", grossSalary: 78_000 },
      deductionAmount: 0,
      deductionField: "lppBuyback",
    });
    expect(r.applicable).toBe("conditional");
    expect(r.taxSavings).toBe(0);
    expect(r.beneficial).toBe(true);
    expect(r.note).toMatch(/impôt à la source/);
    expect(r.note).toMatch(/Demander la TOU/);
  });

  it("avec un versement 3a (1 enfant) : économie supplémentaire chiffrée, une fois la TOU demandée", () => {
    // Avec 2 enfants l'impôt après TOU est déjà presque nul : un 3a n'y ajoute rien.
    const oneChild = bundle({
      gross_annual_salary: 78_000,
      bonus: 0,
      children: [{ date_of_birth: "2019-05-01", in_household: true }],
    } as unknown as Partial<Client>);
    const r = computeRegimeAwareDeduction({
      bundle: oneChild,
      fallbackTaxInput: { canton: "GE", status: "single", grossSalary: 78_000 },
      deductionAmount: 7_258,
      deductionField: "pillar3aContributions",
    });
    expect(r.beneficial).toBe(true);
    expect(r.taxSavings).toBeGreaterThan(300);
    expect(r.note).toMatch(/Une fois la TOU demandée/);
  });
});
