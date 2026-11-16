import { describe, it, expect } from "vitest";
import { computeSavingReuse } from "./saving-reuse";
import { computeTaxGlobal } from "./engine";
import { createDefaultInput } from "./profile";
import type { TaxGlobalInput } from "./types";

const g = (o: Partial<TaxGlobalInput>): TaxGlobalInput => ({ ...createDefaultInput(), ...o });

describe("report de l'économie d'impôt vers le 3e pilier", () => {
  const frontalier = g({
    canton: "GE",
    countryOfResidence: "FR",
    permit: "G",
    civilStatus: "single",
    children: 2,
    childrenAges: [8, 10],
    grossSalary: 78_000,
    age: 40,
  });

  it("économie = impôt d'aujourd'hui − impôt après démarche du Fiscal global", () => {
    const r = computeSavingReuse(frontalier);
    const today = Math.round(computeTaxGlobal(frontalier).totalTaxCHF);
    expect(r.todayTax).toBe(today);
    expect(r.annualSaving).toBe(r.todayTax - r.afterTax);
    expect(r.annualSaving).toBeGreaterThan(8_000);
    expect(r.origin).toBe("rectification"); // H2 = 0 CHF, mieux que la TOU (25 CHF)
    expect(r.years).toBe(25);
  });

  it("3a plafonné au plafond légal, le solde part en 3b ; mêmes montants annuels partout", () => {
    const r = computeSavingReuse(frontalier);
    const a = r.placements.find((p) => p.id === "pillar3a")!;
    expect(a.yearlyAmount).toBe(r.annualSaving);
    expect(a.leftover).toBe(r.annualSaving - r.room3a);
    for (const p of r.placements) expect(p.yearlyAmount).toBe(r.annualSaving);
  });

  it("résident déjà en taxation ordinaire : aucune économie de démarche, aucune proposition", () => {
    const r = computeSavingReuse(g({ canton: "VD", grossSalary: 95_000 }));
    expect(r.annualSaving).toBe(0);
    expect(r.placements).toEqual([]);
  });

  it("imposé à la source sans enfant, avec déductions : la TOU dégage l'économie, le 3a en ajoute", () => {
    const r = computeSavingReuse(
      g({ canton: "GE", permit: "B", grossSalary: 90_000, mortgageInterest: 12_000, lppBuyback: 10_000 }),
    );
    expect(r.origin).toBe("tou");
    const a = r.placements.find((p) => p.id === "pillar3a")!;
    expect(a.extraTaxSavingPerYear).toBeGreaterThan(0);
    expect(r.bestId).toBe("pillar3a");
    const sav = r.placements.find((p) => p.id === "savings")!;
    expect(a.netGain).toBeGreaterThan(sav.netGain);
  });
});
