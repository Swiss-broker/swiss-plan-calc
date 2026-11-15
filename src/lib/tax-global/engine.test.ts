import { describe, expect, it } from "vitest";
import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput } from "./types";

// Profil réel (frontalier Genève) qui a révélé le bug : avant ce correctif,
// touComparison n'était JAMAIS exposé pour cross_border_ge/cross_border_other
// — seul source_taxed/tou l'avait. Résultat concret : le comparateur "avant/
// après" de Fiscal Global affichait "Économie d'impôt : CHF 0" sans aucune
// explication exploitable (le bandeau "pourquoi l'écart reste à zéro" et les
// notes par champ dépendent tous de touComparison), pour n'importe quel
// frontalier GE qui teste des optimisations trop faibles pour battre sa
// retenue à la source.
const crossBorderGeInput: TaxGlobalInput = {
  age: 33,
  bonus: 5000,
  canton: "GE",
  permit: "G",
  lppPlan: "mandatory",
  taxYear: 2026,
  children: 0,
  donations: 0,
  netWealth: 15000,
  confession: "none",
  eurChfRate: 0.95,
  lppBuyback: 5000,
  workStatus: "employee",
  civilStatus: "single",
  grossSalary: 60000,
  imputedRent: 0,
  otherIncome: 0,
  chfToEurRate: 1.05,
  childrenAges: [],
  rentalIncome: 0,
  foreignIncome: 0,
  childCareCosts: 6000,
  knownTaxStatus: "cross_border_ge",
  spouseEmployed: false,
  medicalExpenses: 500,
  familyAllowances: 0,
  lppInsuredSalary: 33540,
  mortgageInterest: 0,
  spouseGrossSalary: 0,
  communalMultiplier: 0.4549,
  countryOfResidence: "FR",
  lppBuybackCapacity: 30000,
  lamalAdultMonthlyCHF: 200,
  lamalChildMonthlyCHF: 49.4,
  pillar3aContributions: 4800,
  pillar3bContributions: 1200,
  realEstateMaintenance: 0,
  healthInsurancePremiums: 2400,
};

describe("computeTaxGlobal — touComparison pour les régimes frontaliers", () => {
  it("expose touComparison (frontalier GE), même quand la TOU n'est pas avantageuse", () => {
    // Sans aucune déduction à faire valoir : la taxation ordinaire ne peut pas
    // battre la retenue à la source genevoise (barème officiel 2026).
    const result = computeTaxGlobal({
      ...crossBorderGeInput,
      lppBuyback: 0,
      pillar3aContributions: 0,
      pillar3bContributions: 0,
      healthInsurancePremiums: 0,
      childCareCosts: 0,
      medicalExpenses: 0,
    });
    expect(result.regime).toBe("cross_border_ge");
    expect(result.touComparison).toBeDefined();
    expect(result.touComparison!.sourceTax).toBeGreaterThan(0);
    expect(result.touComparison!.ordinaryTax).toBeGreaterThan(0);
    // Déductions trop faibles ici pour battre la retenue source GE : la TOU
    // coûterait plus cher, le texte doit le dire explicitement (pas de 0 CHF
    // silencieux sans explication).
    expect(result.touComparison!.delta).toBeGreaterThan(0);
    expect(result.touComparison!.recommendation).toBe("source");
    expect(result.touComparison!.recommendationText).toMatch(/coûterait/);
  });

  it("bascule sur la TOU quand les déductions deviennent assez importantes", () => {
    const result = computeTaxGlobal({
      ...crossBorderGeInput,
      assumeTou: true,
      lppBuyback: 30_000,
      pillar3aContributions: 7_258,
    });
    expect(result.touComparison).toBeDefined();
    expect(result.touComparison!.delta).toBeLessThan(0);
    expect(result.touComparison!.recommendation).toBe("tou");
    // Le total affiché doit refléter le scénario ordinaire (le moins cher),
    // pas rester figé sur la retenue source.
    expect(result.totalTaxCHF).toBeLessThan(result.touComparison!.sourceTax);
  });
});

describe("computeTaxGlobal — résident imposé à la source", () => {
  const resident: TaxGlobalInput = {
    ...crossBorderGeInput,
    knownTaxStatus: "source_taxed",
    countryOfResidence: "CH",
    permit: "B",
    bonus: 0,
    lppBuyback: 0,
    pillar3aContributions: 0,
    pillar3bContributions: 0,
    childCareCosts: 0,
    medicalExpenses: 0,
    healthInsurancePremiums: 0,
    lppInsuredSalary: undefined,
  };

  it("sous 120'000 CHF : retenue à la source aujourd'hui, taxation ordinaire après demande de TOU", () => {
    const now = computeTaxGlobal({ ...resident, grossSalary: 90_000 });
    expect(now.touEligibility!.eligibleForTOU).toBe(true);
    expect(now.touComparison!.mandatory).toBe(false);
    // Situation actuelle : la retenue à la source, quoi qu'il arrive.
    expect(now.totalTaxCHF).toBe(now.source!.annualTax);
    // Après demande de TOU : la taxation ordinaire, telle quelle.
    const r = computeTaxGlobal({ ...resident, grossSalary: 90_000, assumeTou: true });
    expect(r.totalTaxCHF).toBe(r.touComparison!.ordinaryTax);
  });

  it("dès 120'000 CHF de salaire brut : taxation ordinaire ultérieure obligatoire, même si elle coûte plus que la retenue", () => {
    const r = computeTaxGlobal({ ...resident, grossSalary: 150_000 });
    expect(r.touComparison!.mandatory).toBe(true);
    expect(r.totalTaxCHF).toBe(r.touComparison!.ordinaryTax);
    expect(r.marginalRate).toBe(r.touComparison!.marginalRate);
    expect(r.notes.some((n) => n.includes("obligatoire"))).toBe(true);
  });

  it("frontalier accord 1983 : aucun impôt suisse, revenu de référence du foyer", () => {
    const r = computeTaxGlobal({
      ...resident,
      knownTaxStatus: "cross_border_fr_1983",
      countryOfResidence: "FR",
      permit: "G",
      canton: "VD",
      civilStatus: "married",
      spouseEmployed: true,
      spouseGrossSalary: 40_000,
      grossSalary: 90_000,
    });
    expect(r.swissShareCHF).toBe(0);
    expect(r.foreignShareCHF).toBe(r.totalTaxCHF);
    expect(r.grossIncomeCHF).toBe(130_000);
  });
});

describe("computeTaxGlobal — frontalier genevois : avant = impôt à la source, après = TOU", () => {
  const frontalier: TaxGlobalInput = {
    ...crossBorderGeInput,
    grossSalary: 78_000,
    bonus: 0,
    children: 2,
    childrenAges: [4, 7],
    lppInsuredSalary: undefined,
  };

  it("situation actuelle : barème A0, les enfants et les déductions ne changent rien", () => {
    const now = computeTaxGlobal(frontalier);
    const noChildNoDeduction = computeTaxGlobal({
      ...frontalier,
      children: 0,
      childrenAges: [],
      lppBuyback: 0,
      pillar3aContributions: 0,
      pillar3bContributions: 0,
      healthInsurancePremiums: 0,
      childCareCosts: 0,
      medicalExpenses: 0,
    });
    expect(now.totalTaxCHF).toBe(noChildNoDeduction.totalTaxCHF);
    // Barème officiel genevois A0 à 78'000 CHF/an : environ 10.8 %.
    expect(now.totalTaxCHF).toBeGreaterThan(8_000);
    expect(now.totalTaxCHF).toBeLessThan(8_800);
  });

  it("après demande de TOU : enfants et déductions pris en compte, impôt nettement plus bas", () => {
    const now = computeTaxGlobal(frontalier);
    const afterTou = computeTaxGlobal({ ...frontalier, assumeTou: true });
    expect(afterTou.totalTaxCHF).toBeLessThan(now.totalTaxCHF / 2);
    expect(afterTou.totalTaxCHF).toBe(now.touComparison!.ordinaryTax);
  });

  it("un versement 3a supplémentaire réduit encore l'impôt une fois la TOU demandée, pas avant", () => {
    const base = { ...frontalier, children: 0, childrenAges: [], pillar3aContributions: 0 };
    const more3a = { ...base, pillar3aContributions: 7_258 };
    expect(computeTaxGlobal(more3a).totalTaxCHF).toBe(computeTaxGlobal(base).totalTaxCHF);
    expect(computeTaxGlobal({ ...more3a, assumeTou: true }).totalTaxCHF).toBeLessThan(
      computeTaxGlobal({ ...base, assumeTou: true }).totalTaxCHF,
    );
  });
});
