import { describe, it, expect } from "vitest";
import {
  RDV_MIN_CENTIMES,
  computeCommissionCentimes,
  computeBrokerNetCentimes,
  computeCommissionBreakdown,
} from "./commission.ts";

// Montants en CHF → centimes, commission attendue (centimes), net attendu
// (centimes). Reprend exactement le tableau de cas de test obligatoires.
const CASES: Array<{ chf: number; commissionChf: number; netChf: number }> = [
  { chf: 150, commissionChf: 45, netChf: 105 },
  { chf: 500, commissionChf: 150, netChf: 350 },
  { chf: 1000, commissionChf: 300, netChf: 700 },
  { chf: 1000.01, commissionChf: 300, netChf: 700.01 },
  { chf: 1500, commissionChf: 400, netChf: 1100 },
  { chf: 2000, commissionChf: 500, netChf: 1500 },
  { chf: 2500, commissionChf: 550, netChf: 1950 },
  { chf: 3000, commissionChf: 600, netChf: 2400 },
  { chf: 5000, commissionChf: 800, netChf: 4200 },
];

function toCentimes(chf: number): number {
  return Math.round(chf * 100);
}

describe("computeCommissionCentimes", () => {
  it.each(CASES)("$chf CHF → commission $commissionChf CHF", ({ chf, commissionChf }) => {
    expect(computeCommissionCentimes(toCentimes(chf))).toBe(toCentimes(commissionChf));
  });

  it("rejette un montant sous le minimum avant même le calcul (149.99 CHF n'est pas testé ici : le refus est de la responsabilité de l'appelant, RDV_MIN_CENTIMES l'expose)", () => {
    expect(RDV_MIN_CENTIMES).toBe(15_000);
    expect(toCentimes(149.99)).toBeLessThan(RDV_MIN_CENTIMES);
  });

  it("rejette un montant non entier ou négatif", () => {
    expect(() => computeCommissionCentimes(100.5)).toThrow();
    expect(() => computeCommissionCentimes(-100)).toThrow();
  });

  it("montant nul → commission nulle", () => {
    expect(computeCommissionCentimes(0)).toBe(0);
  });
});

describe("computeBrokerNetCentimes", () => {
  it.each(CASES)("$chf CHF → le courtier reçoit $netChf CHF", ({ chf, netChf }) => {
    expect(computeBrokerNetCentimes(toCentimes(chf))).toBe(toCentimes(netChf));
  });

  it("commission + net = montant total, pour chaque cas", () => {
    for (const { chf } of CASES) {
      const amount = toCentimes(chf);
      expect(computeCommissionCentimes(amount) + computeBrokerNetCentimes(amount)).toBe(amount);
    }
  });
});

describe("computeCommissionBreakdown", () => {
  it("la somme des tranches affichées égale exactement la commission totale, pour chaque cas", () => {
    for (const { chf } of CASES) {
      const amount = toCentimes(chf);
      const breakdown = computeCommissionBreakdown(amount);
      const sum = breakdown.reduce((s, b) => s + b.commissionCentimes, 0);
      expect(sum).toBe(computeCommissionCentimes(amount));
    }
  });

  it("2500 CHF se décompose en 300 + 200 + 50 CHF de commission par tranche", () => {
    const breakdown = computeCommissionBreakdown(toCentimes(2500));
    expect(breakdown.map((b) => b.commissionCentimes)).toEqual([30_000, 20_000, 5_000]);
    expect(breakdown.map((b) => b.portionCentimes)).toEqual([100_000, 100_000, 50_000]);
  });

  it("150 CHF (sous la 1ère tranche) ne touche que la tranche à 30%", () => {
    const breakdown = computeCommissionBreakdown(toCentimes(150));
    expect(breakdown.map((b) => b.commissionCentimes)).toEqual([4_500, 0, 0]);
  });
});

describe("propriété : la commission ne diminue jamais quand le montant augmente", () => {
  it("sur un balayage dense incluant les bornes de tranches (100'000 et 200'000 centimes)", () => {
    const sampledPoints = [
      0, 1, 14_999, 15_000, 50_000, 99_999, 100_000, 100_001, 150_000, 199_999, 200_000, 200_001,
      300_000, 500_000, 1_000_000, 5_000_000, 50_000_000,
    ];
    let previous = -1;
    for (const amount of sampledPoints) {
      const commission = computeCommissionCentimes(amount);
      expect(commission).toBeGreaterThanOrEqual(previous);
      previous = commission;
    }
  });

  it("sur un pas de 1 centime autour de chaque borne de tranche (effet de seuil)", () => {
    for (const boundary of [100_000, 200_000]) {
      const before = computeCommissionCentimes(boundary - 1);
      const at = computeCommissionCentimes(boundary);
      const after = computeCommissionCentimes(boundary + 1);
      expect(at).toBeGreaterThanOrEqual(before);
      expect(after).toBeGreaterThanOrEqual(at);
    }
  });

  it("sur 10'000 montants aléatoires croissants", () => {
    const amounts = Array.from({ length: 10_000 }, () => Math.floor(Math.random() * 10_000_000));
    amounts.sort((a, b) => a - b);
    let previous = 0;
    for (const amount of amounts) {
      const commission = computeCommissionCentimes(amount);
      expect(commission).toBeGreaterThanOrEqual(previous);
      previous = commission;
    }
  });
});
