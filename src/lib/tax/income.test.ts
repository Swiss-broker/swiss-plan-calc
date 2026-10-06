import { describe, expect, it } from "vitest";
import { computeIncomeTax, avsAiApgSelfEmployed } from "./income";

describe("avsAiApgSelfEmployed — barème dégressif 2026", () => {
  it("cotisation minimale forfaitaire sous 10'100 CHF", () => {
    expect(avsAiApgSelfEmployed(5_000)).toBe(530);
    expect(avsAiApgSelfEmployed(0)).toBe(0);
  });

  it("premier palier (10'100-17'600 CHF, 5.371%)", () => {
    expect(avsAiApgSelfEmployed(15_000)).toBe(Math.round(15_000 * 0.05371));
  });

  it("palier intermédiaire (48'000-50'500 CHF, 7.840%)", () => {
    expect(avsAiApgSelfEmployed(50_000)).toBe(Math.round(50_000 * 0.0784));
  });

  it("dernier palier dégressif, 60'500 CHF inclus (9.321%)", () => {
    expect(avsAiApgSelfEmployed(60_500)).toBe(Math.round(60_500 * 0.09321));
  });

  it("taux plein 10% au-delà de 60'500 CHF", () => {
    expect(avsAiApgSelfEmployed(70_000)).toBe(7_000);
  });
});

describe("computeIncomeTax — indépendant (workStatus self_employed)", () => {
  it("pas d'AC, pas d'ANP, pas de LPP, AVS au barème dégressif", () => {
    const result = computeIncomeTax({
      canton: "VD",
      status: "single",
      grossSalary: 50_000,
      workStatus: "self_employed",
    });
    expect(result.deductions.avs).toBe(avsAiApgSelfEmployed(50_000));
    expect(result.deductions.ac).toBe(0);
    expect(result.deductions.anp).toBe(0);
    expect(result.deductions.lpp).toBe(0);
  });

  it("pas de forfait frais professionnels automatique (réservé aux salariés)", () => {
    const result = computeIncomeTax({
      canton: "VD",
      status: "single",
      grossSalary: 80_000,
      workStatus: "self_employed",
    });
    expect(result.deductions.professional).toBe(0);
  });

  it("les frais professionnels effectifs saisis à la main restent déductibles", () => {
    const result = computeIncomeTax({
      canton: "VD",
      status: "single",
      grossSalary: 80_000,
      workStatus: "self_employed",
      professionalExpenses: 12_000,
    });
    expect(result.deductions.professional).toBe(12_000);
  });

  it("plafond 3a 'sans LPP' (20% du revenu net, max 36'288) au lieu de 7'258", () => {
    const result = computeIncomeTax({
      canton: "VD",
      status: "single",
      grossSalary: 80_000,
      workStatus: "self_employed",
      pillar3aContributions: 20_000,
    });
    const netSelfEmploymentIncome = 80_000 - avsAiApgSelfEmployed(80_000);
    const expectedCap = Math.min(36_288, netSelfEmploymentIncome * 0.2);
    expect(result.deductions.pillar3a).toBe(Math.min(20_000, expectedCap));
  });

  it("un salarié (sans workStatus) garde le comportement existant inchangé", () => {
    const result = computeIncomeTax({
      canton: "VD",
      status: "single",
      grossSalary: 80_000,
    });
    expect(result.deductions.ac).toBeGreaterThan(0);
    expect(result.deductions.lpp).toBeGreaterThan(0);
    expect(result.deductions.professional).toBeGreaterThan(0);
  });
});
