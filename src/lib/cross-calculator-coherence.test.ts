// Cohérence entre calculateurs pour un MÊME dossier client : l'impôt actuel,
// l'économie d'un 3e pilier A et celle d'un rachat LPP doivent être
// identiques dans Fiscal global, sur la fiche client, dans le calculateur
// 3e pilier et dans le calculateur LPP.
import { describe, expect, it } from "vitest";
import { computeTaxGlobal } from "@/lib/tax-global/engine";
import { createDefaultInput } from "@/lib/tax-global/profile";
import type { TaxGlobalInput } from "@/lib/tax-global/types";
import { computeRegimeAwareDeduction } from "@/lib/tax/regime-aware-deduction";
import { computeClientDashboard } from "@/lib/client-dashboard";
import {
  toTaxGlobalInput,
  toRetirementInput,
  stripUndefined,
  type ClientBundle,
} from "@/lib/clients/to-calculator-input";
import type { Client } from "@/lib/clients/types";

function bundle(client: Record<string, unknown>, pillar3a = 5_000): ClientBundle {
  return {
    client: {
      commune: null,
      country_of_residence: "CH",
      permit: "swiss",
      tax_status: "resident",
      civil_status: "single",
      children: [],
      confession: "none",
      date_of_birth: "1985-03-10",
      work_status: "employee",
      bonus: 0,
      spouse_gross_annual_salary: null,
      other_income: 0,
      family_allowances: null,
      mortgage_interest_france: null,
      ...client,
    } as unknown as Client,
    pension: {
      pillar_3a_annual_contribution: pillar3a,
      lpp_current_balance: 120_000,
      lpp_max_buyback: 60_000,
    } as unknown as ClientBundle["pension"],
    assets: null,
  };
}

const KIDS = [
  { date_of_birth: "2018-04-02", in_household: true },
  { date_of_birth: "2021-11-20", in_household: true },
];

const PROFILES: Array<[string, ClientBundle]> = [
  ["résident GE, célibataire, 95'000", bundle({ canton: "GE", gross_annual_salary: 95_000 })],
  [
    "résident VD, marié, 2 enfants, 130'000 + conjoint 40'000",
    bundle({
      canton: "VD",
      civil_status: "married",
      children: KIDS,
      gross_annual_salary: 130_000,
      spouse_gross_annual_salary: 40_000,
    }),
  ],
  [
    "permis B imposé à la source NE, célibataire, 1 enfant, 85'000",
    bundle({
      canton: "NE",
      permit: "B",
      tax_status: "source_taxed",
      children: [KIDS[0]],
      gross_annual_salary: 85_000,
    }),
  ],
  [
    "permis B imposé à la source VS, marié un revenu, 2 enfants, 100'000",
    bundle({
      canton: "VS",
      permit: "B",
      tax_status: "source_taxed",
      civil_status: "married",
      children: KIDS,
      gross_annual_salary: 100_000,
    }),
  ],
  [
    "permis B, 150'000 (TOU obligatoire) FR",
    bundle({ canton: "FR", permit: "B", tax_status: "source_taxed", gross_annual_salary: 150_000 }),
  ],
  [
    "frontalier GE, union libre, 1 enfant, 78'000",
    bundle({
      canton: "GE",
      permit: "G",
      country_of_residence: "FR",
      tax_status: "cross_border_ge",
      children: [KIDS[0]],
      gross_annual_salary: 78_000,
    }),
  ],
  [
    "frontalier accord 1983 (VD), marié, 110'000",
    bundle({
      canton: "VD",
      permit: "G",
      country_of_residence: "FR",
      tax_status: "cross_border_fr_1983",
      civil_status: "married",
      gross_annual_salary: 110_000,
    }),
  ],
];

function taxGlobalInput(b: ClientBundle): TaxGlobalInput {
  return {
    ...createDefaultInput(),
    ...stripUndefined(toTaxGlobalInput(b) as unknown as Record<string, unknown>),
  } as TaxGlobalInput;
}

describe.each(PROFILES)("cohérence entre calculateurs — %s", (_name, b) => {
  const g = taxGlobalInput(b);
  const dashboard = computeClientDashboard(b);

  it("impôt actuel : fiche client = Fiscal global", () => {
    expect(dashboard.tax?.annualBurden).toBe(Math.round(computeTaxGlobal(g).totalTaxCHF));
  });

  it("taux marginal : Rente vs capital = fiche client = Fiscal global", () => {
    const fiscalGlobal = computeTaxGlobal(g).marginalRate;
    // L'écran Rente vs capital affiche le taux arrondi au dixième.
    expect(toRetirementInput(b).rentMarginalRate).toBe(Math.round(fiscalGlobal * 10) / 10);
    expect(dashboard.tax?.marginalRate).toBe(fiscalGlobal);
  });

  it("canton actuel du comparateur cantonal = Fiscal global", () => {
    expect(dashboard.cantonCompare?.current.total).toBe(Math.round(computeTaxGlobal(g).totalTaxCHF));
  });

  it("économie du 3e pilier A : calculateur 3a = fiche client = Fiscal global", () => {
    const amount = 5_000;
    const viaTaxGlobal = Math.round(
      computeTaxGlobal({ ...g, assumeTou: true, pillar3aContributions: 0 }).totalTaxCHF -
        computeTaxGlobal({ ...g, assumeTou: true, pillar3aContributions: amount }).totalTaxCHF,
    );
    const viaPillar3aScreen = computeRegimeAwareDeduction({
      bundle: b,
      fallbackTaxInput: { canton: g.canton, status: "single", grossSalary: g.grossSalary },
      deductionAmount: amount,
      deductionField: "pillar3aContributions",
    }).taxSavings;
    expect(viaPillar3aScreen).toBe(viaTaxGlobal);
    expect(dashboard.pillar3a?.taxSavings).toBe(Math.max(0, viaTaxGlobal));
  });

  it("économie d'un rachat LPP de 20'000 : calculateur LPP = Fiscal global", () => {
    const amount = 20_000;
    const viaTaxGlobal = Math.round(
      computeTaxGlobal({ ...g, assumeTou: true, lppBuyback: 0 }).totalTaxCHF -
        computeTaxGlobal({ ...g, assumeTou: true, lppBuyback: amount }).totalTaxCHF,
    );
    const viaLppScreen = computeRegimeAwareDeduction({
      bundle: b,
      fallbackTaxInput: { canton: g.canton, status: "single", grossSalary: g.grossSalary },
      deductionAmount: amount,
      deductionField: "lppBuyback",
    }).taxSavings;
    expect(viaLppScreen).toBe(viaTaxGlobal);
    expect(viaLppScreen).toBeGreaterThanOrEqual(0);
  });
});

describe("3e pilier A d'un imposé à la source : chiffré comme en TOU, jamais forcé à zéro", () => {
  it("frontalier GE sans enfant : économie du 3a = impôt ordinaire sans − avec versement", () => {
    const b = bundle({
      canton: "GE",
      permit: "G",
      country_of_residence: "FR",
      tax_status: "cross_border_ge",
      gross_annual_salary: 78_000,
    });
    const g = taxGlobalInput(b);
    const ordinary = (p3a: number) =>
      computeTaxGlobal({ ...g, pillar3aContributions: p3a }).touComparison!.ordinaryTax;
    const r = computeRegimeAwareDeduction({
      bundle: b,
      fallbackTaxInput: { canton: "GE", status: "single", grossSalary: 78_000 },
      deductionAmount: 7_258,
      deductionField: "pillar3aContributions",
    });
    expect(r.taxSavings).toBe(Math.round(ordinary(0) - ordinary(7_258)));
    expect(r.taxSavings).toBeGreaterThan(1_500);
  });
});

describe("cohérence — règles par régime", () => {
  const find = (label: string) => PROFILES.find(([n]) => n.startsWith(label))![1];

  it("frontalier accord 1983 : ni 3a ni rachat LPP ne produisent d'économie, partout", () => {
    const b = find("frontalier accord 1983");
    const r = computeRegimeAwareDeduction({
      bundle: b,
      fallbackTaxInput: { canton: "VD", status: "married", grossSalary: 110_000 },
      deductionAmount: 7_258,
      deductionField: "pillar3aContributions",
    });
    expect(r.applicable).toBe("no");
    expect(r.taxSavings).toBe(0);
    expect(computeClientDashboard(b).pillar3a?.taxSavings).toBe(0);
  });

  it("imposé à la source non marié avec enfant : impôt actuel au barème A0, identique sans l'enfant", () => {
    const b = find("permis B imposé à la source NE");
    const withoutChild = { ...b, client: { ...b.client, children: [] } } as ClientBundle;
    expect(computeClientDashboard(b).tax?.annualBurden).toBe(
      computeClientDashboard(withoutChild).tax?.annualBurden,
    );
  });

  it("imposé à la source marié : les enfants réduisent la retenue actuelle (barème B2)", () => {
    const b = find("permis B imposé à la source VS");
    const withoutChild = { ...b, client: { ...b.client, children: [] } } as ClientBundle;
    expect(computeClientDashboard(b).tax!.annualBurden).toBeLessThan(
      computeClientDashboard(withoutChild).tax!.annualBurden,
    );
  });
});
