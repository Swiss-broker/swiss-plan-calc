import { describe, expect, it } from "vitest";
import {
  computeCrossBorder,
  frenchChildParts,
  frenchIncomeTax,
  FR_IR_2026,
} from "./cross-border";
import { estimateSocialContributions } from "./income";

describe("impôt français — barème 2026 et quotient familial", () => {
  it("nombre de parts enfants : ½, 1, 2, 3 pour 1, 2, 3, 4 enfants", () => {
    expect(frenchChildParts(0)).toBe(0);
    expect(frenchChildParts(1)).toBe(0.5);
    expect(frenchChildParts(2)).toBe(1);
    expect(frenchChildParts(3)).toBe(2);
    expect(frenchChildParts(4)).toBe(3);
  });

  it("célibataire, 40'000 € imposables : calcul par tranches", () => {
    // (29'579 − 11'600) × 11 % + (40'000 − 29'579) × 30 % = 1'977.69 + 3'126.30
    expect(frenchIncomeTax(40_000, "single", 0)).toBeCloseTo(5_103.99, 1);
  });

  it("couple, 80'000 € imposables : deux parts, soit deux fois l'impôt sur 40'000 €", () => {
    expect(frenchIncomeTax(80_000, "married", 0)).toBeCloseTo(2 * 5_103.99, 1);
  });

  it("plafonnement du quotient familial : un enfant ne réduit pas l'impôt de plus de 1'807 €", () => {
    const without = frenchIncomeTax(150_000, "single", 0);
    const withChild = frenchIncomeTax(150_000, "single", 1);
    expect(without - withChild).toBeCloseTo(FR_IR_2026.quotientCapPerHalfPart, 2);
  });

  it("décote : petit impôt réduit", () => {
    // 20'000 € : (20'000 − 11'600) × 11 % = 924 ; décote = 897 − 45,25 % × 924
    const expected = 924 - (897 - 0.4525 * 924);
    expect(frenchIncomeTax(20_000, "single", 0)).toBeCloseTo(expected, 2);
  });
});

describe("frontalier sous l'accord de 1983 (VD, VS, NE, JU)", () => {
  const base = {
    workCanton: "VD",
    grossAnnualSalary: 100_000,
    status: "single" as const,
    eurChfRate: 0.95,
  };

  it("aucun impôt suisse retenu sur le salaire : tout l'impôt est français", () => {
    const r = computeCrossBorder(base);
    expect(r.swissTax).toBe(0);
    expect(r.swissRate).toBe(0);
    expect(r.totalTax).toBe(r.foreignTax);
    expect(r.foreignTax).toBeGreaterThan(0);
  });

  it("conversion CHF → EUR dans le bon sens (1 EUR = 0.95 CHF ⇒ 100'000 CHF ≈ 105'263 €)", () => {
    const r = computeCrossBorder(base);
    const social = estimateSocialContributions(100_000, 40, "mandatory");
    const netEur = (100_000 - social.avs - social.ac - social.anp - social.lpp) / 0.95;
    const taxable = netEur - Math.min(FR_IR_2026.abatementMax, netEur * 0.1);
    const expectedChf = frenchIncomeTax(taxable, "single", 0) * 0.95;
    expect(r.foreignTax).toBe(Math.round(expectedChf));
  });

  it("le canton de travail ne change pas l'impôt (même régime dans les quatre cantons)", () => {
    const taxes = ["VD", "VS", "NE", "JU"].map(
      (c) => computeCrossBorder({ ...base, workCanton: c }).totalTax,
    );
    expect(new Set(taxes).size).toBe(1);
  });

  it("3 enfants : 2 parts supplémentaires, impôt inférieur à celui de 2 enfants", () => {
    const two = computeCrossBorder({ ...base, status: "married", children: 2 });
    const three = computeCrossBorder({ ...base, status: "married", children: 3 });
    expect(three.totalTax).toBeLessThan(two.totalTax);
  });

  it("frais de garde : crédit d'impôt de 50 % plafonné à 3'500 € par enfant de moins de 6 ans", () => {
    const without = computeCrossBorder({ ...base, children: 1 });
    const withCare = computeCrossBorder({ ...base, children: 1, childCareCostsCHF: 20_000 });
    expect(without.totalTax - withCare.totalTax).toBeCloseTo(3_500 * 0.5 * 0.95, -1);
    const noYoungChild = computeCrossBorder({
      ...base,
      children: 1,
      childrenUnder6: 0,
      childCareCostsCHF: 20_000,
    });
    expect(noYoungChild.totalTax).toBe(without.totalTax);
  });

  it("taux marginal : cohérent avec la tranche française, appliquée à 90 % du salaire net de cotisations", () => {
    // 80'000 CHF : tranche à 30 % → environ 30 % × 90 % × (1 − cotisations marginales)
    const r30 = computeCrossBorder({ ...base, grossAnnualSalary: 80_000 });
    expect(r30.marginalRate).toBeGreaterThan(20);
    expect(r30.marginalRate).toBeLessThan(28);
    // 100'000 CHF : le revenu imposable dépasse 84'577 €, tranche à 41 %
    const r41 = computeCrossBorder(base);
    expect(r41.marginalRate).toBeGreaterThan(30);
    expect(r41.marginalRate).toBeLessThan(38);
  });
});

describe("frontalier à Genève", () => {
  it("impôt à la source genevois uniquement, taux marginal suisse supérieur au taux moyen", () => {
    const r = computeCrossBorder({
      workCanton: "GE",
      grossAnnualSalary: 100_000,
      status: "single",
    });
    expect(r.swissTax).toBeGreaterThan(0);
    expect(r.foreignTax).toBe(0);
    expect(r.marginalRate).toBeGreaterThan(r.swissRate);
  });
});
