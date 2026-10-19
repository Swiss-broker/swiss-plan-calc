import { describe, expect, it } from "vitest";
import { computeSourceTax } from "./source";

// Vérifié contre les barèmes officiels B et C du canton du Jura, édition
// 2026 (jura.ch, Service de l'impôt à la source) — valeurs exactes lues
// dans les tranches "9'951 - 10'000", "7'951 - 8'000", etc.
describe("computeSourceTax JU — barèmes officiels B/C", () => {
  it("barème B, 0 enfant, 8'000 CHF/mois → 10.20 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B" });
    expect(r.rate).toBeCloseTo(10.2, 2);
  });

  it("barème B, 1 enfant, 8'000 CHF/mois → 8.21 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B", children: 1 });
    expect(r.rate).toBeCloseTo(8.21, 2);
  });

  it("barème B, 2 enfants, 10'000 CHF/mois → 8.89 %", () => {
    const r = computeSourceTax({ monthlyGross: 10_000, canton: "JU", scale: "B", children: 2 });
    expect(r.rate).toBeCloseTo(8.89, 2);
  });

  it("barème C, 0 enfant, 8'000 CHF/mois combiné → 14.39 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "C" });
    expect(r.rate).toBeCloseTo(14.39, 2);
  });

  it("barème C, 1 enfant, 20'000 CHF/mois combiné → 22.48 %", () => {
    const r = computeSourceTax({ monthlyGross: 20_000, canton: "JU", scale: "C", children: 1 });
    expect(r.rate).toBeCloseTo(22.48, 2);
  });

  it("revenu nul ou sous le premier palier → taux 0", () => {
    const r = computeSourceTax({ monthlyGross: 500, canton: "JU", scale: "B" });
    expect(r.rate).toBe(0);
  });

  it("barème A (pas de table officielle JU) reste sur l'approximation générique, sans planter", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "A" });
    expect(r.rate).toBeGreaterThan(0);
  });
});

describe("computeSourceTax — taux marginal distinct du taux moyen (régression)", () => {
  it("VD, barème A0, 5'000 CHF/mois (60'000/an, palier croissant) : le marginal est strictement supérieur au taux moyen, jamais identique", () => {
    const r = computeSourceTax({ monthlyGross: 5_000, canton: "VD", scale: "A" });
    expect(r.marginalRate).toBeGreaterThan(r.rate);
  });

  it("revenu sous le premier palier (taux 0 des deux côtés) : marginal et moyen peuvent coïncider à 0", () => {
    const r = computeSourceTax({ monthlyGross: 500, canton: "VD", scale: "A" });
    expect(r.rate).toBe(0);
    expect(r.marginalRate).toBeGreaterThanOrEqual(0);
  });

  it("frontalier France (retenue fixe 4.5 %) : marginal = moyen, cas légitime de taux plat", () => {
    const r = computeSourceTax({
      monthlyGross: 5_000,
      canton: "GE",
      scale: "A",
      isCrossBorderFR: true,
    });
    expect(r.rate).toBe(4.5);
    expect(r.marginalRate).toBeCloseTo(4.5, 1);
  });
});
