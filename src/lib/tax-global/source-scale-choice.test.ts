import { describe, it, expect } from "vitest";
import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput } from "./types";

const base = (o: Partial<TaxGlobalInput>): TaxGlobalInput => ({
  age: 40,
  bonus: 0,
  permit: "G",
  lppPlan: "mandatory",
  taxYear: 2026,
  donations: 0,
  netWealth: 0,
  confession: "none",
  eurChfRate: 0.95,
  chfToEurRate: 1.05,
  lppBuyback: 0,
  workStatus: "employee",
  imputedRent: 0,
  otherIncome: 0,
  childrenAges: [8, 10],
  rentalIncome: 0,
  foreignIncome: 0,
  childCareCosts: 0,
  spouseEmployed: false,
  medicalExpenses: 0,
  familyAllowances: 0,
  mortgageInterest: 3000,
  spouseGrossSalary: 0,
  countryOfResidence: "FR",
  pillar3aContributions: 1200,
  realEstateMaintenance: 0,
  healthInsurancePremiums: 0,
  pillar3bContributions: 0,
  lamalAdultMonthlyCHF: 450,
  lamalChildMonthlyCHF: 120,
  canton: "GE",
  civilStatus: "single",
  children: 2,
  grossSalary: 78_000,
  ...o,
});

describe("choix du barème avant / après rectification", () => {
  const frontalier = (o: Partial<TaxGlobalInput> = {}) =>
    computeTaxGlobal(base({ countryOfResidence: "FR", permit: "G", ...o }));

  it("frontalier GE non marié, 2 enfants : A0 aujourd'hui, H2 après rectification", () => {
    const r = frontalier();
    const rect = r.sourceRectification!;
    expect(rect.defaultScaleCode).toBe("A0");
    expect(rect.rectifiedScaleCode).toBe("H2");
    expect(rect.applicable).toBe(true);
    expect(rect.defaultAnnualTax).toBe(r.totalTaxCHF);
    expect(rect.rectifiedAnnualTax).toBeLessThan(rect.defaultAnnualTax);
    // La TOU reste chiffrée à part, avec son détail.
    const b = r.touComparison!.ordinaryBreakdown;
    expect(
      Math.abs(
        b.cantonal + b.communal + b.church + b.personalTax + b.ifd + b.wealthTax -
          r.touComparison!.ordinaryTax,
      ),
    ).toBeLessThanOrEqual(2);
  });

  it("barème actuel forcé à H : l'impôt du jour suit le barème choisi", () => {
    const auto = frontalier();
    const r = frontalier({ sourceScale: "H" });
    expect(r.sourceRectification!.defaultScaleCode).toBe("H2");
    expect(r.sourceRectification!.applicable).toBe(false);
    expect(r.totalTaxCHF).toBe(auto.sourceRectification!.rectifiedAnnualTax);
  });

  it("séparation : H aujourd'hui, A après rectification, l'impôt remonte", () => {
    const r = frontalier({ sourceScale: "H", rectifiedSourceScale: "A" });
    const rect = r.sourceRectification!;
    expect(rect.defaultScaleCode).toBe("H2");
    expect(rect.rectifiedScaleCode).toBe("A0");
    expect(rect.delta).toBeGreaterThan(0);
  });

  it("le choix du barème ne change pas l'impôt après TOU", () => {
    const a = frontalier({ assumeTou: true });
    const h = frontalier({ assumeTou: true, sourceScale: "H" });
    expect(h.totalTaxCHF).toBe(a.totalTaxCHF);
  });

  it("résident imposé à la source : mêmes règles", () => {
    const r = computeTaxGlobal(base({ canton: "VD", permit: "B", countryOfResidence: "CH" }));
    expect(r.sourceRectification!.defaultScaleCode).toBe("A0");
    expect(r.sourceRectification!.rectifiedScaleCode).toBe("H2");
    const forced = computeTaxGlobal(
      base({ canton: "VD", permit: "B", countryOfResidence: "CH", sourceScale: "H" }),
    );
    expect(forced.totalTaxCHF).toBe(r.sourceRectification!.rectifiedAnnualTax);
  });
});
