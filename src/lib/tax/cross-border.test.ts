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
    const [, a0Rate] = GE_IS_RATES_2026.A0.find(([income]) => income === 60_000)!;
    expect(withChild.swissTax).toBe(Math.round((60_000 * a0Rate) / 100));
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
