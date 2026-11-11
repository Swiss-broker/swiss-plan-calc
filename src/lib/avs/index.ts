// Logique pure AVS/AI, calcul rente prévisionnelle (formule de rente
// légale, art. 34 LAVS).
//
// Limites connues :
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
 * Rente théorique complète (échelle 44, avant réduction pour années
 * manquantes) en fonction du revenu annuel moyen déterminant — formule
 * légale de l'art. 34 LAVS, celle dont découlent les tables de rentes
 * OFAS (échelle 44) :
 * - revenu ≤ 36 × rente mensuelle min : 74 % de la rente min + 13/600 du revenu ;
 * - au-delà : 104 % de la rente min + 8/600 du revenu ;
 * - plancher = rente min, plafond = 2 × rente min (atteint à 72 × rente min).
 *
 * Retourne la rente annuelle sur 12 mois (base de calcul des rentes pour
 * enfants, de survivants et AI) — la 13e rente de vieillesse n'est PAS
 * incluse ici, voir AvsPersonResult.thirteenthPension.
 */
export function theoreticalAnnualPension(averageAnnualIncome: number): number {
  const income = Math.max(0, averageAnnualIncome);
  const { hingeIncome, minMonthlyPension, maxMonthlyPension } = AVS_2026;
  const monthly =
    income <= hingeIncome
      ? 0.74 * minMonthlyPension + (13 / 600) * income
      : 1.04 * minMonthlyPension + (8 / 600) * income;
  return Math.min(maxMonthlyPension, Math.max(minMonthlyPension, monthly)) * 12;
}

/**
 * Supplément de carrière (art. 33 al. 3 LAVS, art. 54 RAVS) : quand le
 * risque (invalidité, décès) survient avant 45 ans, le revenu moyen de
 * l'activité lucrative est majoré d'un pourcentage dépendant de l'âge, pour
 * ne pas pénaliser une carrière salariale encore en début de progression.
 */
export function careerSupplementPct(ageAtEvent: number): number {
  if (ageAtEvent < 23) return 100;
  if (ageAtEvent === 23) return 90;
  if (ageAtEvent === 24) return 80;
  if (ageAtEvent === 25) return 70;
  if (ageAtEvent === 26) return 60;
  if (ageAtEvent === 27) return 50;
  if (ageAtEvent <= 29) return 40;
  if (ageAtEvent <= 31) return 30;
  if (ageAtEvent <= 34) return 20;
  if (ageAtEvent <= 38) return 10;
  if (ageAtEvent <= 44) return 5;
  return 0;
}

/** Année civile de départ à la retraite à l'âge de référence (AVS 21),
 *  unique pour toute l'app : fiche client, prestations consolidées et
 *  préremplissage du calculateur doivent tomber sur la même année. */
export function getReferenceRetirementYear(birthYear: number, gender?: Gender | null): number {
  return birthYear + Math.round(getReferenceAge(birthYear, gender));
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
  /** Années SANS activité professionnelle (ni cotisation AVS) à l'intérieur
   *  de la période contributionStartYear → retraite/départ — ex. arrivée en
   *  Suisse à 30 ans, 10 ans sur place mais seulement 5 ans réellement
   *  travaillés (5 ans de lacune). Distinct de missingYears (calculé, en
   *  sortie) : ce champ est une SAISIE qui réduit directement le nombre
   *  d'années effectives, donc l'échelle de rente. averageAnnualIncome doit
   *  rester le revenu moyen sur les seules années réellement travaillées —
   *  ne jamais le diluer sur la période totale. */
  careerGapYears?: number;
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
  /** Rente complète (échelle 44) sur 12 mois — base des rentes dérivées. */
  theoreticalAnnualPension: number;
  /** Rente réduite pour années manquantes, sur 12 mois (hors 13e rente). */
  reducedAnnualPension: number;
  monthlyPension: number;
  /** Total réellement versé par an : 12 mensualités + 13e rente pour une
   *  rente de vieillesse ; 12 mensualités pour une rente AI. */
  annualPension: number;
  /** Montant de la 13e rente de vieillesse (= une mensualité), 0 pour l'AI. */
  thirteenthPension: number;
  /** Bonus annuel ajouté au revenu déterminant (CHF) */
  bonificationsBonus: number;
  /** Revenu déterminant final utilisé pour le calcul */
  determiningIncome: number;
  /** Année effective d'arrêt des cotisations (départ ou retraite) */
  contributionEndYear: number;
}

/** Total annuel d'une rente de VIEILLESSE à partir de sa base 12 mois :
 *  12 mensualités + la 13e rente (un douzième de la rente annuelle). */
function withThirteenth(reducedAnnual: number): {
  monthlyPension: number;
  thirteenthPension: number;
  annualPension: number;
} {
  const extra = AVS_2026.oldAgePensionsPerYear - 12;
  const thirteenth = (reducedAnnual / 12) * extra;
  return {
    monthlyPension: Math.round(reducedAnnual / 12),
    thirteenthPension: Math.round(thirteenth),
    annualPension: Math.round(reducedAnnual + thirteenth),
  };
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
  // Lacune de cotisation à l'intérieur de la période (ex. coupure de
  // travail) : réduit directement les années effectives, jamais plus que
  // la durée brute elle-même.
  const gapYears = Math.max(0, Math.min(rawYears, input.careerGapYears ?? 0));
  const effectiveYears = Math.max(0, Math.min(fullContributionYears, rawYears - gapYears));
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
    ...withThirteenth(reduced),
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
  // Le plafond couple (art. 35 LAVS : 150 % de la rente max) porte sur les
  // rentes mensuelles ; la 13e rente suit ensuite chaque rente plafonnée.
  const sumBase = primary.reducedAnnualPension + spouse.reducedAnnualPension;
  const cap = AVS_2026.maxCoupleAnnualPension;

  if (sumBase <= cap) {
    const combined = primary.annualPension + spouse.annualPension;
    return {
      primary,
      spouse,
      combinedAnnualPension: combined,
      combinedMonthlyPension: primary.monthlyPension + spouse.monthlyPension,
      cappedCouple: false,
    };
  }

  // Plafonnement : réduction proportionnelle des deux rentes.
  const ratio = cap / sumBase;
  const cappedPerson = (p: AvsPersonResult): AvsPersonResult => {
    const base = p.reducedAnnualPension * ratio;
    return { ...p, reducedAnnualPension: Math.round(base), ...withThirteenth(base) };
  };
  const primaryCapped = cappedPerson(primary);
  const spouseCapped = cappedPerson(spouse);

  return {
    primary: primaryCapped,
    spouse: spouseCapped,
    combinedAnnualPension: withThirteenth(cap).annualPension,
    combinedMonthlyPension: Math.round(cap / 12),
    cappedCouple: true,
  };
}

export interface AiPensionInput {
  birthYear: number;
  gender?: Gender | null;
  /** Année de début de cotisation en Suisse */
  contributionStartYear: number;
  /** Année de survenance de l'invalidité (ou du décès) */
  eventYear: number;
  /** Revenu annuel moyen de l'activité lucrative (CHF) */
  averageAnnualIncome: number;
  careerGapYears?: number;
  educationalYears?: number;
  educationalShare?: number;
  assistanceYears?: number;
  assistanceShare?: number;
}

export interface AiPersonResult extends AvsPersonResult {
  /** Années que la classe d'âge de l'assuré devait cotiser jusqu'au risque. */
  cohortYears: number;
  /** Supplément de carrière appliqué au revenu (%, 0 dès 45 ans). */
  careerSupplementPct: number;
}

/**
 * Rente AI entière si l'invalidité survenait `eventYear` (art. 36 LAI,
 * mêmes règles de calcul que l'AVS). À la différence de la rente de
 * vieillesse, l'échelle ne compare PAS les années cotisées à 44 ans mais à
 * celles de la classe d'âge : un assuré de 35 ans sans lacune depuis ses
 * 21 ans touche une rente complète (échelle 44), pas 14/44 de rente. Seules
 * de vraies lacunes (arrivée tardive en Suisse, années non cotisées)
 * réduisent la rente. Pas de 13e rente pour l'AI.
 */
export function projectAiPension(input: AiPensionInput): AiPersonResult {
  const { minAnnualPension, maxDeterminingIncome } = AVS_2026;
  const cohortStartYear = input.birthYear + 21;
  const cohortYears = Math.max(1, input.eventYear - cohortStartYear);
  const rawYears = Math.max(0, input.eventYear - Math.max(input.contributionStartYear, cohortStartYear));
  const gapYears = Math.max(0, Math.min(rawYears, input.careerGapYears ?? 0));
  const contributedYears = Math.min(cohortYears, rawYears - gapYears);
  const reductionRatio = contributedYears / cohortYears;

  const supplementPct = careerSupplementPct(input.eventYear - input.birthYear);
  const eduYears = Math.max(0, input.educationalYears ?? 0);
  const eduShare = Math.max(0, Math.min(100, input.educationalShare ?? 100)) / 100;
  const assistYears = Math.max(0, input.assistanceYears ?? 0);
  const assistShare = Math.max(0, Math.min(100, input.assistanceShare ?? 100)) / 100;
  const careerYears = Math.max(1, contributedYears);
  const bonificationsBonus =
    (3 * minAnnualPension * (eduYears * eduShare + assistYears * assistShare)) / careerYears;

  const determining = Math.min(
    maxDeterminingIncome,
    Math.max(0, input.averageAnnualIncome) * (1 + supplementPct / 100) + bonificationsBonus,
  );
  const theo = theoreticalAnnualPension(determining);
  const reduced = theo * reductionRatio;

  return {
    effectiveYears: contributedYears,
    missingYears: cohortYears - contributedYears,
    cohortYears,
    reductionRatio,
    careerSupplementPct: supplementPct,
    theoreticalAnnualPension: Math.round(theo),
    reducedAnnualPension: Math.round(reduced),
    monthlyPension: Math.round(reduced / 12),
    annualPension: Math.round(reduced),
    thirteenthPension: 0,
    bonificationsBonus: Math.round(bonificationsBonus),
    determiningIncome: Math.round(determining),
    contributionEndYear: input.eventYear,
  };
}

export { AVS_2026 };
