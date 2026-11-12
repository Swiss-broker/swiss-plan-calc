import { describe, expect, it } from "vitest";
import { geSourceRate } from "./cross-border";
import { computeSourceTax } from "./source";

// Taux lus dans le document officiel « Barèmes 2026 impôt à la source »
// (République et canton de Genève, novembre 2025), tranche annuelle contenant
// le revenu indiqué.
const OFFICIAL: Record<number, Record<string, number>> = {
  60_000: { A0: 7.62, B0: 0.17, B1: 0, C0: 7.6, C1: 4.56, C2: 2.0, H1: 0 },
  96_000: { A0: 12.94, B0: 5.56, B1: 2.15, B2: 0, C0: 12.08, C1: 9.69, C2: 7.26, H1: 3.53, H2: 0.74 },
  120_000: { A0: 15.56, B0: 8.53, B1: 5.39, B2: 2.53, B3: 0.39, C0: 13.9, C1: 11.84, C2: 9.76, H1: 6.7, H2: 3.73 },
  150_000: { A0: 17.99, B0: 11.59, B1: 8.75, B2: 6.05, B3: 3.58, C0: 16.11, C1: 14.13, C2: 12.32, H1: 10.01, H2: 7.22 },
  200_000: { A0: 21.37, B0: 15.72, B1: 13.31, B2: 11.0, B3: 8.76, C0: 19.51, C1: 17.99, C2: 16.43, H1: 14.42, H2: 12.04 },
  300_000: { A0: 26.0, B0: 21.57, B1: 19.88, B2: 18.18, B3: 16.49, C0: 23.64, C1: 22.58, C2: 21.5, H1: 20.66, H2: 18.97 },
};

describe("barème officiel de l'impôt à la source Genève 2026", () => {
  for (const [income, byCode] of Object.entries(OFFICIAL)) {
    for (const [code, rate] of Object.entries(byCode)) {
      it(`${code} à ${income} CHF/an → ${rate} %`, () => {
        const r = geSourceRate(Number(income), code[0], Number(code.slice(1)));
        expect(Math.abs(r - rate)).toBeLessThan(0.05);
      });
    }
  }

  it("computeSourceTax : 10'000 CHF/mois, marié un revenu, 2 enfants → barème B2 officiel (2.53 %)", () => {
    const r = computeSourceTax({ monthlyGross: 10_000, canton: "GE", scale: "B", children: 2 });
    expect(r.scaleUsed).toBe("B2");
    expect(r.rate).toBeCloseTo(2.53, 1);
  });

  it("barème H sans enfant : n'existe pas, retombe sur A0", () => {
    expect(geSourceRate(120_000, "H", 0)).toBe(geSourceRate(120_000, "A", 0));
  });
});
