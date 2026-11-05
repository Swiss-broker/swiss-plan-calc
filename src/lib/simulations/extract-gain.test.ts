import { describe, expect, it } from "vitest";
import { aggregateGains, projectGainTotal } from "./extract-gain";
import type { HistoryEntry } from "@/lib/history/types";

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

describe("projectGainTotal — horizon paramétrable", () => {
  it("cumule sur le nombre d'années fourni, pas un horizon fixe", () => {
    expect(projectGainTotal(1_000, 500, 20)).toBe(1_000 + 500 * 20);
    expect(projectGainTotal(1_000, 500, 3)).toBe(1_000 + 500 * 3);
  });

  it("retombe sur 10 ans seulement si years n'est pas fourni (repli, âge client inconnu)", () => {
    expect(projectGainTotal(1_000, 500)).toBe(1_000 + 500 * 10);
  });
});

describe("aggregateGains — gains pendant la vie active vs après la retraite", () => {
  it("cumule les gains annuels sur les VRAIES années jusqu'à la retraite, pas 10 ans fixe", () => {
    const entries = [
      entry({ kind: "pillar3a", summary: { taxSavings: 1_000 }, inputs: { contribution: 1 } }),
    ];
    // Client à 2 ans de la retraite : avant le correctif, le 3a (1'000 CHF/an)
    // aurait été compté sur 10 ans (10'000 CHF) au lieu de 2 (2'000 CHF).
    const agg = aggregateGains(entries, 2);
    expect(agg.totalAnnual).toBe(1_000);
    expect(agg.yearsToRetirement).toBe(2);
    expect(agg.preRetirementTotal).toBe(2_000);
    expect(agg.postRetirementGain).toBe(0);
    expect(agg.totalProjected).toBe(2_000);
  });

  it("sépare le gain 'Rente vs capital' (déjà cumulé sur l'espérance de vie résiduelle) du reste", () => {
    const entries = [
      entry({ kind: "pillar3a", summary: { taxSavings: 1_000 }, inputs: { contribution: 1 } }),
      entry({
        kind: "retirement",
        summary: { netAnnuity: 200_000, netLumpSum: 340_000, recommendation: "lump_sum" },
      }),
    ];
    const agg = aggregateGains(entries, 5);
    // Le gain "retirement" (140'000, déjà total sur l'espérance de vie
    // résiduelle réglée dans ce calculateur) ne doit PAS être multiplié par
    // yearsToRetirement, ni mélangé au total "pendant la vie active".
    expect(agg.postRetirementGain).toBe(140_000);
    expect(agg.preRetirementTotal).toBe(1_000 * 5);
    expect(agg.totalProjected).toBe(1_000 * 5 + 140_000);
    // totalOneTime (brut, non projeté) inclut bien les deux pour l'affichage
    // détaillé "Sous-total ponctuel".
    expect(agg.totalOneTime).toBe(140_000);
  });
});
