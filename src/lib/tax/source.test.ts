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
