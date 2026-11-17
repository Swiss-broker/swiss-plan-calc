import { describe, expect, it } from "vitest";
import { aggregateGains, extractGain, isRedundantGain, projectGainTotal, resolveYearsToRetirement } from "./extract-gain";
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

describe("aggregateGains — scénarios de Fiscal global", () => {
  it("un rachat LPP simulé dans Fiscal global est une économie ponctuelle, pas annuelle", () => {
    const entries = [
      entry({
        kind: "tax_global",
        summary: { bestScenarioSavings: 6_000, bestScenarioLabel: "+Rachat LPP 20'000 CHF" },
      }),
    ];
    const r = aggregateGains(entries, 25);
    expect(r.totalAnnual).toBe(0);
    expect(r.totalOneTime).toBe(6_000);
    expect(r.preRetirementTotal).toBe(6_000);
  });

  it("un don ou un changement de permis ne sont pas comptés comme un gain", () => {
    const don = aggregateGains(
      [entry({ kind: "tax_global", summary: { bestScenarioSavings: 1_500, bestScenarioId: "donation_5k" } })],
      10,
    );
    const permit = aggregateGains(
      [entry({ kind: "tax_global", summary: { bestScenarioSavings: 900, bestScenarioLabel: "Passage permis C" } })],
      10,
    );
    expect(don.items).toEqual([]);
    expect(permit.items).toEqual([]);
  });

  it("3a au plafond chiffré à la fois par Fiscal global et par le calculateur 3a : compté une seule fois", () => {
    const entries = [
      entry({ kind: "pillar3a", summary: { taxSavings: 2_000 }, inputs: { contribution: 7_258 } }),
      entry({
        kind: "tax_global",
        summary: { bestScenarioSavings: 2_100, bestScenarioId: "pillar3a_max", bestScenarioLabel: "+3a max (7'258 CHF)" },
      }),
    ];
    const r = aggregateGains(entries, 10);
    expect(r.items.map((i) => i.kind)).toEqual(["pillar3a"]);
    expect(r.totalAnnual).toBe(2_000);
  });

  it("sans calculateur 3a dédié, le scénario 3a de Fiscal global reste compté (annuel)", () => {
    const r = aggregateGains(
      [entry({ kind: "tax_global", summary: { bestScenarioSavings: 2_100, bestScenarioId: "pillar3a_max" } })],
      10,
    );
    expect(r.totalAnnual).toBe(2_100);
  });

  it("l'écart entre régimes frontaliers n'est pas un gain réalisable", () => {
    const r = aggregateGains(
      [entry({ kind: "cross_border", summary: { alternativeDelta: 4_000 } })],
      10,
    );
    expect(r.items).toEqual([]);
  });
});

describe("libre passage et comparateur d'investissements : même capital, compté une fois", () => {
  const mk = (kind: string, summary: Record<string, unknown>, inputs: Record<string, unknown> = {}) =>
    ({
      id: kind,
      kind,
      title: kind,
      summary,
      inputs,
      created_at: "2026-11-17T08:00:00Z",
      is_baseline: false,
      gain_dismissed: false,
    }) as unknown as HistoryEntry;
  const vested = mk("vested_benefits", { recommendedFinalBalance: 538_027, securityFinalBalance: 285_990, recommendedStrategy: "dynamic" });
  const invest = mk("investment_compare", { netDifference: 265_081, winner: "b" }, { a: { name: "Caisse de pension" }, b: { name: "Libre passage" } });

  it("seul le gain le plus élevé des deux est retenu", () => {
    const peers = [vested, invest];
    const gV = extractGain(vested);
    const gI = extractGain(invest);
    // Cas réel : 252'037 + 265'081 = 517'118 étaient additionnés.
    expect(gV.amount + gI.amount).toBe(517_118);
    expect(gI.amount).toBeGreaterThan(gV.amount);
    expect(isRedundantGain(invest, gI, peers)).toBe(false);
    expect(isRedundantGain(vested, gV, peers)).toBe(true);
  });

  it("seul, chacun reste compté", () => {
    expect(isRedundantGain(invest, extractGain(invest), [invest])).toBe(false);
    expect(isRedundantGain(vested, extractGain(vested), [vested])).toBe(false);
  });
});

describe("horizon jusqu'à la retraite : jamais un « 10 ans » inventé", () => {
  const sim = (inputs: Record<string, unknown>) =>
    ({ id: "s", kind: "vested_benefits", inputs, summary: {}, created_at: "2026-11-17T08:00:00Z" }) as unknown as HistoryEntry;
  const yearsBefore65 = (dob: string) => {
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return 65 - age;
  };

  it("avec date de naissance : 65 ans moins l'âge, quelles que soient les simulations", () => {
    expect(resolveYearsToRetirement("1981-03-14", "male", [sim({ yearsToRetirement: 18 })])).toBe(yearsBefore65("1981-03-14"));
    expect(resolveYearsToRetirement("1990-05-12", "female", [])).toBe(yearsBefore65("1990-05-12"));
  });

  it("femme née en 1962 : âge de référence AVS 21 (64,5 ans), au moins 1 an", () => {
    expect(resolveYearsToRetirement("1962-06-01", "female", [])).toBe(1);
  });

  it("sans date de naissance : durée saisie dans la simulation", () => {
    expect(resolveYearsToRetirement(null, "male", [sim({ yearsToRetirement: 18 })])).toBe(18);
    expect(resolveYearsToRetirement(null, null, [sim({ currentAge: 47, retirementAge: 65 })])).toBe(18);
  });

  it("sans aucune information : null, et les gains annuels ne sont pas cumulés", () => {
    expect(resolveYearsToRetirement(null, null, [sim({})])).toBeNull();
    const agg = aggregateGains([], null);
    expect(agg.yearsToRetirement).toBeNull();
  });
});
