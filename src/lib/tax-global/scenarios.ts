// Génère 3-5 scénarios comparés selon le profil détecté.
// Chaque scénario réutilise computeTaxGlobal avec un input modifié.

import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput, TaxGlobalResult } from "./types";
import { PILLAR_3A_MAX_2026_LPP } from "@/lib/tax/income";

export interface Scenario {
  id: string;
  label: string;
  description: string;
  result: TaxGlobalResult;
  deltaVsBaseline: number; // négatif = économie
}

export function buildScenarios(input: TaxGlobalInput): Scenario[] {
  const baselineResult = computeTaxGlobal(input);
  const baseTotal = baselineResult.totalTaxCHF;
  const out: Scenario[] = [
    {
      id: "baseline",
      label: "Situation actuelle",
      description: "Régime fiscal détecté à partir de la fiche client",
      result: baselineResult,
      deltaVsBaseline: 0,
    },
  ];

  // +3a maximum (si pas déjà max)
  const isMarried = input.civilStatus === "married";
  const maxPillar3a = isMarried ? PILLAR_3A_MAX_2026_LPP * 2 : PILLAR_3A_MAX_2026_LPP;
  if (input.pillar3aContributions < maxPillar3a) {
    const r = computeTaxGlobal({ ...input, pillar3aContributions: maxPillar3a });
    out.push({
      id: "pillar3a_max",
      label: `+3a max (${maxPillar3a.toLocaleString("fr-CH")} CHF)`,
      description: "Verser le 3e pilier A au plafond légal",
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // +Rachat LPP 20'000 illustratif
  const buybackTrial = 20_000;
  if (input.lppBuyback < buybackTrial) {
    const r = computeTaxGlobal({ ...input, lppBuyback: buybackTrial });
    out.push({
      id: "lpp_buyback_20k",
      label: `+Rachat LPP 20'000 CHF`,
      description: "Simulation d'un rachat LPP standard",
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // Permis C (si B/L actuel)
  if (input.permit === "B" || input.permit === "L") {
    const r = computeTaxGlobal({ ...input, permit: "C" });
    out.push({
      id: "permit_c",
      label: "Passage permis C",
      description: "Bascule en taxation ordinaire (fortune incluse)",
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // TOU explicite si éligibilité quasi-résident (et baseline = source)
  if (
    baselineResult.regime === "source_taxed" &&
    baselineResult.touEligibility?.eligibleForTOU
  ) {
    const ord = baselineResult.touComparison?.ordinaryTax ?? baseTotal;
    out.push({
      id: "tou",
      label: "Demande TOU (quasi-résident)",
      description: "Taxation ordinaire ultérieure avec déductions effectives",
      result: { ...baselineResult, totalTaxCHF: ord },
      deltaVsBaseline: ord - baseTotal,
    });
  }

  return out;
}
