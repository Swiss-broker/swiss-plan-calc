import { describe, expect, it } from "vitest";
import { officialSourceRate } from "./source-tables";
import { computeSourceTax } from "./source";
import { computeCrossBorder } from "./cross-border";

// Taux lus dans les barèmes officiels 2026 du canton de Fribourg (A, B, C,
// H), tranche annuelle se terminant au revenu indiqué.
const OFFICIAL: Record<number, Record<string, number>> = {
  50_000: { A0: 8.65, B0: 4.38, B2: 0.37, B3: 0, C0: 8.42, C3: 2.25, H1: 1.83, H2: 0.43, H3: 0 },
  100_000: { A0: 14.97, B0: 9.97, B2: 5.59, B3: 3.7, C0: 13.71, C3: 8.95, H1: 8.37, H2: 5.98, H3: 4.05 },
  150_000: { A0: 18.9, B0: 13.67, B2: 10.37, B3: 8.53, C0: 17.29, C3: 13.5, H1: 12.58, H2: 10.95, H3: 9.13 },
  200_000: { A0: 22.83, B0: 17.49, B2: 14.19, B3: 12.58, C0: 20.67, C3: 17.51, H1: 16.72, H2: 15.04, H3: 13.37 },
};

describe("barème officiel de l'impôt à la source Fribourg 2026", () => {
  for (const [income, byCode] of Object.entries(OFFICIAL)) {
    for (const [code, rate] of Object.entries(byCode)) {
      it(`${code} à ${income} CHF/an → ${rate} %`, () => {
        // Milieu de la tranche de 600 CHF contenant ce revenu.
        const mid = Math.floor((Number(income) - 1) / 600) * 600 + 300;
        const r = officialSourceRate("FR", mid, code[0], Number(code.slice(1)));
        expect(r).not.toBeNull();
        expect(Math.abs((r as number) - rate)).toBeLessThan(0.06);
      });
    }
  }

  it("résident imposé à la source et frontalier : même impôt pour le même salaire à Fribourg", () => {
    const resident = computeSourceTax({ monthlyGross: 8_000, canton: "FR", scale: "B", children: 2 });
    const frontalier = computeCrossBorder({
      workCanton: "FR",
      grossAnnualSalary: 96_000,
      status: "married",
      children: 2,
    });
    expect(Math.abs(resident.annualTax - frontalier.swissTax)).toBeLessThan(2);
  });

  it("taux croissant avec le revenu jusqu'à 300'000 CHF, puis constant", () => {
    const at = (x: number) => officialSourceRate("FR", x, "A", 0) as number;
    expect(at(249_000)).toBeLessThan(at(280_000));
    expect(at(300_000)).toBeCloseTo(27.05, 2);
    expect(at(400_000)).toBe(at(300_000));
  });
});
