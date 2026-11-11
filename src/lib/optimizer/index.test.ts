import { describe, expect, it } from "vitest";
import { runOptimizer } from "./index";

describe("runOptimizer — statut TOU traité comme source_taxed pour l'avertissement", () => {
  it("affiche un avertissement sur le rachat LPP suggéré pour un client 'tou' (TOU pas encore demandée)", () => {
    const optimizations = runOptimizer({
      taxInput: { canton: "GE", status: "single", grossSalary: 120_000 },
      taxStatus: "tou",
      lppBuybackCapacity: 50_000,
    });
    const lppBuyback = optimizations.find((o) => o.id === "lpp-buyback");
    expect(lppBuyback).toBeDefined();
    // Avant correctif : "tou" n'était jamais reconnu par isSource/isCrossBorder
    // (seule deductionsAreAutomatic() le gérait, mais elle n'était jamais
    // appelée — void deductionsAreAutomatic). Le courtier voyait une économie
    // présentée comme acquise alors qu'elle est nulle tant que la demande
    // TOU n'est pas déposée.
    expect(lppBuyback!.warning).toBeDefined();
    expect(lppBuyback!.warning!.title).toContain("non automatique");
  });

  it("n'affiche aucun avertissement pour un résident ordinaire", () => {
    const optimizations = runOptimizer({
      taxInput: { canton: "GE", status: "single", grossSalary: 120_000 },
      taxStatus: "resident",
      lppBuybackCapacity: 50_000,
    });
    const lppBuyback = optimizations.find((o) => o.id === "lpp-buyback");
    expect(lppBuyback?.warning).toBeUndefined();
  });
});

describe("runOptimizer — cohérence avec le régime fiscal", () => {
  it("frontalier accord 1983 : aucune économie suisse suggérée (imposé en France uniquement)", () => {
    const optimizations = runOptimizer({
      taxInput: { canton: "VD", status: "single", grossSalary: 150_000 },
      taxStatus: "cross_border_fr_1983",
      lppBuybackCapacity: 80_000,
      hasLPP: true,
    });
    expect(optimizations.filter((o) => ["lpp", "3a", "canton"].includes(o.category))).toEqual([]);
  });

  it("à 2 ans de la retraite : une seule suggestion de rachat, étalée sur 2 ans (pas de double comptage)", () => {
    const optimizations = runOptimizer({
      taxInput: { canton: "GE", status: "single", grossSalary: 120_000 },
      taxStatus: "resident",
      lppBuybackCapacity: 60_000,
      age: 63,
    });
    const lpp = optimizations.filter((o) => o.category === "lpp");
    expect(lpp).toHaveLength(1);
    expect(lpp[0].title).toContain("2 ans");
    expect(lpp[0].details!.versementAnnuel).toBe(30_000);
  });
});
