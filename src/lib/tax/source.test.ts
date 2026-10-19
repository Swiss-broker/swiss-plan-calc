import { describe, expect, it } from "vitest";
import { computeSourceTax } from "./source";

// Vérifié contre les barèmes officiels B et C du canton du Jura, édition
// 2026 (jura.ch, Service de l'impôt à la source) — valeurs exactes lues
// dans les tranches "9'951 - 10'000", "7'951 - 8'000", etc.
//
// Barème par défaut appliqué par l'employeur = toujours "0 enfant" (B0/C0),
// jamais piloté automatiquement par le nombre d'enfants : la prise en
// compte d'un enfant à charge ne se fait qu'après une démarche de
// rectification l'année suivante (confirmé par Sarah) — même règle que
// pour GE (voir computeSourceTaxCore). Les sous-indices B1/B2/C1 ci-dessous
// ne s'obtiennent donc qu'avec useRectifiedScale: true (scénario "après
// rectification"), jamais par défaut.
describe("computeSourceTax JU — barèmes officiels B/C", () => {
  it("barème B, 0 enfant, 8'000 CHF/mois → 10.20 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B" });
    expect(r.rate).toBeCloseTo(10.2, 2);
  });

  it("barème B, 1 enfant SAISI mais sans rectification : reste sur B0 (10.20 %), pas B1", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B", children: 1 });
    expect(r.rate).toBeCloseTo(10.2, 2);
  });

  it("barème B, 1 enfant, après rectification, 8'000 CHF/mois → 8.21 %", () => {
    const r = computeSourceTax({
      monthlyGross: 8_000,
      canton: "JU",
      scale: "B",
      children: 1,
      useRectifiedScale: true,
    });
    expect(r.rate).toBeCloseTo(8.21, 2);
  });

  it("barème B, 2 enfants, après rectification, 10'000 CHF/mois → 8.89 %", () => {
    const r = computeSourceTax({
      monthlyGross: 10_000,
      canton: "JU",
      scale: "B",
      children: 2,
      useRectifiedScale: true,
    });
    expect(r.rate).toBeCloseTo(8.89, 2);
  });

  it("barème C, 0 enfant, 8'000 CHF/mois combiné → 14.39 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "C" });
    expect(r.rate).toBeCloseTo(14.39, 2);
  });

  it("barème C, 1 enfant, après rectification, 20'000 CHF/mois combiné → 22.48 %", () => {
    const r = computeSourceTax({
      monthlyGross: 20_000,
      canton: "JU",
      scale: "C",
      children: 1,
      useRectifiedScale: true,
    });
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

describe("computeSourceTax — approximation générique (VD/VS/FR/NE) : enfant ignoré par défaut (régression)", () => {
  it("barème B, VD, enfant saisi mais sans rectification : même taux qu'avec 0 enfant", () => {
    const withChild = computeSourceTax({
      monthlyGross: 8_000,
      canton: "VD",
      scale: "B",
      children: 2,
    });
    const withoutChild = computeSourceTax({ monthlyGross: 8_000, canton: "VD", scale: "B" });
    expect(withChild.rate).toBe(withoutChild.rate);
  });

  it("barème B, VD, après rectification : le taux baisse (enfant pris en compte)", () => {
    const rectified = computeSourceTax({
      monthlyGross: 8_000,
      canton: "VD",
      scale: "B",
      children: 2,
      useRectifiedScale: true,
    });
    const defaultScale = computeSourceTax({ monthlyGross: 8_000, canton: "VD", scale: "B" });
    expect(rectified.rate).toBeLessThan(defaultScale.rate);
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
