// Génère 3-6 scénarios comparés selon le profil détecté.
// Chaque scénario réutilise computeTaxGlobal avec un input modifié.

import { computeTaxGlobal } from "./engine";
import { isCoupleStatus } from "./profile";
import type { TaxGlobalInput, TaxGlobalResult } from "./types";
import { PILLAR_3A_MAX_2026_LPP } from "@/lib/tax/income";

export interface Scenario {
  id: string;
  label: string;
  description: string;
  result: TaxGlobalResult;
  /** négatif = économie d'impôt, positif = surcoût */
  deltaVsBaseline: number;
  /** delta sur charges sociales (santé) */
  deltaSocialVsBaseline?: number;
}

export function buildScenarios(input: TaxGlobalInput): Scenario[] {
  const baselineResult = computeTaxGlobal(input);
  const baseTotal = baselineResult.totalTaxCHF;
  const baseSocial = baselineResult.socialChargesCHF;
  const regime = baselineResult.regime;
  const isFrAccord1983 = regime === "cross_border_fr_1983";
  const isFrontalier =
    regime === "cross_border_ge" ||
    regime === "cross_border_other" ||
    isFrAccord1983;

  const out: Scenario[] = [
    {
      id: "baseline",
      label: "Situation actuelle",
      description: "Régime fiscal détecté à partir de la fiche client",
      result: baselineResult,
      deltaVsBaseline: 0,
    },
  ];

  // ─── 3a max : seulement utile si le 3a est déductible côté CH ───
  // Frontalier accord 1983 : imposition exclusive en France → 3a CH n'est pas déductible.
  const couple = isCoupleStatus(input.civilStatus);
  const maxPillar3a = couple ? PILLAR_3A_MAX_2026_LPP * 2 : PILLAR_3A_MAX_2026_LPP;
  if (!isFrAccord1983 && input.pillar3aContributions < maxPillar3a) {
    const r = computeTaxGlobal({ ...input, pillar3aContributions: maxPillar3a });
    out.push({
      id: "pillar3a_max",
      label: `+3a max (${maxPillar3a.toLocaleString("fr-CH")} CHF)`,
      description: regime === "cross_border_ge"
        ? "Verser le 3a au plafond (déductible uniquement si TOU activée)"
        : "Verser le 3e pilier A au plafond légal",
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // ─── Rachat LPP : basé sur la capacité disponible (fiche client) ───
  // Si la fiche client renseigne une capacité de rachat (lpp_max_buyback),
  // on plafonne le scénario à cette capacité. Sinon, valeur d'illustration 20'000.
  const capacity = input.lppBuybackCapacity ?? 0;
  const buybackTrial = capacity > 0
    ? Math.min(20_000, Math.max(0, capacity - input.lppBuyback))
    : 20_000;
  if (!isFrAccord1983 && buybackTrial >= 1_000 && input.lppBuyback < input.lppBuyback + buybackTrial) {
    const r = computeTaxGlobal({ ...input, lppBuyback: input.lppBuyback + buybackTrial });
    const capacityLabel = capacity > 0
      ? ` (capacité dispo : ${Math.round(capacity).toLocaleString("fr-CH")} CHF)`
      : ` (montant d'illustration, capacité non renseignée)`;
    out.push({
      id: "lpp_buyback_trial",
      label: `+Rachat LPP ${Math.round(buybackTrial).toLocaleString("fr-CH")} CHF`,
      description: (regime === "cross_border_ge"
        ? "Rachat LPP supplémentaire (déductible uniquement si TOU activée)"
        : "Rachat LPP supplémentaire simulé") + capacityLabel,
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // ─── Don 5'000 CHF (résident ordinaire + TOU) ───
  if (regime === "resident_ordinary" || regime === "tou") {
    const donTrial = 5_000;
    const r = computeTaxGlobal({ ...input, donations: input.donations + donTrial });
    out.push({
      id: "donation_5k",
      label: `+Don 5'000 CHF`,
      description: "Don déductible (jusqu'à 20% du revenu net)",
      result: r,
      deltaVsBaseline: r.totalTaxCHF - baseTotal,
    });
  }

  // ─── Permis C (si B/L actuel) ───
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

  // ─── TOU explicite si éligibilité quasi-résident ───
  if (
    regime === "source_taxed" &&
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

  // ─── CMU vs LAMal (frontalier uniquement) ───
  if (isFrontalier && baselineResult.health) {
    const h = baselineResult.health;
    const otherAnnualCHF = h.recommended === "CMU" ? h.lamalAnnualCHF : h.cmuAnnualCHF;
    const otherLabel = h.recommended === "CMU" ? "LAMal" : "CMU";
    out.push({
      id: "health_switch",
      label: `Bascule ${otherLabel}`,
      description: `Comparaison directe avec l'autre option santé`,
      result: {
        ...baselineResult,
        socialChargesCHF: otherAnnualCHF,
        netAnnualCHF: Math.max(
          0,
          baselineResult.grossIncomeCHF - baseTotal - otherAnnualCHF,
        ),
      },
      deltaVsBaseline: 0,
      deltaSocialVsBaseline: otherAnnualCHF - baseSocial,
    });
  }

  return out;
}
