import { describe, expect, it } from "vitest";
import { projectClientLPP, projectClient3a } from "./lpp-projection";
import type { ClientBundle } from "@/lib/clients/to-calculator-input";
import type { Client, ClientPension } from "@/lib/clients/types";

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
    gross_annual_salary: 120_000,
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

describe("projectClientLPP — déterminisme et cohérence", () => {
  it("retourne null si pas affilié et pas d'avoir", () => {
    const b = makeBundle({
      client: { work_status: "no_activity" },
      pension: { lpp_current_balance: 0 },
    });
    expect(projectClientLPP(b)).toBeNull();
  });

  it("est déterministe : 2 appels successifs donnent le même résultat", () => {
    const b = makeBundle({});
    const a = projectClientLPP(b);
    const c = projectClientLPP(b);
    expect(a).toEqual(c);
  });

  it("expose les hypothèses utilisées", () => {
    const r = projectClientLPP(makeBundle({}));
    expect(r?.assumptions.expectedReturnRate).toBe(1.5);
    expect(r?.assumptions.feeRate).toBe(0);
    expect(r?.assumptions.salaryGrowthRate).toBe(1);
    expect(r?.assumptions.retirementAge).toBe(65);
  });

  it("au-delà de 65 ans : pas de projection, capital actuel uniquement", () => {
    const r = projectClientLPP(
      makeBundle({
        client: { date_of_birth: "1955-01-01" },
        pension: { lpp_current_balance: 500_000 },
      }),
    );
    expect(r?.projectedCapitalAt65).toBe(500_000);
    expect(r?.annualPension).toBeGreaterThan(0);
  });

  it("inclut le solde courant dans la projection", () => {
    const withBalance = projectClientLPP(
      makeBundle({ pension: { lpp_current_balance: 200_000 } }),
    );
    const withoutBalance = projectClientLPP(
      makeBundle({ pension: { lpp_current_balance: 0 } }),
    );
    expect(withBalance!.projectedCapitalAt65).toBeGreaterThan(
      withoutBalance!.projectedCapitalAt65,
    );
  });
});

describe("projectClient3a — déterminisme", () => {
  it("retourne null sans solde ni cotisation", () => {
    expect(projectClient3a(makeBundle({}))).toBeNull();
  });

  it("est déterministe", () => {
    const b = makeBundle({
      pension: { pillar_3a_annual_contribution: 7258 },
    });
    expect(projectClient3a(b)).toEqual(projectClient3a(b));
  });

  it("projection >= cotisations cumulées (rendement positif)", () => {
    const b = makeBundle({
      client: { date_of_birth: "1985-01-01" },
      pension: { pillar_3a_annual_contribution: 7258 },
    });
    const r = projectClient3a(b);
    const years = 65 - 41; // approx
    expect(r!.projectedCapitalAt65).toBeGreaterThanOrEqual(7258 * years);
  });
});
