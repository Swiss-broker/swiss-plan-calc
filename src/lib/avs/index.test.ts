import { describe, it, expect } from "vitest";
import {
  getReferenceAge,
  getReferenceRetirementYear,
  theoreticalAnnualPension,
  projectAvsPension,
  projectAiPension,
  careerSupplementPct,
  AVS_2026,
} from "./index";
import {
  applyOverinsuranceCap,
  buildDisabilityBenefits,
  buildSurvivorBenefits,
} from "./survivors";

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

describe("AVS theoreticalAnnualPension — formule légale art. 34 LAVS (échelle 44)", () => {
  it("revenu très bas → rente min", () => {
    expect(theoreticalAnnualPension(0)).toBe(AVS_2026.minAnnualPension);
    expect(theoreticalAnnualPension(10_000)).toBe(AVS_2026.minAnnualPension);
    expect(theoreticalAnnualPension(15_120)).toBeCloseTo(AVS_2026.minAnnualPension, 6);
  });
  it("rente max atteinte à 90'720 CHF (72 × rente min), pas avant", () => {
    expect(theoreticalAnnualPension(90_720)).toBeCloseTo(AVS_2026.maxAnnualPension, 6);
    expect(theoreticalAnnualPension(200_000)).toBe(AVS_2026.maxAnnualPension);
    // 88'200 était le plafond 2023-2024 : en 2026, ce revenu ne donne plus la rente max.
    expect(theoreticalAnnualPension(88_200)).toBeLessThan(AVS_2026.maxAnnualPension);
  });
  it("valeurs des tables officielles (rente mensuelle, échelle 44)", () => {
    // Point charnière 36 × 1'260 = 45'360 : 0.74 × 1'260 + 13/600 × 45'360 = 1'915.20
    expect(theoreticalAnnualPension(45_360) / 12).toBeCloseTo(1_915.2, 4);
    // 60'480 : 1.04 × 1'260 + 8/600 × 60'480 = 2'116.80
    expect(theoreticalAnnualPension(60_480) / 12).toBeCloseTo(2_116.8, 4);
    // 30'240 : 0.74 × 1'260 + 13/600 × 30'240 = 1'587.60
    expect(theoreticalAnnualPension(30_240) / 12).toBeCloseTo(1_587.6, 4);
  });
  it("continue au point charnière (les deux branches coïncident)", () => {
    const below = theoreticalAnnualPension(AVS_2026.hingeIncome - 1);
    const above = theoreticalAnnualPension(AVS_2026.hingeIncome + 1);
    expect(above - below).toBeLessThan(1);
  });
});

describe("AVS projectAvsPension", () => {
  it("célibataire carrière complète : 12 mensualités + 13e rente", () => {
    const r = projectAvsPension({
      status: "single",
      primary: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 95_000 },
    });
    expect(r.primary.missingYears).toBe(0);
    expect(r.primary.monthlyPension).toBe(AVS_2026.maxMonthlyPension);
    expect(r.primary.reducedAnnualPension).toBe(AVS_2026.maxAnnualPension);
    expect(r.primary.thirteenthPension).toBe(AVS_2026.maxMonthlyPension);
    expect(r.primary.annualPension).toBe(13 * AVS_2026.maxMonthlyPension);
    expect(r.cappedCouple).toBe(false);
  });

  it("célibataire avec années manquantes (frontalier arrivé tard)", () => {
    const r = projectAvsPension({
      status: "single",
      primary: { birthYear: 1980, contributionStartYear: 2015, retirementYear: 2045, averageAnnualIncome: 95_000 },
    });
    // 2045 - 2015 = 30 ans cotisés, 14 manquants
    expect(r.primary.effectiveYears).toBe(30);
    expect(r.primary.missingYears).toBe(14);
    // Rente réduite = max × 30/44 (base 12 mois), 13e rente en plus
    expect(r.primary.reducedAnnualPension).toBe(Math.round(AVS_2026.maxAnnualPension * 30 / 44));
    expect(r.primary.annualPension).toBe(Math.round((AVS_2026.maxAnnualPension * 30 / 44) * 13 / 12));
  });

  it("couple sans plafonnement", () => {
    const r = projectAvsPension({
      status: "married",
      primary: { birthYear: 1985, contributionStartYear: 2010, retirementYear: 2050, averageAnnualIncome: 60_000 },
      spouse: { birthYear: 1985, contributionStartYear: 2010, retirementYear: 2050, averageAnnualIncome: 30_000 },
    });
    expect(r.cappedCouple).toBe(false);
    expect(r.combinedAnnualPension).toBe(r.primary.annualPension + r.spouse!.annualPension);
  });

  it("couple avec plafonnement : le plafond de 3'780 porte sur les mensualités, la 13e rente s'y ajoute", () => {
    const r = projectAvsPension({
      status: "married",
      primary: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 100_000 },
      spouse: { birthYear: 1985, contributionStartYear: 2006, retirementYear: 2050, averageAnnualIncome: 100_000 },
    });
    expect(r.cappedCouple).toBe(true);
    expect(r.combinedMonthlyPension).toBe(AVS_2026.maxCoupleMonthlyPension);
    expect(r.combinedAnnualPension).toBe(13 * AVS_2026.maxCoupleMonthlyPension);
    expect(r.primary.monthlyPension).toBe(AVS_2026.maxCoupleMonthlyPension / 2);
  });
});

describe("getReferenceRetirementYear", () => {
  it("une seule règle d'arrondi pour toute l'app", () => {
    expect(getReferenceRetirementYear(1980, "male")).toBe(2045);
    expect(getReferenceRetirementYear(1960, "female")).toBe(2024);
    expect(getReferenceRetirementYear(1961, "female")).toBe(2025);
    expect(getReferenceRetirementYear(1964, "female")).toBe(2029);
  });
});

describe("projectAiPension — échelle de la classe d'âge (art. 36 LAI)", () => {
  it("assuré de 35 ans sans lacune : rente AI complète, pas 14/44", () => {
    const r = projectAiPension({
      birthYear: 1991,
      contributionStartYear: 2012,
      eventYear: 2026,
      averageAnnualIncome: 95_000,
    });
    expect(r.cohortYears).toBe(14);
    expect(r.effectiveYears).toBe(14);
    expect(r.reductionRatio).toBe(1);
    expect(r.monthlyPension).toBe(AVS_2026.maxMonthlyPension);
    // Pas de 13e rente pour l'AI
    expect(r.thirteenthPension).toBe(0);
    expect(r.annualPension).toBe(AVS_2026.maxAnnualPension);
  });

  it("arrivée tardive en Suisse : rente partielle au prorata de la classe d'âge", () => {
    // Né en 1986 (classe d'âge : cotise dès 2007), arrivé en 2016, invalide en 2026.
    const r = projectAiPension({
      birthYear: 1986,
      contributionStartYear: 2016,
      eventYear: 2026,
      averageAnnualIncome: 95_000,
    });
    expect(r.cohortYears).toBe(19);
    expect(r.effectiveYears).toBe(10);
    expect(r.missingYears).toBe(9);
    expect(r.reductionRatio).toBeCloseTo(10 / 19, 6);
  });

  it("supplément de carrière avant 45 ans (art. 54 RAVS)", () => {
    expect(careerSupplementPct(22)).toBe(100);
    expect(careerSupplementPct(28)).toBe(40);
    expect(careerSupplementPct(33)).toBe(20);
    expect(careerSupplementPct(40)).toBe(5);
    expect(careerSupplementPct(45)).toBe(0);
    const young = projectAiPension({
      birthYear: 1998, contributionStartYear: 2019, eventYear: 2026, averageAnnualIncome: 50_000,
    });
    // 28 ans → +40 % : revenu déterminant 70'000
    expect(young.careerSupplementPct).toBe(40);
    expect(young.determiningIncome).toBe(70_000);
  });
});

describe("Surassurance art. 41 LAVS (rentes pour enfants / orphelins)", () => {
  it("rente AI max + 3 enfants : aucune réduction (5'544/mois < 90 % du RAM)", () => {
    const b = buildDisabilityBenefits({
      primaryTheoreticalAnnual: AVS_2026.maxAnnualPension,
      primaryFullReducedAnnual: AVS_2026.maxAnnualPension,
      determiningIncome: 90_720,
      disabilityPct: 100,
      childrenCount: 3,
    });
    expect(b.cappedFamily).toBe(false);
    expect(b.primary.monthly).toBe(2_520);
    expect(b.children.every((c) => c.monthly === 1_008)).toBe(true);
    expect(b.totalMonthly).toBe(5_544);
  });

  it("au-delà de 90 % du RAM : seules les rentes d'enfants sont réduites", () => {
    const b = buildDisabilityBenefits({
      primaryTheoreticalAnnual: AVS_2026.maxAnnualPension,
      primaryFullReducedAnnual: AVS_2026.maxAnnualPension,
      determiningIncome: 90_720,
      disabilityPct: 100,
      childrenCount: 5,
    });
    expect(b.cappedFamily).toBe(true);
    expect(b.primary.annual).toBe(AVS_2026.maxAnnualPension);
    expect(b.totalAnnual).toBeLessThanOrEqual(Math.round(0.9 * 90_720) + 5);
    expect(b.totalAnnual).toBeGreaterThan(Math.round(0.9 * 90_720) - 5);
  });

  it("minimum garanti : 150 % de la rente min même si 90 % du RAM est plus bas", () => {
    const { children, capped } = applyOverinsuranceCap(
      AVS_2026.minAnnualPension,
      [
        { label: "a", annual: 6_048, monthly: 504, ratio: 0.4 },
        { label: "b", annual: 6_048, monthly: 504, ratio: 0.4 },
      ],
      15_120,
    );
    expect(capped).toBe(true);
    const total = AVS_2026.minAnnualPension + children.reduce((s, c) => s + c.annual, 0);
    expect(total).toBe(Math.round(1.5 * AVS_2026.minAnnualPension));
  });

  it("survivants : veuve 80 % + 2 orphelins 40 % sans réduction au revenu max", () => {
    const b = buildSurvivorBenefits({
      deceasedTheoreticalAnnual: AVS_2026.maxAnnualPension,
      determiningIncome: 90_720,
      hasSurvivingSpouse: true,
      childrenCount: 2,
    });
    expect(b.cappedFamily).toBe(false);
    expect(b.widow?.monthly).toBe(2_016);
    expect(b.orphans.map((o) => o.monthly)).toEqual([1_008, 1_008]);
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
