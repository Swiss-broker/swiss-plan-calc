import { describe, expect, it } from "vitest";
import { computeIFD } from "./ifd";

// Formulaire AFC 58c-2026 : [revenu imposable, impôt personne seule, impôt
// marié / famille monoparentale (null si non imprimé)].
const OFFICIAL: Array<[number, number, number | null]> = [
  [18_500, 25.41, null],
  [33_200, 138.6, 35],
  [43_500, 229.2, 138],
  [50_000, 400.8, 203],
  [58_000, 612.0, 329],
  [61_300, 710.01, 395],
  [75_000, 1_116.9, 806],
  [76_200, 1_152.5, 842],
  [79_100, 1_324.76, 929],
  [82_100, 1_502.95, 1_049],
  [94_900, 2_347.75, 1_561],
  [100_000, 2_684.35, 1_816],
  [108_900, 3_271.75, 2_263],
  [120_600, 4_301.35, 2_965],
  [130_500, 5_172.55, 3_658],
  [141_500, 6_140.55, 4_569],
  [150_400, 7_119.55, 5_452],
  [152_400, 7_339.55, 5_692],
  [185_100, 10_936.55, 9_943],
  [200_000, 12_903.35, 11_880],
  [300_000, 26_103.35, 24_880],
  [500_000, 52_503.35, 50_880],
  [793_900, 91_298.15, 89_087],
  [800_000, 92_000, 89_880],
  [941_300, 108_249.5, 108_249],
  [950_000, 109_250, 109_250],
];

describe("impôt fédéral direct 2026 — formulaire AFC 58c-2026", () => {
  it.each(OFFICIAL)("revenu imposable %i : seul %f, marié %s", (income, single, married) => {
    expect(Math.abs(computeIFD(income, "single") - single)).toBeLessThan(0.5);
    if (married !== null) {
      expect(Math.abs(computeIFD(income, "married") - married)).toBeLessThan(0.6);
    }
  });
});
