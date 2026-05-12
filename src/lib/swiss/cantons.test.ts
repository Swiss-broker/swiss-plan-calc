/**
 * Tests garde-fous · scope V1 Suisse romande
 *
 * Format vitest. Pour exécuter : `bunx vitest run src/lib/swiss/cantons.test.ts`
 * (vitest n'est pas installé par défaut · voir docs/SCOPE.md).
 *
 * Ces tests vérifient les invariants critiques de la restriction de scope :
 * 1. La cohérence flags ↔ codes typés (déjà assertée au boot, doublée ici).
 * 2. Le contenu exact du périmètre romand v1 (régression).
 * 3. Le comparateur peut calculer pour ZG (bug bloquant historique).
 * 4. Les barèmes sont chargés pour tous les cantons `comparable`.
 */

import { describe, it, expect } from "vitest";
import {
  CANTONS,
  COMPARABLE_CANTON_CODES,
  SELECTABLE_CANTON_CODES,
  getComparableCantons,
  getSelectableCantons,
  isComparableCanton,
  isSelectableCanton,
} from "./cantons";
import { CANTON_SCALES } from "../tax/cantons";
import { computeIncomeTax } from "../tax/income";

describe("Scope V1 · invariants cantons romands", () => {
  it("expose exactement 6 cantons sélectionnables (Suisse romande)", () => {
    expect([...SELECTABLE_CANTON_CODES].sort()).toEqual(
      ["FR", "GE", "JU", "NE", "VD", "VS"].sort(),
    );
    expect(getSelectableCantons()).toHaveLength(6);
  });

  it("expose exactement 7 cantons comparables (romands + ZG)", () => {
    expect([...COMPARABLE_CANTON_CODES].sort()).toEqual(
      ["FR", "GE", "JU", "NE", "VD", "VS", "ZG"].sort(),
    );
    expect(getComparableCantons()).toHaveLength(7);
  });

  it("ZG est comparable mais PAS sélectable (référence uniquement)", () => {
    expect(isComparableCanton("ZG")).toBe(true);
    expect(isSelectableCanton("ZG")).toBe(false);
  });

  it("aucun canton hors scope ne fuite dans selectable/comparable", () => {
    const outOfScope = ["ZH", "BS", "BE", "SZ", "TI", "AG", "LU", "GR"];
    for (const c of outOfScope) {
      expect(isSelectableCanton(c)).toBe(false);
      expect(isComparableCanton(c)).toBe(false);
    }
  });

  it("invariant : flags CANTONS ↔ tableaux figés synchronisés", () => {
    const selectableFromFlags = CANTONS.filter((c) => c.selectable).map((c) => c.code).sort();
    const selectableFromCodes = [...SELECTABLE_CANTON_CODES].sort();
    expect(selectableFromFlags).toEqual(selectableFromCodes);

    const comparableFromFlags = CANTONS.filter((c) => c.comparable).map((c) => c.code).sort();
    const comparableFromCodes = [...COMPARABLE_CANTON_CODES].sort();
    expect(comparableFromFlags).toEqual(comparableFromCodes);
  });

  it("CANTON_SCALES contient au minimum tous les cantons comparables", () => {
    for (const code of COMPARABLE_CANTON_CODES) {
      expect(CANTON_SCALES[code]).toBeDefined();
    }
  });
});

describe("Fixtures fiscales · profil 120k single, sans enfant, sans fortune", () => {
  const baseInput = {
    status: "single" as const,
    children: 0,
    grossSalary: 120_000,
    spouseGrossSalary: 0,
    netWealth: 0,
  };

  it.each(["GE", "VD", "VS", "FR", "NE", "JU"])(
    "calcule un impôt > 0 pour %s",
    (canton: string) => {
      const r = computeIncomeTax({ canton, ...baseInput });
      expect(r.totalTax).toBeGreaterThan(0);
      expect(r.effectiveRate).toBeGreaterThan(0);
      expect(r.effectiveRate).toBeLessThan(50); // sanity check
    },
  );

  it("ZG est calculable dans le comparateur (régression bug bloquant)", () => {
    const r = computeIncomeTax({ canton: "ZG", ...baseInput });
    expect(r.totalTax).toBeGreaterThan(0);
    expect(r.effectiveRate).toBeGreaterThan(0);
    // ZG doit être moins cher que la plupart des romands (référence fiscalité optimisée)
    const vd = computeIncomeTax({ canton: "VD", ...baseInput });
    expect(r.totalTax).toBeLessThan(vd.totalTax);
  });

  it("itère sur getComparableCantons() sans crasher (cas comparateur)", () => {
    const results = getComparableCantons().map((c) =>
      computeIncomeTax({ canton: c.code, ...baseInput }),
    );
    expect(results).toHaveLength(7);
    expect(results.every((r) => r.totalTax > 0)).toBe(true);
  });
});
