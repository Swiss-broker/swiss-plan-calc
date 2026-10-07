import { describe, expect, it } from "vitest";
import { computeBudget, computeBudgetTotals } from "./budget";
import type { HistoryEntry } from "@/lib/history/types";

const BASE_INPUT = {
  netSalaryMonthlyCHF: 6_000,
  spouseNetSalaryMonthlyCHF: 0,
  rentalIncomeMonthlyCHF: 0,
  otherIncomeMonthlyCHF: 0,
  housingMonthlyCHF: 1_800,
  energyMonthlyCHF: 200,
  foodMonthlyCHF: 700,
  healthInsuranceMonthlyCHF: 400,
  otherInsuranceMonthlyCHF: 100,
  transportMonthlyCHF: 300,
  subscriptionsLeisureMonthlyCHF: 150,
  childcareMonthlyCHF: 0,
  taxesMonthlyCHF: 400,
  loansMonthlyCHF: 0,
  alimonyPaidMonthlyCHF: 0,
  savingsMonthlyCHF: 200,
  otherExpensesMonthlyCHF: 500,
};

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    broker_id: "broker-1",
    client_id: "client-1",
    case_id: "case-1",
    kind: "pillar3a",
    title: "Test",
    note: null,
    inputs: {},
    summary: {},
    tags: [],
    is_baseline: false,
    gain_dismissed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeBudgetTotals — budget actuel", () => {
  it("revenus − charges = marge actuelle", () => {
    const result = computeBudgetTotals(BASE_INPUT);
    expect(result.totalMonthlyIncomeCHF).toBe(6_000);
    expect(result.totalMonthlyExpensesCHF).toBe(4_750);
    expect(result.currentMarginCHF).toBe(1_250);
  });
});

describe("computeBudget — budget optimisé", () => {
  it("sans aucune simulation sauvegardée : budget optimisé = budget actuel", () => {
    const result = computeBudget(BASE_INPUT, []);
    expect(result.optimizations).toEqual([]);
    expect(result.optimizedMarginCHF).toBe(result.currentMarginCHF);
  });

  it("agrège les gains 'annual' mensualisés de plusieurs calculateurs du dossier", () => {
    const entries: HistoryEntry[] = [
      entry({ kind: "pillar3a", summary: { taxSavings: 1_200 }, inputs: { contribution: 7_000 } }),
      entry({ kind: "health_insurance_resident", summary: { annualSavingsCHF: 600 } }),
    ];
    const result = computeBudget(BASE_INPUT, entries);
    expect(result.optimizations).toHaveLength(2);
    expect(result.totalMonthlyOptimizationCHF).toBeCloseTo(1_800 / 12, 6);
    expect(result.optimizedMarginCHF).toBeCloseTo(result.currentMarginCHF + 1_800 / 12, 6);
  });

  it("exclut les gains 'one_time' (ex. rachat LPP) du budget mensuel récurrent", () => {
    const entries: HistoryEntry[] = [
      entry({
        kind: "lpp",
        summary: { totalTaxSavings: 15_000 },
        inputs: { buybackCapacity: 50_000 },
      }),
    ];
    const result = computeBudget(BASE_INPUT, entries);
    expect(result.optimizations).toEqual([]);
    expect(result.optimizedMarginCHF).toBe(result.currentMarginCHF);
  });

  it("ignore les gains archivés (gain_dismissed)", () => {
    const entries: HistoryEntry[] = [
      entry({ kind: "pillar3a", summary: { taxSavings: 1_200 }, gain_dismissed: true }),
    ];
    const result = computeBudget(BASE_INPUT, entries);
    expect(result.optimizations).toEqual([]);
  });

  it("ne retient qu'une simulation par kind (la plus récente)", () => {
    const older = entry({
      kind: "pillar3a",
      summary: { taxSavings: 1_200 },
      created_at: "2026-01-01T00:00:00Z",
    });
    const newer = entry({
      kind: "pillar3a",
      summary: { taxSavings: 2_400 },
      created_at: "2026-06-01T00:00:00Z",
    });
    const result = computeBudget(BASE_INPUT, [older, newer]);
    expect(result.optimizations).toHaveLength(1);
    expect(result.optimizations[0].monthlyCHF).toBeCloseTo(2_400 / 12, 6);
  });
});
