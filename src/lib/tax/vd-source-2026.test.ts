import { describe, expect, it } from "vitest";
import { officialSourceRate } from "./source-tables";
import { computeSourceTax } from "./source";
import { computeCrossBorder } from "./cross-border";

// Taux lus dans « Barèmes et instructions concernant l'imposition à la source
// pour l'année 2026 » (Administration cantonale des impôts, Vaud), tranche
// annuelle contenant le revenu indiqué.
const OFFICIAL: Record<number, Record<string, number>> = {
  60_000: { A0: 8.17, B0: 2.24, B1: 0.64, B2: 0.06, B3: 0, C0: 9.79, C1: 8.28, C2: 6.29, H1: 2.33, H2: 0.8 },
  96_000: { A0: 13.46, B0: 9.37, B1: 6.56, B2: 4.56, B3: 3.01, C0: 13.19, C1: 11.66, C2: 10.31, H1: 9.26, H2: 6.67 },
  120_000: { A0: 15.69, B0: 11.36, B1: 9.72, B2: 7.88, B3: 6.0, C0: 14.79, C1: 13.16, C2: 11.9, H1: 11.23, H2: 9.57 },
  150_000: { A0: 18.35, B0: 13.4, B1: 11.73, B2: 10.32, B3: 9.14, C0: 16.95, C1: 15.15, C2: 13.71, H1: 13.27, H2: 11.61 },
  200_000: { A0: 22.14, B0: 17.23, B1: 15.22, B2: 13.63, B3: 12.33, C0: 20.59, C1: 18.69, C2: 17.21, H1: 17.08, H2: 15.06 },
  300_000: { A0: 27.34, B0: 23.01, B1: 21.26, B2: 19.47, B3: 18.1, C0: 24.99, C1: 23.71, C2: 22.42, H1: 23.42, H2: 21.31 },
};

describe("barème officiel de l'impôt à la source Vaud 2026", () => {
  for (const [income, byCode] of Object.entries(OFFICIAL)) {
    for (const [code, rate] of Object.entries(byCode)) {
      it(`${code} à ${income} CHF/an → ${rate} %`, () => {
        // Milieu de la tranche officielle contenant ce revenu (tranches de
        // 600 CHF, puis de 6'000 CHF pour les hauts revenus).
        const mid = Number(income) - (Number(income) >= 300_000 ? 3_000 : 300);
        const r = officialSourceRate("VD", mid, code[0], Number(code.slice(1)));
        expect(r).not.toBeNull();
        expect(Math.abs((r as number) - rate)).toBeLessThan(0.06);
      });
    }
  }

  it("sous le premier palier : aucun impôt", () => {
    expect(officialSourceRate("VD", 20_000, "A", 0)).toBe(0);
    expect(officialSourceRate("VD", 40_000, "B", 0)).toBe(0);
  });

  it("computeSourceTax VD : 7'975 CHF/mois, marié un revenu, 1 enfant → B1 officiel (6.56 %), sans supplément selon la confession", () => {
    const r = computeSourceTax({ monthlyGross: 7_975, canton: "VD", scale: "B", children: 1 });
    const withChurch = computeSourceTax({ monthlyGross: 7_975, canton: "VD", scale: "B", children: 1, church: true });
    expect(r.scaleUsed).toBe("B1");
    expect(r.rate).toBeCloseTo(6.56, 1);
    expect(withChurch.rate).toBe(r.rate);
  });

  it("frontalier France travaillant dans le canton de Vaud : toujours imposé en France (accord de 1983)", () => {
    const r = computeCrossBorder({ workCanton: "VD", grossAnnualSalary: 96_000, status: "single" });
    expect(r.swissTax).toBe(0);
  });
});
