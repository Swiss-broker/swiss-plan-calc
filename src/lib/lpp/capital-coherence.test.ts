import { describe, expect, it } from "vitest";
import { annuityVsLumpSum, capitalWithdrawalTax } from "./index";
import { compareVestedStrategies } from "./vested";
import { computeIFD } from "../tax/ifd";

describe("capitalWithdrawalTax — impôt sur les prestations en capital", () => {
  it("IFD = 1/5 du barème sur le capital lui-même, sans aucune déduction (art. 38 LIFD)", () => {
    const tax = capitalWithdrawalTax({ capital: 500_000, canton: "GE", status: "single" });
    expect(tax.ifd).toBe(Math.round(computeIFD(500_000, "single") / 5));
    expect(tax.total).toBe(tax.ifd + tax.cantonal);
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
