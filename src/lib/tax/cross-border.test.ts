import { describe, expect, it } from "vitest";
import { computeCrossBorder, GE_IS_RATES_2026 } from "./cross-border";

describe("computeCrossBorder GE — barème par défaut sans tenir compte des enfants (régression)", () => {
  it("célibataire, 1 enfant, 60'000 CHF à Genève : utilise le barème A0 (sans enfant), pas A1 (repéré en test : 25 CHF au lieu de ~3'312 CHF)", () => {
    const withChild = computeCrossBorder({
      workCanton: "GE",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 1,
    });
    const withoutChild = computeCrossBorder({
      workCanton: "GE",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 0,
    });
    // Même barème A0 appliqué que le client ait 0 ou 1 enfant par défaut.
    expect(withChild.swissTax).toBe(withoutChild.swissTax);
    // Barème officiel 2026 : A0 à 60'000 CHF/an = 7.62 %.
    expect(GE_IS_RATES_2026.A0.length).toBeGreaterThan(10);
    expect(Math.abs(withChild.swissTax - 60_000 * 0.0762)).toBeLessThan(30);
    expect(withChild.swissTax).toBeGreaterThan(1_000);
  });

  it("signale la possibilité de rectification dans les notes quand il y a des enfants", () => {
    const r = computeCrossBorder({
      workCanton: "GE",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 1,
    });
    expect(r.notes.some((n) => n.includes("rectification"))).toBe(true);
  });

  it("sans enfant, aucune note de rectification ajoutée", () => {
    const r = computeCrossBorder({
      workCanton: "GE",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 0,
    });
    expect(r.notes.some((n) => n.includes("rectification"))).toBe(false);
  });
});

describe("computeCrossBorder Fribourg — même règle de barème par défaut", () => {
  it("célibataire, 2 enfants, 60'000 CHF à Fribourg : utilise le barème A0, pas H2", () => {
    const withChildren = computeCrossBorder({
      workCanton: "FR",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 2,
    });
    const withoutChildren = computeCrossBorder({
      workCanton: "FR",
      grossAnnualSalary: 60_000,
      status: "single",
      children: 0,
    });
    expect(withChildren.swissTax).toBe(withoutChildren.swissTax);
  });
});

describe("computeCrossBorder — couples : enfants dans le barème B/C d'office", () => {
  it("marié, un revenu, 2 enfants à Genève : barème B2, inférieur à B0, sans note de rectification", () => {
    const base = { workCanton: "GE", grossAnnualSalary: 120_000, status: "married" as const };
    const b0 = computeCrossBorder({ ...base, children: 0 });
    const b2 = computeCrossBorder({ ...base, children: 2 });
    expect(b2.swissTax).toBeLessThan(b0.swissTax);
    expect(b2.swissTax).toBeGreaterThan(0);
    expect(b2.notes.some((n) => n.includes("rectification"))).toBe(false);
  });

  it("marié, deux revenus, 1 enfant à Fribourg : barème C1, inférieur à C0", () => {
    const base = {
      workCanton: "FR",
      grossAnnualSalary: 100_000,
      status: "married" as const,
      spouseEmployed: true,
    };
    const c0 = computeCrossBorder({ ...base, children: 0 });
    const c1 = computeCrossBorder({ ...base, children: 1 });
    expect(c1.swissTax).toBeLessThan(c0.swissTax);
  });
});
