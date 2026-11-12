import { describe, expect, it } from "vitest";
import { computeSourceTax } from "./source";

// Vérifié contre les barèmes officiels B et C du canton du Jura, édition
// 2026 (jura.ch, Service de l'impôt à la source) — valeurs exactes lues
// dans les tranches "9'951 - 10'000", "7'951 - 8'000", etc.
//
// Barèmes B et C : le sous-indice suit d'office le nombre d'enfants à charge
// (B1, C2…), d'après la déclaration du salarié à son employeur. Seul le
// barème A ignore les enfants (A0), le barème H s'obtenant par rectification.
describe("computeSourceTax JU — barèmes officiels B/C", () => {
  it("barème B, 0 enfant, 8'000 CHF/mois → 10.20 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B" });
    expect(r.rate).toBeCloseTo(10.2, 2);
  });

  it("barème B, 1 enfant, 8'000 CHF/mois → B1 d'office : 8.21 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "B", children: 1 });
    expect(r.rate).toBeCloseTo(8.21, 2);
    expect(r.scaleUsed).toBe("B1");
  });

  it("barème B, 2 enfants, 10'000 CHF/mois → B2 : 8.89 %", () => {
    const r = computeSourceTax({ monthlyGross: 10_000, canton: "JU", scale: "B", children: 2 });
    expect(r.rate).toBeCloseTo(8.89, 2);
  });

  it("barème B, 3 enfants : seuls B0 à B2 sont disponibles pour le Jura, le dernier (B2) s'applique", () => {
    const b2 = computeSourceTax({ monthlyGross: 10_000, canton: "JU", scale: "B", children: 2 });
    const b3 = computeSourceTax({ monthlyGross: 10_000, canton: "JU", scale: "B", children: 3 });
    expect(b3.rate).toBe(b2.rate);
  });

  it("barème C, 0 enfant, 8'000 CHF/mois → 14.39 %", () => {
    const r = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "C" });
    expect(r.rate).toBeCloseTo(14.39, 2);
  });

  it("barème C, 1 enfant, 20'000 CHF/mois → C1 : 22.48 %", () => {
    const r = computeSourceTax({ monthlyGross: 20_000, canton: "JU", scale: "C", children: 1 });
    expect(r.rate).toBeCloseTo(22.48, 2);
  });

  it("barème C : le taux se lit sur le salaire propre, le salaire du conjoint ne le change pas", () => {
    const alone = computeSourceTax({ monthlyGross: 8_000, canton: "JU", scale: "C" });
    const withSpouse = computeSourceTax({
      monthlyGross: 8_000,
      spouseMonthlyGross: 7_000,
      canton: "JU",
      scale: "C",
    });
    expect(withSpouse.rate).toBe(alone.rate);
    expect(withSpouse.rate).toBeCloseTo(14.39, 2);
    expect(withSpouse.monthlyTax).toBeCloseTo((8_000 * 14.39) / 100, 0);
  });

  it("revenu nul ou sous le premier palier → taux 0", () => {
    const r = computeSourceTax({ monthlyGross: 500, canton: "JU", scale: "B" });
    expect(r.rate).toBe(0);
  });

  it("barème A0, 8'000 CHF/mois → barème officiel jurassien 2026 (15.25 %)", () => {
    const r = computeSourceTax({ monthlyGross: 7_975, canton: "JU", scale: "A" });
    expect(r.rate).toBeCloseTo(15.25, 1);
  });
});

describe("computeSourceTax — enfants à charge", () => {
  it("barème B, VD : les enfants réduisent le taux d'office", () => {
    const withChildren = computeSourceTax({ monthlyGross: 8_000, canton: "VD", scale: "B", children: 2 });
    const without = computeSourceTax({ monthlyGross: 8_000, canton: "VD", scale: "B" });
    expect(withChildren.rate).toBeLessThan(without.rate);
    expect(withChildren.scaleUsed).toBe("B2");
  });

  it("barème A : toujours A0, les enfants ne changent rien sans rectification vers H", () => {
    for (const canton of ["GE", "VD", "JU"]) {
      const withChild = computeSourceTax({ monthlyGross: 7_000, canton, scale: "A", children: 2 });
      const without = computeSourceTax({ monthlyGross: 7_000, canton, scale: "A" });
      expect(withChild.rate).toBe(without.rate);
      expect(withChild.scaleUsed).toBe("A0");
    }
  });

  it("barème H (après rectification) : inférieur au barème A0 pour le même salaire", () => {
    for (const canton of ["GE", "VD", "NE"]) {
      const a0 = computeSourceTax({ monthlyGross: 7_000, canton, scale: "A", children: 1 });
      const h1 = computeSourceTax({ monthlyGross: 7_000, canton, scale: "H", children: 1 });
      expect(h1.rate).toBeLessThan(a0.rate);
    }
  });

  it("Genève, barèmes B et C : taux décroissant avec le nombre d'enfants, jamais négatif", () => {
    for (const scale of ["B", "C"] as const) {
      for (const monthly of [6_000, 8_000, 10_000, 12_500, 16_000, 25_000]) {
        const rates = [0, 1, 2, 3, 4].map(
          (children) => computeSourceTax({ monthlyGross: monthly, canton: "GE", scale, children }).rate,
        );
        for (let i = 1; i < rates.length; i++) {
          expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
          expect(rates[i]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("barème C, cantons sans table propre : même logique que Genève, sur le salaire propre", () => {
    const ne = computeSourceTax({ monthlyGross: 9_000, spouseMonthlyGross: 9_000, canton: "NE", scale: "C" });
    const ge = computeSourceTax({ monthlyGross: 9_000, canton: "GE", scale: "C" });
    expect(ne.rate).toBeCloseTo(ge.rate * 0.98, 1);
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

  it("frontalier France sous l'accord de 1983 : aucune retenue suisse sur le salaire", () => {
    const r = computeSourceTax({
      monthlyGross: 5_000,
      canton: "VD",
      scale: "A",
      isCrossBorderFR: true,
    });
    expect(r.rate).toBe(0);
    expect(r.annualTax).toBe(0);
    expect(r.marginalRate).toBe(0);
  });

  it("frontalier France travaillant à Genève : barème genevois ordinaire, pas d'exonération", () => {
    const frontalier = computeSourceTax({
      monthlyGross: 5_000,
      canton: "GE",
      scale: "A",
      isCrossBorderFR: true,
    });
    const resident = computeSourceTax({ monthlyGross: 5_000, canton: "GE", scale: "A" });
    expect(frontalier.rate).toBe(resident.rate);
    expect(frontalier.rate).toBeGreaterThan(0);
  });
});
