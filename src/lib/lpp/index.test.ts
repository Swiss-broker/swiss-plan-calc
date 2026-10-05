import { describe, expect, it } from "vitest";
import { computeLppInsuredSalary, projectLPP, LPP_COORDINATION_DEDUCTION_2026 } from "./index";

// Régression : projectLPP() recevait un salaire DÉJÀ coordonné
// (computeLppInsuredSalary(grossSalary, cap), ou client_pension.lpp_insured_salary
// venant du certificat de prévoyance) et lui réappliquait la déduction de
// coordination (26'460 CHF) une seconde fois à chaque année de la
// projection, sous-estimant le salaire coordonné — et donc le capital LPP
// projeté — d'environ 40% dans un cas typique. Corrigé le 05.10.2026.
describe("computeLppInsuredSalary", () => {
  it("applique la déduction de coordination une seule fois, après plafonnement", () => {
    expect(computeLppInsuredSalary(120_000, 90_720)).toBe(90_720 - LPP_COORDINATION_DEDUCTION_2026);
  });

  it("retourne 0 sous le seuil d'entrée LPP", () => {
    expect(computeLppInsuredSalary(20_000)).toBe(0);
  });

  it("applique le plancher légal de 3'780 CHF", () => {
    expect(computeLppInsuredSalary(27_000)).toBe(3_780);
  });
});

describe("projectLPP — pas de double déduction de coordination", () => {
  it("utilise le salaire coordonné d'entrée tel quel en année 1 (pas re-déduit)", () => {
    const grossSalary = 120_000;
    const cap = 90_720;
    const insuredSalary = computeLppInsuredSalary(grossSalary, cap); // 64'260

    const projection = projectLPP({
      currentAge: 35,
      retirementAge: 36, // une seule année, pour isoler le calcul
      currentBalance: 0,
      insuredSalary,
      insuredSalaryCap: cap,
      salaryGrowthRate: 0,
    });

    // Le salaire coordonné utilisé pour la bonification doit être le
    // salaire d'entrée lui-même (64'260), pas 64'260 - 26'460 = 37'800.
    expect(projection.yearly[0].coordinated).toBe(insuredSalary);
  });

  it("capital projeté à 65 ans cohérent avec un salaire coordonné non re-déduit (cas réel 120k brut)", () => {
    const grossSalary = 120_000;
    const cap = 90_720;
    const insuredSalary = computeLppInsuredSalary(grossSalary, cap);

    const projection = projectLPP({
      currentAge: 35,
      retirementAge: 65,
      currentBalance: 50_000,
      insuredSalary,
      insuredSalaryCap: cap,
    });

    // Avant le correctif, ce calcul donnait ~319'266 CHF (salaire coordonné
    // utilisé : 37'800 au lieu de 64'260). Le capital correct (vérifié
    // ~397'640 CHF avec les hypothèses par défaut) est nettement plus
    // élevé — marge large pour ne pas dépendre exactement des hypothèses
    // de rendement par défaut, tout en restant un vrai garde-fou contre
    // une régression vers l'ancien calcul bugué.
    expect(projection.projectedBalance).toBeGreaterThan(370_000);
  });

  it("salaire coordonné nul (non assujetti) ne déclenche pas le plancher légal", () => {
    const projection = projectLPP({
      currentAge: 35,
      retirementAge: 40,
      currentBalance: 0,
      insuredSalary: 0,
      salaryGrowthRate: 0,
    });
    expect(projection.yearly[0].coordinated).toBe(0);
    expect(projection.yearly[0].credit).toBe(0);
  });
});
