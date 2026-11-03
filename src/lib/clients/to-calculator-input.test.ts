import { describe, expect, it } from "vitest";
import { toBudgetInput, type ClientBundle } from "./to-calculator-input";
import type { Client } from "./types";

// Fiche minimale suffisante pour atteindre toTaxGlobalInput/computeTaxGlobal
// depuis toBudgetInput — seuls les champs réellement lus par ce chemin sont
// renseignés, le reste resterait `null`/`undefined` comme sur une vraie fiche
// incomplète (c'est précisément ce cas, le plus courant, qui faisait planter
// le calcul réel en silence avant correctif).
function bundle(overrides: Partial<Client> = {}): ClientBundle {
  const client = {
    canton: "GE",
    commune: null,
    country_of_residence: "CH",
    permit: "swiss",
    tax_status: "resident",
    civil_status: "single",
    children: [],
    confession: "none",
    date_of_birth: "1990-01-01",
    work_status: "employee",
    gross_annual_salary: 90_000,
    bonus: null,
    spouse_gross_annual_salary: null,
    other_income: null,
    family_allowances: null,
    mortgage_interest_france: null,
    ...overrides,
  } as unknown as Client;
  return { client, pension: null, assets: null };
}

describe("toBudgetInput — salaire net réel vs repli forfaitaire 80%", () => {
  it("utilise le vrai calcul fiscal (computeTaxGlobal), pas le repli à 80% du brut, pour un profil très courant (salaire seul, pas de bonus/autre revenu/rachat)", () => {
    const result = toBudgetInput(bundle());
    const naiveFallback = Math.round((90_000 * 0.8) / 12);

    expect(result.netSalaryMonthlyCHF).toBeDefined();
    expect(Number.isFinite(result.netSalaryMonthlyCHF)).toBe(true);
    // Avant correctif : toTaxGlobalInput() renvoyait des champs optionnels
    // explicitement `undefined` (bonus, rentalIncome, lppBuyback...), qui
    // écrasaient les 0 par défaut de createDefaultInput() au merge — la
    // somme devenait NaN, le vrai calcul échouait silencieusement, et ce
    // test aurait obtenu exactement `naiveFallback` (6'000).
    expect(result.netSalaryMonthlyCHF).not.toBe(naiveFallback);
    // Un résident GE à 90'000 CHF paie impôt + charges sociales : le net
    // réel doit rester nettement sous le brut, dans une fourchette réaliste.
    expect(result.netSalaryMonthlyCHF!).toBeGreaterThan(3_000);
    expect(result.netSalaryMonthlyCHF!).toBeLessThan(7_500);
  });

  it("couple : le revenu du conjoint n'est compté qu'une fois (revenu net DE FOYER)", () => {
    const result = toBudgetInput(
      bundle({ civil_status: "married", spouse_gross_annual_salary: 60_000 }),
    );
    expect(result.spouseNetSalaryMonthlyCHF).toBe(0);
    expect(result.netSalaryMonthlyCHF!).toBeGreaterThan(0);
  });
});
