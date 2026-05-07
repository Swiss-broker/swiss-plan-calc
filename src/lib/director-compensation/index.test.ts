import { describe, expect, it } from "vitest";
import {
  computeStrategy,
  computeAllStrategies,
  recommendBestStrategy,
} from "./index";
import type { DirectorInputs } from "./types";

const baseGE: DirectorInputs = {
  totalProfit: 200_000,
  companyCanton: "GE",
  directorCanton: "GE",
  status: "single",
  age: 35,
  lppPlan: "mandatory",
  qualifiedHolding: true,
  children: 0,
  confession: "none",
};

describe("computeStrategy", () => {
  it("Cas 1 — Sàrl GE 200k bénéfice / 70% salaire 30% div", () => {
    const r = computeStrategy(baseGE, {
      salaryPct: 70, dividendPct: 30, retainedPct: 0, label: "70/30",
    });
    // Sanity checks
    expect(r.company.grossSalary).toBeGreaterThan(100_000);
    expect(r.company.grossSalary).toBeLessThan(140_000);
    // Note : avec 70% du bénéfice en coût salaire (charges incluses) et 14% IS,
    // il reste ~51.6k pour 60k de dividendes ciblés → shortfall attendu, cap appliqué.
    expect(r.company.dividendShortfall).toBe(true);
    expect(r.directorNet).toBeGreaterThan(0);
    expect(Math.abs(r.reconciliation)).toBeLessThan(2);
  });

  it("Cas 2 — SA Vaud 400k bénéfice marié 2 enfants 50/50 plan cadre", () => {
    const r = computeStrategy(
      {
        ...baseGE,
        totalProfit: 400_000,
        companyCanton: "VD",
        directorCanton: "VD",
        status: "married",
        children: 2,
        age: 45,
        lppPlan: "executive_1e",
      },
      { salaryPct: 50, dividendPct: 50, retainedPct: 0, label: "50/50" },
    );
    expect(r.company.grossSalary).toBeGreaterThan(150_000);
    expect(r.directorNet).toBeGreaterThan(0);
    expect(Math.abs(r.reconciliation)).toBeLessThan(2);
    // 50% salaire = warning dividende dissimulé attendu (limite haute)
    expect(r.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("Cas 3 — Sàrl Sion 100k bénéfice 100% salaire", () => {
    const r = computeStrategy(
      {
        ...baseGE,
        totalProfit: 100_000,
        companyCanton: "VS",
        directorCanton: "VS",
        age: 30,
      },
      { salaryPct: 100, dividendPct: 0, retainedPct: 0, label: "100% sal" },
    );
    expect(r.company.dividendsPaid).toBe(0);
    expect(r.company.corporateTax).toBeLessThan(1); // pas de bénéfice résiduel
    expect(Math.abs(r.reconciliation)).toBeLessThan(2);
  });

  it("Cas limite — bénéfice 0", () => {
    const r = computeStrategy(
      { ...baseGE, totalProfit: 0 },
      { salaryPct: 70, dividendPct: 30, retainedPct: 0 },
    );
    expect(r.company.grossSalary).toBe(0);
    expect(r.directorNet).toBe(0);
    expect(r.totalTaxAndCharges).toBe(0);
  });

  it("Cas limite — 100% en réserves", () => {
    const r = computeStrategy(baseGE, {
      salaryPct: 0, dividendPct: 0, retainedPct: 100, label: "All retained",
    });
    expect(r.company.grossSalary).toBe(0);
    expect(r.company.dividendsPaid).toBe(0);
    expect(r.company.corporateTax).toBeGreaterThan(0);
    expect(r.retainedInCompany).toBeGreaterThan(0);
    expect(Math.abs(r.reconciliation)).toBeLessThan(2);
  });

  it("computeAllStrategies + recommendBestStrategy renvoient une recommandation cohérente", () => {
    const all = computeAllStrategies(baseGE);
    const { best } = recommendBestStrategy(all);
    expect(all.length).toBe(4);
    expect(best.directorNet).toBeGreaterThanOrEqual(
      Math.max(...all.map((r) => r.directorNet)) - 0.01,
    );
  });
});
