// Module TOU (Taxation Ordinaire Ultérieure) / Quasi-résident
// Base : LIFD art. 99a/b, LHID art. 35a/b. Réforme entrée en vigueur 2021.

import { computeIncomeTax, type IncomeTaxInput } from "./income";

export interface QuasiResidentInput {
  /** Revenu mondial annuel (CHF) · Suisse + étranger */
  worldwideIncome: number;
  /** Revenu suisse imposable (CHF) */
  swissIncome: number;
  /** Pays de résidence (UE/AELE éligible TOU) */
  isEUEFTAResident: boolean;
}

export interface QuasiResidentResult {
  isQuasiResident: boolean;
  swissShare: number; // %
  meetsThreshold: boolean; // ≥ 90% revenus en CH
  eligibleForTOU: boolean;
  recommendation: string;
  notes: string[];
}

/** Vérifie l'éligibilité au statut quasi-résident (≥90% du revenu mondial en CH) */
export function checkQuasiResident(input: QuasiResidentInput): QuasiResidentResult {
  const swissShare =
    input.worldwideIncome > 0
      ? Math.round((input.swissIncome / input.worldwideIncome) * 1000) / 10
      : 0;
  const meetsThreshold = swissShare >= 90;
  const eligibleForTOU = meetsThreshold && input.isEUEFTAResident;

  let recommendation: string;
  if (!input.isEUEFTAResident) {
    recommendation =
      "Non éligible : la TOU est réservée aux résidents UE/AELE (accord libre circulation).";
  } else if (!meetsThreshold) {
    recommendation = `Non éligible : ${swissShare}% du revenu mondial en CH (seuil 90%).`;
  } else {
    recommendation =
      "Éligible à la TOU. Lancer le comparatif IS retenue vs taxation ordinaire pour décider.";
  }

  const notes: string[] = [
    "TOU = Taxation Ordinaire Ultérieure. Demande à déposer avant le 31 mars de l'année suivante.",
    "Le seuil de 90 % se calcule en additionnant tous les revenus mondiaux du contribuable (et conjoint).",
    "Une fois la TOU demandée, elle s'applique aux années suivantes jusqu'à fin de l'assujettissement à la source.",
  ];
  if (input.isEUEFTAResident && !meetsThreshold) {
    notes.push(
      "Sous le seuil ? Vérifier les déductions effectives : si elles dépassent les déductions forfaitaires de l'IS, la demande peut malgré tout être avantageuse (analyse au cas par cas par l'administration).",
    );
  }

  return {
    isQuasiResident: meetsThreshold,
    swissShare,
    meetsThreshold,
    eligibleForTOU,
    recommendation,
    notes,
  };
}

export interface TOUComparisonInput {
  /** Retenue à la source annuelle déjà prélevée (CHF) */
  sourceTaxAnnual: number;
  /** Paramètres pour calcul fiscal ordinaire */
  taxInput: IncomeTaxInput;
  /** Quasi-résident éligible */
  eligible: boolean;
}

export interface TOUComparisonResult {
  sourceTax: number;
  ordinaryTax: number;
  delta: number; // négatif = TOU avantageuse, remboursement
  recommendation: "tou" | "source" | "neutral";
  recommendationText: string;
  marginalRate: number;
  effectiveRateIS: number;
  effectiveRateTOU: number;
  potentialDeductionsImpact: string;
}

/** Compare l'impôt à la source vs TOU (taxation ordinaire post déductions effectives) */
export function compareTOUvsSource(input: TOUComparisonInput): TOUComparisonResult {
  const ordinary = computeIncomeTax(input.taxInput);
  const grossIncome = ordinary.grossIncome;

  const delta = ordinary.totalTax - input.sourceTax;
  const eRateIS = grossIncome > 0 ? Math.round((input.sourceTax / grossIncome) * 1000) / 10 : 0;
  const eRateTOU = grossIncome > 0 ? Math.round((ordinary.totalTax / grossIncome) * 1000) / 10 : 0;

  let recommendation: "tou" | "source" | "neutral";
  let recommendationText: string;
  if (!input.eligible) {
    recommendation = "source";
    recommendationText =
      "Non éligible TOU : conserver l'impôt à la source (situation par défaut).";
  } else if (delta < -200) {
    recommendation = "tou";
    recommendationText = `Demander la TOU : économie estimée CHF ${Math.abs(delta).toLocaleString("fr-CH")} (remboursement par l'administration).`;
  } else if (delta > 200) {
    recommendation = "source";
    recommendationText = `Conserver l'IS : la TOU coûterait CHF ${delta.toLocaleString("fr-CH")} de plus (déductions insuffisantes).`;
  } else {
    recommendation = "neutral";
    recommendationText = "Écart négligeable : la TOU n'apporte pas de gain significatif cette année.";
  }

  const deductionsTotal =
    ordinary.deductions.pillar3a +
    ordinary.deductions.lppBuyback +
    ordinary.deductions.mortgage +
    ordinary.deductions.realEstate;
  const potentialDeductionsImpact =
    deductionsTotal > 5_000
      ? `Vos déductions effectives (3a, rachats LPP, intérêts hypothécaires, entretien) totalisent CHF ${deductionsTotal.toLocaleString("fr-CH")} — c'est ce levier qui rend la TOU intéressante.`
      : "Peu de déductions à faire valoir : la TOU n'apporte pas de gain significatif sans intérêts d'emprunt, rachat LPP ou 3a important.";

  return {
    sourceTax: input.sourceTax,
    ordinaryTax: ordinary.totalTax,
    delta,
    recommendation,
    recommendationText,
    marginalRate: ordinary.marginalRate,
    effectiveRateIS: eRateIS,
    effectiveRateTOU: eRateTOU,
    potentialDeductionsImpact,
  };
}
