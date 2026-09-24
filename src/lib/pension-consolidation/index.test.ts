import { describe, expect, it } from "vitest";
import {
  consolidatePensionBenefits,
  consolidateOptimizedBenefits,
  getConsolidatedCapitals,
  type ConsolidationReferenceSimulations,
} from "./index";
import type { ClientBundle } from "@/lib/client-dashboard";
import type { Client, ClientPension } from "@/lib/clients/types";
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";

function makeBundle(overrides: {
  client?: Partial<Client>;
  pension?: Partial<ClientPension> | null;
}): ClientBundle {
  const client = {
    id: "test",
    first_name: "T",
    last_name: "EST",
    civil_status: "single",
    confession: "none",
    permit: "swiss",
    tax_status: "resident",
    work_status: "employee",
    canton: "VD",
    date_of_birth: "1985-01-01",
    gross_annual_salary: 100_000,
    bonus: 0,
    other_income: 0,
    children: [],
    archived: false,
    tax_status_migrated: true,
    activity_rate: 100,
    broker_id: "b",
    created_at: "",
    updated_at: "",
    ...overrides.client,
  } as unknown as Client;

  const pension =
    overrides.pension === null
      ? null
      : ({
          id: "p",
          client_id: "test",
          broker_id: "b",
          lpp_current_balance: 100_000,
          lpp_insured_salary: 90_000,
          lpp_max_buyback: 0,
          lpp_plan: "mandatory",
          lpp_buybacks_done: [],
          lpp_early_withdrawals: [],
          vested_benefits_accounts: [],
          pillar_3a_accounts: [],
          pillar_3a_annual_contribution: 0,
          pillar_3b_accounts: [],
          spouse_lpp_balance: 0,
          spouse_pillar_3a_balance: 0,
          lpp_coordination_deduction: 0,
          created_at: "",
          updated_at: "",
          ...(overrides.pension ?? {}),
        } as unknown as ClientPension);

  return { client, pension, assets: null };
}

function makeEntry(kind: SimulationKind, summary: Record<string, unknown>): HistoryEntry {
  return {
    id: `entry-${kind}`,
    broker_id: "b",
    client_id: "test",
    kind,
    title: kind,
    note: null,
    inputs: {},
    summary,
    tags: [],
    is_baseline: false,
    gain_dismissed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("consolidatePensionBenefits — priorité des sources (certificat > simulation > estimation)", () => {
  it("vieillesse : utilise la rente LPP du certificat si présente, jamais l'estimation live", () => {
    const b = makeBundle({});
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", {
        projectedBalance: 200_000,
        annualPension: 12_000,
        certificateAnnualPensions: { oldAge: 9_999 },
      }),
    };
    const result = consolidatePensionBenefits(b, refs);
    const lppItem = result.retirement?.pillar2.items.find((i) => i.pillar === "LPP");
    expect(lppItem?.annual).toBe(9_999);
    expect(lppItem?.label).toContain("certificat");
  });

  it("vieillesse : sans certificat, utilise la rente de la simulation LPP sauvegardée", () => {
    const b = makeBundle({});
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", { projectedBalance: 200_000, annualPension: 12_000 }),
    };
    const result = consolidatePensionBenefits(b, refs);
    const lppItem = result.retirement?.pillar2.items.find((i) => i.pillar === "LPP");
    expect(lppItem?.annual).toBe(12_000);
    expect(result.retirement?.notes.some((n) => n.includes("Rente LPP estimée"))).toBe(false);
  });

  it("vieillesse : sans simulation ni certificat, retombe sur l'estimation live et le signale dans les notes", () => {
    const b = makeBundle({});
    const result = consolidatePensionBenefits(b, {});
    expect(result.retirement?.notes.some((n) => n.includes("Rente LPP estimée"))).toBe(true);
  });

  it("vieillesse : 3e pilier reprend exactement capital ÷ 25 ÷ 12 × 12 de la simulation sauvegardée", () => {
    const b = makeBundle({});
    const refs: ConsolidationReferenceSimulations = {
      pillar3a: makeEntry("pillar3a", { finalBalance: 600_000, oldAgeMonthlyPension: 2_000 }),
    };
    const result = consolidatePensionBenefits(b, refs);
    const p3aItem = result.retirement?.pillar2.items.find((i) => i.pillar === "3A");
    expect(p3aItem?.annual).toBe(24_000);
    expect(p3aItem?.monthly).toBe(2_000);
  });

  it("invalidité : ajoute la rente d'invalidité 3e pilier saisie manuellement, sans jamais la recalculer", () => {
    const b = makeBundle({});
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", { projectedBalance: 200_000, annualPension: 12_000 }),
      pillar3a: makeEntry("pillar3a", { finalBalance: 100_000, disabilityAnnualPension: 15_000 }),
    };
    const current = consolidatePensionBenefits(b, refs);
    const optimized = consolidateOptimizedBenefits(b, refs);
    const currentP3a = current.disability?.pillar2.items.find((i) => i.pillar === "3A");
    const optimizedP3a = optimized.disability?.pillar2.items.find((i) => i.pillar === "3A");
    expect(currentP3a?.annual).toBe(15_000);
    // Jamais extrapolée vers le scénario optimisé (saisie manuelle, police figée).
    expect(optimizedP3a?.annual).toBe(15_000);
  });

  it("décès : rente de veuf/veuve du certificat sans montant d'orphelin dédié -> l'orphelin retombe sur l'estimation live, pas 0 (régression)", () => {
    const b = makeBundle({
      client: {
        civil_status: "married",
        children: [{ first_name: "Léa", date_of_birth: "2015-01-01" }],
      },
    });
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", {
        projectedBalance: 200_000,
        annualPension: 12_000,
        certificateAnnualPensions: { widow: 8_000 }, // pas de "orphan" ici
      }),
    };
    const result = consolidatePensionBenefits(b, refs);
    const widowItem = result.death?.pillar2.items.find((i) => i.label.includes("survivant"));
    const orphanItem = result.death?.pillar2.items.find((i) => i.label.includes("orphelin"));
    expect(widowItem?.annual).toBe(8_000);
    expect(orphanItem).toBeDefined();
    expect(orphanItem!.annual).toBeGreaterThan(0);
  });

  it("décès optimisé : la rente de veuf/veuve du certificat n'est jamais extrapolée, mais la rente d'orphelin estimée l'est", () => {
    const b = makeBundle({
      client: {
        civil_status: "married",
        children: [{ first_name: "Léa", date_of_birth: "2015-01-01" }],
      },
      pension: { lpp_max_buyback: 50_000 },
    });
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", {
        projectedBalance: 200_000,
        annualPension: 12_000,
        certificateAnnualPensions: { widow: 8_000 },
      }),
    };
    const current = consolidatePensionBenefits(b, refs);
    const optimized = consolidateOptimizedBenefits(b, refs);
    const currentWidow = current.death?.pillar2.items.find((i) => i.label.includes("survivant"));
    const optimizedWidow = optimized.death?.pillar2.items.find((i) => i.label.includes("survivant"));
    expect(optimizedWidow?.annual).toBe(currentWidow?.annual);
    expect(optimizedWidow?.annual).toBe(8_000);
  });
});

describe("getConsolidatedCapitals — priorité simulation sauvegardée > estimation live", () => {
  it("utilise le capital de la simulation LPP sauvegardée quand elle existe", () => {
    const b = makeBundle({});
    const refs: ConsolidationReferenceSimulations = {
      lpp: makeEntry("lpp", { projectedBalance: 250_000, annualPension: 15_000, totalBuybacks: 20_000 }),
      pillar3a: makeEntry("pillar3a", { finalBalance: 90_000 }),
    };
    const capitals = getConsolidatedCapitals(b, refs);
    expect(capitals.lppProjectedCapital).toBe(250_000);
    expect(capitals.lppProjectedIsEstimate).toBe(false);
    expect(capitals.lppBuybacksTotal).toBe(20_000);
    expect(capitals.pillar3aProjectedCapital).toBe(90_000);
    expect(capitals.pillar3aProjectedIsEstimate).toBe(false);
  });

  it("signale une estimation quand aucune simulation n'est enregistrée", () => {
    const b = makeBundle({});
    const capitals = getConsolidatedCapitals(b, {});
    expect(capitals.lppProjectedIsEstimate).toBe(true);
    expect(capitals.pillar3aProjectedIsEstimate).toBe(true);
    expect(capitals.lppBuybacksTotal).toBe(0);
  });
});
