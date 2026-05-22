// Logique pure AVS/AI, calcul rente prévisionnelle.
// Approximation par paliers OFAS (formule de rente "65"), v1 simplifiée.
//
// Limites connues :
// - Bonifications pour tâches éducatives / d'assistance NON modélisées.
// - Splitting AVS pour couple : on calcule chaque rente individuellement
//   puis on applique le plafonnement couple au prorata. La vraie formule
//   officielle splitterait les revenus durant le mariage, approximation
//   suffisante pour un outil de planification (marge ±3% vs caisse).
//
// Référence : avoir une marge d'erreur acceptable et toujours afficher
// l'avertissement "demander un Extrait de Compte Individuel (CI)".

import { AVS_2026 } from "./parameters-2026";

export type Gender = "male" | "female" | "other";

/**
 * Âge de référence AVS21 selon genre + année de naissance.
 * - Homme : 65 ans.
 * - Femme née ≤ 1960 : 64 ans.
 * - Femme née 1961 : 64 + 3 mois → 64.25.
 * - Femme née 1962 : 64 + 6 mois → 64.5.
 * - Femme née 1963 : 64 + 9 mois → 64.75.
 * - Femme née ≥ 1964 : 65 ans.
 * - Autre / non renseigné : 65 ans (défaut).
 */
export function getReferenceAge(birthYear: number, gender?: Gender | null): number {
  if (gender === "female") {
    if (birthYear <= 1960) return 64;
    if (birthYear === 1961) return 64.25;
    if (birthYear === 1962) return 64.5;
    if (birthYear === 1963) return 64.75;
    return 65;
  }
  return 65;
}

/**
 * Rente théorique (avant réduction années manquantes) en fonction du
 * revenu annuel moyen revalorisé.
 *
 * Formule simplifiée à 2 segments inspirée de la formule de rente OFAS :
 * - Revenu ≤ minDeterminingIncome → rente min.
 * - Revenu ≥ maxDeterminingIncome → rente max.
 * - Entre min et hingeIncome (~60'480) : pente forte.
 * - Entre hinge et maxDetermining : pente douce.
 *
 * Retourne la rente annuelle complète (44 ans).
 */
export function theoreticalAnnualPension(averageAnnualIncome: number): number {
  const income = Math.max(0, averageAnnualIncome);
  const { minDeterminingIncome, maxDeterminingIncome, hingeIncome, minAnnualPension, maxAnnualPension } = AVS_2026;

  if (income <= minDeterminingIncome) return minAnnualPension;
  if (income >= maxDeterminingIncome) return maxAnnualPension;

  // Pente forte : 73% de la progression sur le 1er segment (min → hinge).
  const hingePension = minAnnualPension + 0.73 * (maxAnnualPension - minAnnualPension);

  if (income <= hingeIncome) {
    const t = (income - minDeterminingIncome) / (hingeIncome - minDeterminingIncome);
    return minAnnualPension + t * (hingePension - minAnnualPension);
  }
  const t = (income - hingeIncome) / (maxDeterminingIncome - hingeIncome);
  return hingePension + t * (maxAnnualPension - hingePension);
}

export interface AvsPersonInput {
  /** Année de naissance (ex: 1980) */
  birthYear: number;
  gender?: Gender | null;
  /** Année de début de cotisation en Suisse */
  contributionStartYear: number;
  /** Année de retraite envisagée */
  retirementYear: number;
  /** Revenu annuel moyen revalorisé sur la carrière (CHF) */
  averageAnnualIncome: number;
  /** Année de départ de Suisse prévue (arrête les cotisations avant la retraite) */
  departureYear?: number | null;
  /** Bonifications pour tâches éducatives : nombre d'années avec enfant <16 ans */
  educationalYears?: number;
  /** Pourcentage attribué (0..100), 50% si conjoint actif, sinon 100% */
  educationalShare?: number;
  /** Bonifications pour tâches d'assistance : nombre d'années */
  assistanceYears?: number;
  /** Pourcentage attribué (0..100) */
  assistanceShare?: number;
}

export interface AvsCoupleInput {
  status: "single" | "married" | "registered_partnership" | "divorced" | "widowed" | "separated";
  primary: AvsPersonInput;
  spouse?: AvsPersonInput;
}

export interface AvsPersonResult {
  effectiveYears: number;
  missingYears: number;
  reductionRatio: number; // 0..1
  theoreticalAnnualPension: number;
  reducedAnnualPension: number;
  monthlyPension: number;
  annualPension: number;
  /** Bonus annuel ajouté au revenu déterminant (CHF) */
  bonificationsBonus: number;
  /** Revenu déterminant final utilisé pour le calcul */
  determiningIncome: number;
  /** Année effective d'arrêt des cotisations (départ ou retraite) */
  contributionEndYear: number;
}

export interface AvsProjection {
  primary: AvsPersonResult;
  spouse?: AvsPersonResult;
  combinedAnnualPension?: number;
  combinedMonthlyPension?: number;
  cappedCouple: boolean;
}

function computePerson(input: AvsPersonInput): AvsPersonResult {
  const { fullContributionYears, minAnnualPension, maxDeterminingIncome } = AVS_2026;
  const endYear = input.departureYear && input.departureYear < input.retirementYear
    ? input.departureYear
    : input.retirementYear;
  const rawYears = endYear - input.contributionStartYear;
  const effectiveYears = Math.max(0, Math.min(fullContributionYears, rawYears));
  const missingYears = Math.max(0, fullContributionYears - effectiveYears);
  const reductionRatio = effectiveYears / fullContributionYears;

  // Bonifications éducatives + assistance : 3 × rente min × années × part
  const eduYears = Math.max(0, input.educationalYears ?? 0);
  const eduShare = Math.max(0, Math.min(100, input.educationalShare ?? 100)) / 100;
  const assistYears = Math.max(0, input.assistanceYears ?? 0);
  const assistShare = Math.max(0, Math.min(100, input.assistanceShare ?? 100)) / 100;
  const totalCareerYears = Math.max(1, effectiveYears);
  // Bonus annualisé = somme bonifications / années de carrière (revenu moyen)
  const eduBonus = (3 * minAnnualPension * eduYears * eduShare) / totalCareerYears;
  const assistBonus = (3 * minAnnualPension * assistYears * assistShare) / totalCareerYears;
  const bonificationsBonus = eduBonus + assistBonus;

  const determining = Math.min(
    maxDeterminingIncome,
    input.averageAnnualIncome + bonificationsBonus,
  );
  const theo = theoreticalAnnualPension(determining);
  const reduced = theo * reductionRatio;

  return {
    effectiveYears,
    missingYears,
    reductionRatio,
    theoreticalAnnualPension: Math.round(theo),
    reducedAnnualPension: Math.round(reduced),
    annualPension: Math.round(reduced),
    monthlyPension: Math.round(reduced / 12),
    bonificationsBonus: Math.round(bonificationsBonus),
    determiningIncome: Math.round(determining),
    contributionEndYear: endYear,
  };
}

export function projectAvsPension(input: AvsCoupleInput): AvsProjection {
  const primary = computePerson(input.primary);
  const isCouple =
    (input.status === "married" || input.status === "registered_partnership") &&
    !!input.spouse;

  if (!isCouple || !input.spouse) {
    return { primary, cappedCouple: false };
  }

  const spouse = computePerson(input.spouse);
  const sum = primary.annualPension + spouse.annualPension;
  const cap = AVS_2026.maxCoupleAnnualPension;

  if (sum <= cap) {
    return {
      primary,
      spouse,
      combinedAnnualPension: sum,
      combinedMonthlyPension: Math.round(sum / 12),
      cappedCouple: false,
    };
  }

  // Plafonnement : réduction proportionnelle des deux rentes.
  const ratio = cap / sum;
  const primaryCapped: AvsPersonResult = {
    ...primary,
    annualPension: Math.round(primary.annualPension * ratio),
    monthlyPension: Math.round((primary.annualPension * ratio) / 12),
    reducedAnnualPension: Math.round(primary.annualPension * ratio),
  };
  const spouseCapped: AvsPersonResult = {
    ...spouse,
    annualPension: Math.round(spouse.annualPension * ratio),
    monthlyPension: Math.round((spouse.annualPension * ratio) / 12),
    reducedAnnualPension: Math.round(spouse.annualPension * ratio),
  };

  return {
    primary: primaryCapped,
    spouse: spouseCapped,
    combinedAnnualPension: cap,
    combinedMonthlyPension: Math.round(cap / 12),
    cappedCouple: true,
  };
}

export { AVS_2026 };
