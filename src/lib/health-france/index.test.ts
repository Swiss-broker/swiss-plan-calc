import { describe, expect, it } from "vitest";
import { computeHealthFrance, CMU_ABATTEMENT_BY_YEAR, CMU_TAUX_COTISATION } from "./index";
import { frenchTaxableSalary } from "@/lib/tax/cross-border";

describe("computeHealthFrance — assiette CMU", () => {
  const input = {
    swissGrossSalaryCHF: 95_000,
    civilStatus: "single" as const,
    childrenCount: 0,
    chfToEurRate: 1.05,
    taxYear: 2026,
  };

  it("le revenu fiscal de référence est le salaire net imposable, pas le salaire brut", () => {
    const r = computeHealthFrance(input);
    const grossEur = 95_000 * 1.05;
    expect(r.rfrEUR).toBeLessThan(grossEur * 0.85);
    const expected = frenchTaxableSalary({ grossCHF: 95_000, eurChfRate: 1 / 1.05 });
    expect(r.rfrEUR).toBe(Math.round(expected.taxableEur));
  });

  it("cotisation = 8 % × (RFR − abattement de l'année)", () => {
    const r = computeHealthFrance(input);
    expect(r.cmuAnnualEUR).toBe(
      Math.round((r.rfrEUR - CMU_ABATTEMENT_BY_YEAR[2026]) * CMU_TAUX_COTISATION),
    );
    expect(r.cmuAnnualCHF).toBe(Math.round(r.cmuAnnualEUR / 1.05));
  });

  it("même revenu imposable français que le calculateur Fiscal global pour le même salaire", () => {
    const viaHealth = computeHealthFrance({ ...input, age: 50 }).rfrEUR;
    const viaTax = frenchTaxableSalary({ grossCHF: 95_000, eurChfRate: 1 / 1.05, age: 50 }).taxableEur;
    expect(viaHealth).toBe(Math.round(viaTax));
  });
});

describe("computeHealthFrance — personnes assurées en LAMal", () => {
  const base = {
    swissGrossSalaryCHF: 95_000,
    childrenCount: 2,
    chfToEurRate: 1.05,
    taxYear: 2026,
    lamalAdultMonthlyCHF: 200,
    lamalChildMonthlyCHF: 50,
  };

  it("célibataire ou conjoint qui travaille : une seule prime adulte", () => {
    const single = computeHealthFrance({ ...base, civilStatus: "single" });
    const spouseWorks = computeHealthFrance({ ...base, civilStatus: "married" });
    expect(single.lamalAnnualCHF).toBe(200 * 12 + 2 * 50 * 12);
    expect(spouseWorks.lamalAnnualCHF).toBe(single.lamalAnnualCHF);
  });

  it("conjoint sans activité : deux primes adultes en LAMal, cotisation CMU inchangée", () => {
    const spouseWorks = computeHealthFrance({ ...base, civilStatus: "married" });
    const spouseAtHome = computeHealthFrance({
      ...base,
      civilStatus: "married",
      spouseInsuredWithFrontalier: true,
    });
    expect(spouseAtHome.lamalInsuredAdults).toBe(2);
    expect(spouseAtHome.lamalAnnualCHF).toBe(2 * 200 * 12 + 2 * 50 * 12);
    expect(spouseAtHome.cmuAnnualCHF).toBe(spouseWorks.cmuAnnualCHF);
  });

  it("l'option est sans effet pour un client non marié", () => {
    const r = computeHealthFrance({ ...base, civilStatus: "single", spouseInsuredWithFrontalier: true });
    expect(r.lamalInsuredAdults).toBe(1);
  });
});
