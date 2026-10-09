import { describe, it, expect } from "vitest";
import {
  RDV_MIN_CENTIMES,
  computeCommissionCentimes,
  computeBrokerNetCentimes,
} from "./commission";

// Vérifie seulement que le ré-export front résout vers le même module que
// les Edge Functions (supabase/functions/_shared/commission.ts) : le calcul
// lui-même est entièrement testé là-bas, pas besoin de le repasser ici.
describe("ré-export front du module de commission partagé", () => {
  it("expose les mêmes valeurs que le module partagé", () => {
    expect(RDV_MIN_CENTIMES).toBe(15_000);
    expect(computeCommissionCentimes(250_000)).toBe(55_000);
    expect(computeBrokerNetCentimes(250_000)).toBe(195_000);
  });
});
