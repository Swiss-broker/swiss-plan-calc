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
// Valais, édition 2025 (tranches de 100 CHF/mois se terminant au salaire indiqué).
const VS: Record<string, number[]> = {
  A0: [7.62, 12.39, 15.12, 18.35, 25.19],
  B0: [4.05, 7.39, 9.18, 11.36, 20.0],
  B1: [0.86, 5.03, 7.08, 9.37, 18.23],
  B2: [0, 3.12, 5.08, 7.53, 16.44],
  B3: [0, 1.29, 3.24, 5.64, 14.51],
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

describe("barème officiel de l'impôt à la source Jura 2026 (A0, H1-H8)", () => {
  check("JU", JU, 25);
});

describe("barème officiel de l'impôt à la source Valais (A, B — édition 2025)", () => {
  check("VS", VS, 50);

  it("barèmes C et H valaisans : pas de document, approximation conservée (taux non nul)", () => {
    expect(officialSourceRate("VS", 120_000, "C", 0)).toBeNull();
    expect(officialSourceRate("VS", 120_000, "H", 1)).toBeNull();
    expect(computeSourceTax({ monthlyGross: 10_000, canton: "VS", scale: "C" }).rate).toBeGreaterThan(0);
    expect(computeSourceTax({ monthlyGross: 10_000, canton: "VS", scale: "H", children: 1 }).rate).toBeGreaterThan(0);
  });
});
