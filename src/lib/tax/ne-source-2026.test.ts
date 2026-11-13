import { describe, expect, it } from "vitest";
import { officialSourceRate } from "./source-tables";
import { computeSourceTax } from "./source";

// Taux lus dans le barème officiel neuchâtelois 2026 (ne.ch), tranche
// mensuelle de 50 CHF se terminant au salaire indiqué.
// Colonnes : A0, B0, B1, B2, C0, C1, C2, H1, H2.
const CODES = ["A0", "B0", "B1", "B2", "C0", "C1", "C2", "H1", "H2"];
const OFFICIAL: Record<number, number[]> = {
  5_000: [11.05, 4.29, 1.76, 0.29, 11.38, 9.24, 7.41, 1.76, 0.29],
  8_000: [15.43, 10.92, 8.3, 6.07, 14.96, 13.39, 11.86, 8.56, 6.16],
  10_000: [17.77, 13.04, 10.83, 8.7, 16.59, 15.2, 13.85, 11.21, 9.01],
  12_500: [20.28, 15.25, 13.34, 11.48, 18.7, 17.36, 16.11, 13.85, 11.96],
  15_000: [22.55, 17.44, 15.69, 14.0, 20.92, 19.75, 18.56, 16.24, 14.52],
  20_000: [26.18, 21.8, 20.28, 18.75, 24.22, 23.3, 22.38, 20.81, 19.29],
  30_000: [29.03, 26.93, 25.87, 24.81, 28.25, 27.63, 27.01, 26.24, 25.18],
};

describe("barème officiel de l'impôt à la source Neuchâtel 2026", () => {
  for (const [monthly, rates] of Object.entries(OFFICIAL)) {
    CODES.forEach((code, i) => {
      it(`${code} à ${monthly} CHF/mois → ${rates[i]} %`, () => {
        const mid = (Number(monthly) - 25) * 12;
        const r = officialSourceRate("NE", mid, code[0], Number(code.slice(1)));
        expect(r).not.toBeNull();
        expect(Math.abs((r as number) - rates[i])).toBeLessThan(0.06);
      });
    });
  }

  it("computeSourceTax NE : marié deux revenus, 1 enfant, 9'975 CHF/mois → C1 officiel (15.2 %)", () => {
    const r = computeSourceTax({ monthlyGross: 9_975, canton: "NE", scale: "C", children: 1 });
    expect(r.scaleUsed).toBe("C1");
    expect(r.rate).toBeCloseTo(15.2, 1);
  });
});
