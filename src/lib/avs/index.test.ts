import { describe, it, expect } from "vitest";
import { getReferenceAge, theoreticalAnnualPension, projectAvsPension, AVS_2026 } from "./index";

describe("AVS getReferenceAge (AVS21)", () => {
  it("homme = 65 ans toujours", () => {
    expect(getReferenceAge(1960, "male")).toBe(65);
    expect(getReferenceAge(1990, "male")).toBe(65);
  });
  it("femme transition AVS21", () => {
    expect(getReferenceAge(1960, "female")).toBe(64);
    expect(getReferenceAge(1961, "female")).toBe(64.25);
    expect(getReferenceAge(1962, "female")).toBe(64.5);
    expect(getReferenceAge(1963, "female")).toBe(64.75);
    expect(getReferenceAge(1964, "female")).toBe(65);
    expect(getReferenceAge(1990, "female")).toBe(65);
  });
  it("autre/non renseigné = 65", () => {
    expect(getReferenceAge(1980, "other")).toBe(65);
    expect(getReferenceAge(1980, null)).toBe(65);
  });
});

describe("AVS theoreticalAnnualPension", () => {
  it("revenu très bas → rente min", () => {
    expect(theoreticalAnnualPension(0)).toBe(AVS_2026.minAnnualPension);
    expect(theoreticalAnnualPension(10_000)).toBe(AVS_2026.minAnnualPension);
  });
  it("revenu élevé → rente max", () => {
    expect(theoreticalAnnualPension(88_200)).toBe(AVS_2026.maxAnnualPension);
    expect(theoreticalAnnualPension(200_000)).toBe(AVS_2026.maxAnnualPension);
  });
  it("revenu moyen → entre min et max, plus proche du max", () => {
    const r = theoreticalAnnualPension(60_480);
    expect(r).toBeGreaterThan(AVS_2026.minAnnualPension);
    expect(r).toBeLessThan(AVS_2026.maxAnnualPension);
    // Au point charnière, doit être proche de min + 73% de l'écart
    const expected = AVS_2026.minAnnualPension + 0.73 * (AVS_2026.maxAnnualPension - AVS_2026.minAnnualPension);
    expect(Math.abs(r - expected)).toBeLessThan(1);
  });
});

describe("AVS projectAvsPension", () => {
  it("célibataire carrière complète", () => {
    const r = projectAvsPension({
      status: "single",
      primary: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 90_000 },
    });
    expect(r.primary.missingYears).toBe(0);
    expect(r.primary.annualPension).toBe(AVS_2026.maxAnnualPension);
    expect(r.cappedCouple).toBe(false);
  });

  it("célibataire avec années manquantes (frontalier arrivé tard)", () => {
    const r = projectAvsPension({
      status: "single",
      primary: { birthYear: 1980, contributionStartYear: 2015, retirementYear: 2045, averageAnnualIncome: 90_000 },
    });
    // 2045 - 2015 = 30 ans cotisés, 14 manquants
    expect(r.primary.effectiveYears).toBe(30);
    expect(r.primary.missingYears).toBe(14);
    // Rente réduite ≈ max × 30/44
    expect(r.primary.annualPension).toBe(Math.round(AVS_2026.maxAnnualPension * 30 / 44));
  });

  it("couple sans plafonnement", () => {
    const r = projectAvsPension({
      status: "married",
      primary: { birthYear: 1985, contributionStartYear: 2010, retirementYear: 2050, averageAnnualIncome: 60_000 },
      spouse: { birthYear: 1985, contributionStartYear: 2010, retirementYear: 2050, averageAnnualIncome: 30_000 },
    });
    expect(r.cappedCouple).toBe(false);
    expect(r.combinedAnnualPension).toBeDefined();
  });

  it("couple avec plafonnement (deux hauts revenus)", () => {
    const r = projectAvsPension({
      status: "married",
      primary: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 100_000 },
      spouse: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 100_000 },
    });
    expect(r.cappedCouple).toBe(true);
    expect(r.combinedAnnualPension).toBe(AVS_2026.maxCoupleAnnualPension);
  });
});

describe("careerGapYears (lacune de cotisation)", () => {
  it("réduit les années effectives sans toucher au revenu moyen saisi", () => {
    // Arrivée/début à 30 ans (contributionStartYear), 10 ans jusqu'à la
    // retraite simulée, mais 5 ans de lacune dans la période.
    const withoutGap = projectAvsPension({
      status: "single",
      primary: {
        birthYear: 1970,
        gender: "male",
        contributionStartYear: 2015,
        retirementYear: 2025,
        averageAnnualIncome: 80_000,
      },
    });
    const withGap = projectAvsPension({
      status: "single",
      primary: {
        birthYear: 1970,
        gender: "male",
        contributionStartYear: 2015,
        retirementYear: 2025,
        averageAnnualIncome: 80_000,
        careerGapYears: 5,
      },
    });
    expect(withoutGap.primary.effectiveYears).toBe(10);
    expect(withGap.primary.effectiveYears).toBe(5);
    expect(withGap.primary.missingYears).toBe(withoutGap.primary.missingYears + 5);
    expect(withGap.primary.determiningIncome).toBe(withoutGap.primary.determiningIncome);
    expect(withGap.primary.annualPension).toBeLessThan(withoutGap.primary.annualPension);
  });

  it("ne peut jamais rendre les années effectives négatives (lacune > durée brute)", () => {
    const r = projectAvsPension({
      status: "single",
      primary: {
        birthYear: 1970,
        gender: "male",
        contributionStartYear: 2020,
        retirementYear: 2025,
        averageAnnualIncome: 80_000,
        careerGapYears: 999,
      },
    });
    expect(r.primary.effectiveYears).toBe(0);
    expect(r.primary.annualPension).toBe(0);
  });
});
