import { describe, expect, it } from "vitest";
import { officialSourceRate } from "./source-tables";
import { computeSourceTax } from "./source";

const MONTHLY = [5_000, 8_000, 10_000, 12_500, 20_000];

// Jura, édition 2026 (tranches de 50 CHF/mois se terminant au salaire indiqué).
const JU: Record<string, number[]> = {
  A0: [10.96, 15.25, 17.43, 20.08, 25.33],
  H1: [4.42, 9.02, 11.27, 13.88, 20.06],
  H2: [2.58, 7.24, 9.64, 12.36, 18.87],
  H3: [0.79, 5.32, 7.77, 10.52, 17.46],
};
// Jura B et C, édition 2026.
const JU_BC: Record<string, number[]> = {
  B0: [5.85, 10.2, 12.12, 14.56, 20.55],
  B3: [0.43, 4.73, 7.15, 9.67, 16.76],
  C0: [10.71, 14.39, 16.06, 17.98, 23.26],
  C3: [6.29, 10.39, 12.6, 14.81, 20.73],
};
// Valais, édition 2026 (tranches de 100 CHF/mois se terminant au salaire indiqué).
const VS: Record<string, number[]> = {
  A0: [7.38, 11.88, 14.62, 17.81, 24.94],
  B0: [3.82, 7.04, 8.84, 10.99, 19.73],
  B2: [0, 2.94, 4.78, 7.22, 16.17],
  C0: [8.37, 12.62, 14.66, 17.49, 23.1],
  C1: [6.08, 10.71, 12.91, 15.66, 22.14],
  C2: [4.07, 8.91, 11.23, 13.98, 21.17],
  H1: [1.53, 5.43, 7.42, 9.68, 18.64],
  H2: [0.06, 3.43, 5.38, 7.81, 16.85],
};

function check(canton: string, table: Record<string, number[]>, halfBracket: number) {
  for (const [code, rates] of Object.entries(table)) {
    MONTHLY.forEach((monthly, i) => {
      it(`${canton} ${code} à ${monthly} CHF/mois → ${rates[i]} %`, () => {
        const mid = (monthly - halfBracket) * 12;
        const r = officialSourceRate(canton, mid, code[0], Number(code.slice(1)));
        expect(r).not.toBeNull();
        expect(Math.abs((r as number) - rates[i])).toBeLessThan(0.06);
      });
    });
  }
}

describe("barème officiel de l'impôt à la source Jura 2026", () => {
  check("JU", JU, 25);
  check("JU", JU_BC, 25);
});

describe("barème officiel de l'impôt à la source Valais 2026", () => {
  check("VS", VS, 50);

  it("les six cantons romands ont un barème officiel pour A, B, C et H", () => {
    for (const canton of ["GE", "VD", "VS", "FR", "NE", "JU"]) {
      for (const [letter, children] of [["A", 0], ["B", 1], ["C", 2], ["H", 1]] as const) {
        expect(officialSourceRate(canton, 120_000, letter, children)).not.toBeNull();
      }
    }
    expect(computeSourceTax({ monthlyGross: 10_000, canton: "VS", scale: "C" }).rate).toBeCloseTo(14.66, 0);
  });
});
