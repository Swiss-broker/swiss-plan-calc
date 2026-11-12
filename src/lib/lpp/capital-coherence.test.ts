import { describe, expect, it } from "vitest";
import { annuityVsLumpSum, capitalWithdrawalTax } from "./index";
import { staggeredWithdrawal } from "../pillar3";
import { compareVestedStrategies } from "./vested";
import { computeIFD } from "../tax/ifd";

describe("capitalWithdrawalTax — impôt sur les prestations en capital", () => {
  it("IFD = 1/5 du barème sur le capital lui-même, sans aucune déduction (art. 38 LIFD)", () => {
    const tax = capitalWithdrawalTax({ capital: 500_000, canton: "GE", status: "single" });
    expect(tax.ifd).toBe(Math.round(computeIFD(500_000, "single") / 5));
    expect(Math.abs(tax.total - (tax.ifd + tax.cantonal))).toBeLessThanOrEqual(1);
  });

  it("capital nul → aucun impôt", () => {
    expect(capitalWithdrawalTax({ capital: 0, canton: "VD", status: "married" }).total).toBe(0);
  });
});

describe("Cohérence « Libre passage » ↔ « Rente vs capital »", () => {
  it("même capital, même canton → même impôt de sortie dans les deux calculateurs", () => {
    for (const canton of ["GE", "VD", "VS", "FR", "NE", "JU", "ZG", "BE", "ZH"]) {
      const [current] = compareVestedStrategies(400_000, 0, canton);
      const reference = capitalWithdrawalTax({
        capital: current.finalBalance,
        canton,
        status: "single",
      });
      expect(current.estimatedExitTax).toBe(reference.total);
    }
  });
});

describe("annuityVsLumpSum — même base de comparaison des deux côtés", () => {
  const base = {
    capital: 500_000,
    conversionRate: 6,
    yearsAlive: 20,
    rentMarginalRate: 20,
    lumpSumTax: 40_000,
  };

  it("rendement nul : le capital net est simplement consommé, pas multiplié", () => {
    const r = annuityVsLumpSum({ ...base, selfReturnRate: 0 });
    expect(r.netLumpSum).toBe(460_000);
    expect(r.annualDrawdown).toBe(23_000);
    expect(r.netAnnuity).toBe(Math.round(500_000 * 0.06 * 20 * 0.8));
  });

  it("le capital placé est consommé progressivement (annuité certaine), pas capitalisé 20 ans sans retrait", () => {
    const r = annuityVsLumpSum({ ...base, selfReturnRate: 2 });
    const neverTouched = 460_000 * Math.pow(1.02, 20);
    expect(r.netLumpSum).toBeLessThan(neverTouched);
    expect(r.netLumpSum).toBeGreaterThan(460_000);
    // Annuité certaine : 460'000 × 0.02 / (1 − 1.02^-20) ≈ 28'132 CHF/an
    expect(r.annualDrawdown).toBeGreaterThan(28_100);
    expect(r.annualDrawdown).toBeLessThan(28_170);
  });

  it("un rendement plus élevé avantage toujours le capital", () => {
    const low = annuityVsLumpSum({ ...base, selfReturnRate: 1 });
    const high = annuityVsLumpSum({ ...base, selfReturnRate: 4 });
    expect(high.netLumpSum).toBeGreaterThan(low.netLumpSum);
  });
});

describe("capitalWithdrawalTax — impôt cantonal progressif, recoupé avec les montants publiés 2025-2026", () => {
  // Impôt total (IFD + canton + commune, chef-lieu, personne seule) publié
  // dans les comparatifs 2025-2026 ; tolérance indiquée par ligne.
  const published: Array<[canton: string, capital: number, total: number, tolerance: number]> = [
    ["GE", 500_000, 37_051, 0.01],
    ["VD", 100_000, 4_456, 0.01],
    ["VD", 500_000, 41_950, 0.04],
    ["VD", 1_000_000, 90_600, 0.04],
    ["NE", 100_000, 5_676, 0.01],
    ["VS", 100_000, 4_760, 0.01],
    ["VS", 250_000, 14_483, 0.01],
    ["VS", 500_000, 38_041, 0.01],
    ["VS", 1_000_000, 103_000, 0.01],
    ["FR", 100_000, 3_260, 0.01],
    ["FR", 500_000, 46_583, 0.01],
    ["JU", 250_000, 21_396, 0.01],
    ["JU", 500_000, 48_183, 0.01],
    ["ZG", 500_000, 28_253, 0.02],
  ];
  it.each(published)("%s, capital %i : proche de %i CHF", (canton, capital, total, tolerance) => {
    const tax = capitalWithdrawalTax({ capital, canton, status: "single" }).total;
    expect(Math.abs(tax - total) / total).toBeLessThan(tolerance);
  });

  it("l'impôt augmente avec le capital et le taux moyen ne baisse jamais (cantons romands)", () => {
    for (const canton of ["GE", "VD", "NE", "VS", "FR", "JU"]) {
      for (const status of ["single", "married"] as const) {
        let previousTax = 0;
        let previousRate = 0;
        for (let capital = 25_000; capital <= 2_000_000; capital += 25_000) {
          const tax = capitalWithdrawalTax({ capital, canton, status }).cantonal;
          const rate = tax / capital;
          // Petit capital : le barème ordinaire peut donner 0 (franchise), puis
          // l'impôt ne fait que croître.
          expect(tax).toBeGreaterThanOrEqual(previousTax);
          if (capital >= 100_000) expect(tax).toBeGreaterThan(previousTax);
          expect(rate).toBeGreaterThanOrEqual(previousRate - 0.0005);
          previousTax = tax;
          previousRate = rate;
        }
      }
    }
  });

  it("un couple ne paie pas plus qu'une personne seule pour le même capital", () => {
    for (const canton of ["GE", "VD", "NE", "VS", "FR", "JU"]) {
      for (const capital of [100_000, 300_000, 800_000]) {
        const single = capitalWithdrawalTax({ capital, canton, status: "single" }).total;
        const married = capitalWithdrawalTax({ capital, canton, status: "married" }).total;
        expect(married).toBeLessThanOrEqual(single);
      }
    }
  });

  it("Neuchâtel : taux minimal de 5 % (2,5 % canton + 2,5 % commune) sur un petit capital", () => {
    const tax = capitalWithdrawalTax({ capital: 30_000, canton: "NE", status: "single" });
    expect(tax.cantonal).toBeGreaterThanOrEqual(1_500);
  });

  it("échelonner un 3a sur trois retraits réduit l'impôt dans les six cantons romands", () => {
    for (const canton of ["GE", "VD", "NE", "VS", "FR", "JU"]) {
      const r = staggeredWithdrawal({
        totalCapital: 450_000,
        numberOfAccounts: 3,
        canton,
        status: "single",
      });
      expect(r.savings).toBeGreaterThan(2_000);
    }
  });
});
