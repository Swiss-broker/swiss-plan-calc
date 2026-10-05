// Calcul global de l'impôt sur le revenu (IFD + ICC) pour une situation donnée.
// Combine `ifd.ts`, `cantons.ts` et applique les déductions standard suisses.

import { computeIFD, ifdMarginalRate, type FilingStatus } from "./ifd";
import {
  computeCantonalCommunal,
  computeWealthTax,
  CANTON_SCALES,
  type CCComputeResult,
} from "./cantons";
import { LPP_2026 } from "@/lib/lpp/parameters-2026";
import { lppCreditRate, computeLppInsuredSalary } from "@/lib/lpp";

export interface IncomeTaxInput {
  /** Code canton */
  canton: string;
  /** Surcharge facultative du multiplicateur communal (chef-lieu si non fourni) */
  communalMultiplier?: number;
  cantonalMultiplier?: number;
  /** VS uniquement : indexation communale réelle (%, ex. 166 pour 166%) —
   *  voir CCComputeOptions.vsIndexationPercent dans cantons.ts. Ignorée par
   *  les autres cantons. */
  vsIndexationPercent?: number;
  /** Statut civil */
  status: FilingStatus;
  confession?: "none" | "catholic" | "protestant" | "other";
  children?: number;
  /** Âge de chaque enfant. Utilisée uniquement par VS (déduction pour
   *  enfant dépendante de l'âge, Art. 31 al. 1 let. b LF) — ignorée par les
   *  autres cantons. */
  childrenAges?: Array<number | null>;
  /** Âge du contribuable (utilisé pour calculer la part salarié LPP). Défaut 40. */
  age?: number;
  /** Âge du conjoint (pour part salarié LPP conjoint). */
  spouseAge?: number;
  /** Plan LPP appliqué : obligatoire (plafond 90'720), cadres (sur-obligatoire jusqu'à ~362'880), 1e (jusqu'à 860'000). */
  lppPlan?: "mandatory" | "cadres" | "1e";
  /** Idem côté conjoint */
  spouseLppPlan?: "mandatory" | "cadres" | "1e";
  /** Salaire assuré LPP exact (certificat de prévoyance, fiche client) — si
   *  fourni, remplace l'estimation par formule pour fiabiliser la
   *  déduction de cotisation LPP. Voir estimateSocialContributions. */
  lppInsuredSalary?: number;
  /** Confession du conjoint (impacte la part paroissiale couple) */
  spouseConfession?: "none" | "catholic" | "protestant" | "other";

  // Revenus bruts
  grossSalary: number;
  spouseGrossSalary?: number;
  bonus?: number;
  otherIncome?: number;
  /** Loyer locatif (si bien immobilier loué) */
  rentalIncome?: number;
  /** Valeur locative (résidence principale si propriétaire) */
  imputedRent?: number;

  // Déductions individualisables
  /** Cotisations 3a versées dans l'année */
  pillar3aContributions?: number;
  /** Rachat LPP versé dans l'année */
  lppBuyback?: number;
  /** Frais professionnels effectifs (sinon forfait calculé) */
  professionalExpenses?: number;
  /** Trajets domicile-travail (CHF) */
  commutingExpenses?: number;
  /** Repas hors domicile (CHF) */
  mealExpenses?: number;
  /** Intérêts hypothécaires */
  mortgageInterest?: number;
  /** Frais d'entretien immobilier */
  realEstateMaintenance?: number;
  /** Primes d'assurance maladie + LCA */
  healthInsurancePremiums?: number;
  /** Frais de garde (CHF) · par enfant ouvert au max légal */
  childCareCosts?: number;
  /** Frais médicaux (au-delà de 5% du revenu net — IFD + ICC) */
  medicalExpenses?: number;
  /** Donations à but utilité publique */
  donations?: number;

  // Patrimoine
  netWealth?: number;
}

export interface IncomeTaxBreakdown {
  /** Revenu brut total */
  grossIncome: number;
  /** Total des déductions appliquées */
  totalDeductions: number;
  /** Revenu net imposable (ICC) */
  taxableIncomeCC: number;
  /** Revenu net imposable (IFD) · souvent identique mais peut différer */
  taxableIncomeIFD: number;
  /** Détails déductions */
  deductions: {
    avs: number;
    ac: number;
    anp: number;
    lpp: number;
    pillar3a: number;
    lppBuyback: number;
    professional: number;
    commuting: number;
    meals: number;
    mortgage: number;
    realEstate: number;
    healthInsurance: number;
    childCare: number;
    medical: number;
    donations: number;
    children: number;
    married: number;
  };
  // Impôts
  ifd: number;
  cantonal: number;
  communal: number;
  church: number;
  /** Impôt personnel (taxe per capita) — GE uniquement pour l'instant, 0 ailleurs. */
  personalTax: number;
  wealthTax: number;
  /** Détail des réductions cantonales spécifiques (ex. VS), affiché au courtier. */
  cantonSpecificNote?: string;
  totalIncomeTax: number;
  totalTax: number;
  /** Taux d'imposition effectif total */
  effectiveRate: number;
  /** Taux marginal global (IFD + ICC) */
  marginalRate: number;
  cantonalDetail: CCComputeResult;
}

// Plafonds 2026 (AFC + caisses LPP)
export const PILLAR_3A_MAX_2026_LPP = 7_258; // affilié à une LPP
export const PILLAR_3A_MAX_2026_NO_LPP = 36_288; // 20% du revenu, max
export const COMMUTING_MAX_FEDERAL_2026 = 3_300;
export const MEALS_FORFAIT_ANNUAL = 3_200;
export const PROFESSIONAL_FORFAIT_RATE = 0.03; // 3% du salaire net
export const PROFESSIONAL_FORFAIT_MIN = 2_000;
export const PROFESSIONAL_FORFAIT_MAX = 4_000;
/**
 * Plafond cantonal du forfait "frais professionnels", si différent du
 * plafond fédéral (PROFESSIONAL_FORFAIT_MAX) — voir le commentaire sur
 * `professionalCantonalCap` dans computeIncomeTax. Vide pour l'instant :
 * GE est identifié comme ayant un forfait différent (recoupement ESTV),
 * mais la formule exacte n'a pas pu être déterminée avec confiance à
 * partir d'un seul cas de référence. Ne pas remplir une valeur ici sans
 * l'avoir vérifiée contre au moins deux cas de référence officiels.
 */
export const PROFESSIONAL_FORFAIT_CANTONAL_CAP_2026: Record<string, number> = {};
/** Forfait fédéral assurance maladie (IFD) */
export const HEALTH_INSURANCE_MAX_SINGLE = 1_800;
export const HEALTH_INSURANCE_MAX_MARRIED = 3_600;
export const HEALTH_INSURANCE_PER_CHILD = 700;

/**
 * Forfaits cantonaux 2026 pour primes d'assurance-maladie + LCA (déduction
 * cantonale). Valeurs indicatives publiées par les administrations fiscales
 * cantonales, utilisées si l'utilisateur ne saisit pas ses primes réelles.
 * Format : { single, married, perChild }.
 */
/**
 * Corrigé le 05.10.2026 : l'ancienne table contenait des "valeurs
 * indicatives" par canton, inventées sans source citée. Remplacées par la
 * valeur STANDARD du calculateur officiel ESTV (swisstaxcalculator.estv.
 * admin.ch, notice "Erläuterungen zu den Steuerberechnungen") : "si vous ne
 * saisissez pas de valeurs individuelles, le calcul est effectué avec des
 * valeurs standard [...] CHF 4560 par adulte [...] CHF 1200 par enfant.
 * Source : Budget-conseil Suisse (budgetberatung.ch)". Vérifiée pour GE par
 * recoupement contre deux cas de référence ESTV (avec/sans enfant, même
 * salaire) : le calcul affiche bien -4'560 CHF (0 enfant) puis -5'760 CHF
 * (1 enfant) sous "Déduction des primes d'assurance maladie" cantonale,
 * SÉPARÉMENT du forfait fédéral (voir HEALTH_INSURANCE_MAX_SINGLE/MARRIED,
 * plus bas, confirmé correct par le même recoupement). Appliquée ici comme
 * valeur par défaut pour tous les cantons tant qu'un canton précis n'a pas
 * été vérifié individuellement contre un cas de référence — préférable à
 * l'ancienne table "indicative" sans source. married = 2 × single
 * (hypothèse : le forfait officiel est documenté "par adulte", pas de
 * cas de référence marié disponible pour confirmer l'absence de palier).
 */
const HEALTH_INSURANCE_CANTONAL_STANDARD_2026 = { single: 4_560, married: 9_120, perChild: 1_200 };
export const HEALTH_INSURANCE_CANTONAL_2026: Record<
  string,
  { single: number; married: number; perChild: number }
> = {
  GE: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  VD: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  VS: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  FR: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  NE: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  JU: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  BE: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  ZH: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  BS: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  BL: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
  TI: HEALTH_INSURANCE_CANTONAL_STANDARD_2026,
};
export const CHILDCARE_MAX_FEDERAL_2026 = 25_500;
// Cotisations sociales 2026 (parts salarié)
export const AVS_AI_APG_RATE = 0.053; // AVS 5.3% (AI/APG inclus dans le taux global salarié)
export const AC_RATE = 0.011; // 1.1% jusqu'au plafond AC
/** Cotisation de solidarité au-delà du plafond AC : supprimée (confirmé
 *  kmu.admin.ch, source SECO officielle). Gardée à 0 pour ne pas casser
 *  la formule ci-dessous si jamais réintroduite un jour par le législateur. */
export const AC_COMPLEMENTARY_RATE = 0;
export const AC_CEILING_2026 = 148_200; // Plafond AC 2026
/** Cotisation accidents non professionnels (ANP/LAA, part salarié) : 100% à
 *  charge de l'employé (contrairement aux accidents PROFESSIONNELS, à charge
 *  de l'employeur). Taux fixe 0.4% (ne dépend pas de la loi mais du contrat
 *  d'assurance de l'employeur — non indexé historiquement, confirmé par la
 *  notice officielle ESTV "Erläuterungen zu den Steuerberechnungen" :
 *  "Le montant de la contribution est fixé à 0,4 % (pas d'ajustement
 *  historique car cette valeur dépend du contrat et n'est pas exigée par la
 *  loi)"). Plafonné au salaire maximal LAA, identique au plafond AC.
 *  Ajoutée le 05.10.2026 : absente du moteur jusqu'ici, confirmée manquante
 *  par recoupement contre le calculateur officiel ESTV (320 CHF sur 80'000
 *  CHF brut = 0.4%, ligne "Cotisations pour les accidents non
 *  professionnels" systématiquement affichée par ESTV avant le revenu net). */
export const ANP_RATE = 0.004;
export const ANP_CEILING_2026 = AC_CEILING_2026;

/**
 * Estime les cotisations sociales déductibles part salarié (AVS/AI/APG + AC + LPP).
 * - AVS/AI/APG : 5.3% du salaire brut (sans plafond)
 * - AC : 1.1% jusqu'à 148'200 + 0.5% au-delà (cotisation de solidarité)
 * - LPP : bonification selon âge × salaire coordonné × 50% (part salarié)
 */
export function estimateSocialContributions(
  grossSalary: number,
  age: number = 40,
  plan: "mandatory" | "cadres" | "1e" = "mandatory",
  /** Salaire assuré exact (certificat de prévoyance), en CHF. Si fourni,
   *  remplace le salaire coordonné calculé par formule — sert à fiabiliser
   *  le calcul quand le courtier dispose de la vraie valeur de la fiche
   *  client plutôt que d'une estimation depuis le salaire brut. Plafonné au
   *  plafond légal du plan (une valeur au-delà serait incohérente avec le
   *  plan sélectionné). */
  insuredSalaryOverride?: number,
): { avs: number; ac: number; anp: number; lpp: number } {
  const avs = grossSalary * AVS_AI_APG_RATE;
  const acBase = Math.min(grossSalary, AC_CEILING_2026) * AC_RATE;
  const acComp = Math.max(0, grossSalary - AC_CEILING_2026) * AC_COMPLEMENTARY_RATE;
  const ac = acBase + acComp;
  const anp = Math.min(grossSalary, ANP_CEILING_2026) * ANP_RATE;

  // LPP : bonification (selon âge) × salaire coordonné, dont 50% part salarié.
  // Plafond du salaire assuré dépend du plan :
  //  - mandatory : LPP_2026.maxInsuredSalary (90'720)
  //  - cadres    : 4× plafond LPP, soit ~362'880 (sur-obligatoire courant)
  //  - 1e        : LPP_2026.oneEPlanCap (860'000)
  const planCap =
    plan === "1e"
      ? LPP_2026.oneEPlanCap
      : plan === "cadres"
        ? LPP_2026.maxInsuredSalary * 4
        : LPP_2026.maxInsuredSalary;
  // Réutilise la fonction officielle (source unique de vérité pour le salaire
  // coordonné, corrigée le [date] pour appliquer le seuil d'entrée LPP et le
  // plancher légal de 3'780 CHF), au lieu d'une formule dupliquée qui
  // oubliait ces deux règles.
  const coordinated =
    insuredSalaryOverride && insuredSalaryOverride > 0
      ? Math.min(insuredSalaryOverride, planCap)
      : computeLppInsuredSalary(grossSalary, planCap);
  const creditRate = lppCreditRate(age) || 0.1;
  const lppEmployerEmployee = coordinated * creditRate;
  const lpp = lppEmployerEmployee * 0.5;

  return { avs: Math.round(avs), ac: Math.round(ac), anp: Math.round(anp), lpp: Math.round(lpp) };
}

/**
 * Calcul complet impôt revenu + fortune pour une situation donnée.
 */
export function computeIncomeTax(input: IncomeTaxInput): IncomeTaxBreakdown {
  const isMarried = input.status === "married";
  const grossSalary = input.grossSalary ?? 0;
  const spouseSalary = isMarried ? (input.spouseGrossSalary ?? 0) : 0;
  const bonus = input.bonus ?? 0;
  const otherIncome = input.otherIncome ?? 0;
  const rental = input.rentalIncome ?? 0;
  const imputed = input.imputedRent ?? 0;

  const grossIncome = grossSalary + spouseSalary + bonus + otherIncome + rental + imputed;

  // Cotisations sociales obligatoires part salarié (déductibles à 100%)
  const social = estimateSocialContributions(
    grossSalary,
    input.age,
    input.lppPlan,
    input.lppInsuredSalary,
  );
  const spouseSocial = isMarried
    ? estimateSocialContributions(spouseSalary, input.spouseAge, input.spouseLppPlan)
    : { avs: 0, ac: 0, anp: 0, lpp: 0 };
  const avsTotal = social.avs + spouseSocial.avs;
  const acTotal = social.ac + spouseSocial.ac;
  const anpTotal = social.anp + spouseSocial.anp;
  const lppTotal = social.lpp + spouseSocial.lpp;

  // 3a (plafonné)
  const spouseHasLPP = isMarried && (input.spouseGrossSalary ?? 0) > 0;
  const pillar3aCap = isMarried
    ? PILLAR_3A_MAX_2026_LPP + (spouseHasLPP ? PILLAR_3A_MAX_2026_LPP : 0)
    : PILLAR_3A_MAX_2026_LPP;
  const pillar3a = Math.min(input.pillar3aContributions ?? 0, pillar3aCap);

  // Rachat LPP (entièrement déductible)
  const lppBuyback = input.lppBuyback ?? 0;

  // Frais professionnels (forfait fédéral IFD, art. 26 LIFD, confirmé exact
  // par recoupement ESTV) : 3% du salaire NET (brut - AVS - AC - ANP - LPP),
  // bornes 2'000 / 4'000.
  let professionalIFD = input.professionalExpenses ?? 0;
  if (!input.professionalExpenses) {
    const netSalary = Math.max(
      0,
      grossSalary + spouseSalary - avsTotal - acTotal - anpTotal - lppTotal,
    );
    const forfait = netSalary * PROFESSIONAL_FORFAIT_RATE;
    professionalIFD = Math.max(
      PROFESSIONAL_FORFAIT_MIN,
      Math.min(PROFESSIONAL_FORFAIT_MAX, forfait),
    );
  }
  // Forfait CANTONAL : identifié le 05.10.2026 comme DIFFÉRENT du fédéral
  // (recoupement ESTV GE : -1'817 CHF cantonal contre -2'156 CHF IFD pour le
  // même salaire net de 71'883 CHF) — mais la formule cantonale exacte
  // (taux ? plafond propre à GE ? base de calcul différente ?) n'a pas pu
  // être déterminée de façon fiable à partir d'un seul cas de référence.
  // Plutôt que de deviner un plafond et introduire une NOUVELLE valeur non
  // vérifiée, le forfait cantonal reprend pour l'instant le forfait IFD
  // (comportement historique, connu approximatif) — voir
  // PROFESSIONAL_FORFAIT_CANTONAL_CAP_2026 pour ajouter un canton vérifié.
  const professionalCantonalCap = PROFESSIONAL_FORFAIT_CANTONAL_CAP_2026[input.canton];
  const professional =
    professionalCantonalCap !== undefined && !input.professionalExpenses
      ? Math.min(professionalIFD, professionalCantonalCap)
      : professionalIFD;

  const commuting = Math.min(input.commutingExpenses ?? 0, COMMUTING_MAX_FEDERAL_2026);
  const meals = Math.min(input.mealExpenses ?? 0, MEALS_FORFAIT_ANNUAL);

  const mortgage = input.mortgageInterest ?? 0;
  const realEstate = input.realEstateMaintenance ?? 0;

  // Primes d'assurance maladie : CORRIGÉ le 05.10.2026 — le canton et la
  // Confédération ont des plafonds LÉGAUX DIFFÉRENTS pour cette déduction
  // (confirmé par recoupement ESTV : -4'560/-5'760 CHF côté canton GE contre
  // -1'800/-2'500 CHF côté IFD pour le même profil). Jusqu'ici le moteur
  // appliquait un seul plafond (le cantonal) aux deux bases imposables, ce
  // qui gonflait l'IFD. Les deux valeurs sont calculées séparément ;
  // `healthInsurance` (retourné dans `deductions`, pour l'affichage) reste
  // la valeur cantonale, c'est celle qui pèse le plus sur le total affiché.
  const cantonalForfait = HEALTH_INSURANCE_CANTONAL_2026[input.canton];
  const healthBaseCC = cantonalForfait
    ? isMarried
      ? cantonalForfait.married
      : cantonalForfait.single
    : isMarried
      ? HEALTH_INSURANCE_MAX_MARRIED
      : HEALTH_INSURANCE_MAX_SINGLE;
  const perChildCC = cantonalForfait ? cantonalForfait.perChild : HEALTH_INSURANCE_PER_CHILD;
  const healthChildrenCC = (input.children ?? 0) * perChildCC;
  const healthInsurance = input.healthInsurancePremiums
    ? Math.min(input.healthInsurancePremiums, healthBaseCC + healthChildrenCC)
    : healthBaseCC + healthChildrenCC;

  // Plafond fédéral (art. 33 al. 1 let. g LIFD), toujours le même quel que
  // soit le canton — confirmé exact par recoupement ESTV (1'800 single / 0
  // enfant, 2'500 = 1'800+700 avec 1 enfant).
  const healthBaseIFD = isMarried ? HEALTH_INSURANCE_MAX_MARRIED : HEALTH_INSURANCE_MAX_SINGLE;
  const healthChildrenIFD = (input.children ?? 0) * HEALTH_INSURANCE_PER_CHILD;
  const healthInsuranceIFD = input.healthInsurancePremiums
    ? Math.min(input.healthInsurancePremiums, healthBaseIFD + healthChildrenIFD)
    : healthBaseIFD + healthChildrenIFD;

  const childCare = Math.min(
    input.childCareCosts ?? 0,
    (input.children ?? 0) * CHILDCARE_MAX_FEDERAL_2026,
  );
  const donations = input.donations ?? 0;
  // Frais médicaux : déductibles au-delà de 5% du revenu net (IFD + ICC)
  const medicalThreshold = Math.round(grossIncome * 0.05);
  const medical = Math.max(0, (input.medicalExpenses ?? 0) - medicalThreshold);

  // Déductions sociales : appliquées à l'ICC via canton (children/married)
  const childrenDed = 0; // intégré au calcul cantonal
  const marriedDed = 0; // intégré au calcul cantonal

  const totalDeductions =
    avsTotal +
    acTotal +
    anpTotal +
    lppTotal +
    pillar3a +
    lppBuyback +
    professional +
    commuting +
    meals +
    mortgage +
    realEstate +
    healthInsurance +
    childCare +
    medical +
    donations;

  const taxableIncomeCC = Math.max(0, grossIncome - totalDeductions);
  // IFD : base séparée de l'ICC depuis le 05.10.2026 — reprend les mêmes
  // déductions que `totalDeductions` SAUF la prime maladie (plafond fédéral
  // différent du cantonal, voir healthInsuranceIFD ci-dessus).
  const totalDeductionsIFD =
    totalDeductions - healthInsurance + healthInsuranceIFD - professional + professionalIFD;
  // Déduction fédérale supplémentaire par enfant à charge (art. 35 LIFD),
  // corrigée le 05.10.2026 : 6'700 → 6'800 CHF/enfant (valeur 2026 indexée,
  // confirmée par recoupement ESTV) + rabais 263 CHF/enfant sur l'impôt
  // après calcul (barème, appliqué plus bas via ifdChildRebate).
  const IFD_CHILD_INCOME_DEDUCTION = 6_800;
  const ifdChildIncomeDed = (input.children ?? 0) * IFD_CHILD_INCOME_DEDUCTION;
  const taxableIncomeIFD = Math.max(0, grossIncome - totalDeductionsIFD - ifdChildIncomeDed);

  // IFD
  const ifdGross = computeIFD(taxableIncomeIFD, input.status);
  // Déduction par enfant IFD (rabais d'impôt)
  const ifdChildRebate = (input.children ?? 0) * 263; // CHF par enfant 2026 (rabais sur impôt, confirmé AFC)
  const ifd = Math.max(0, ifdGross - ifdChildRebate);

  const cc = computeCantonalCommunal({
    canton: input.canton,
    taxableIncome: taxableIncomeCC,
    status: input.status,
    children: input.children ?? 0,
    confession: input.confession,
    cantonalMultiplier: input.cantonalMultiplier,
    communalMultiplier: input.communalMultiplier,
    vsIndexationPercent: input.vsIndexationPercent,
    netWealth: input.netWealth ?? 0,
    childrenAges: input.childrenAges,
  });

  const wealthTax = computeWealthTax({
    canton: input.canton,
    netWealth: input.netWealth ?? 0,
    status: input.status,
    cantonalMultiplier: input.cantonalMultiplier,
    communalMultiplier: input.communalMultiplier,
  });

  const totalIncomeTax = ifd + cc.cantonal + cc.communal + cc.church + cc.personalTax;
  const totalTax = totalIncomeTax + wealthTax;
  const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
  const marginalRate = ifdMarginalRate(taxableIncomeIFD, input.status) + cc.marginalRate;

  return {
    grossIncome,
    totalDeductions,
    taxableIncomeCC,
    taxableIncomeIFD,
    deductions: {
      avs: avsTotal,
      ac: acTotal,
      anp: anpTotal,
      lpp: lppTotal,
      pillar3a,
      lppBuyback,
      professional,
      commuting,
      meals,
      mortgage,
      realEstate,
      healthInsurance,
      childCare,
      medical,
      donations,
      children: childrenDed,
      married: marriedDed,
    },
    ifd: Math.round(ifd * 100) / 100,
    cantonal: cc.cantonal,
    communal: cc.communal,
    church: cc.church,
    personalTax: cc.personalTax,
    wealthTax,
    cantonSpecificNote: cc.cantonSpecificNote,
    totalIncomeTax: Math.round(totalIncomeTax * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    marginalRate: Math.round(marginalRate * 100) / 100,
    cantonalDetail: cc,
  };
}

/** Compare deux scénarios (avant/après) et renvoie le delta */
export function compareScenarios(baseline: IncomeTaxBreakdown, scenario: IncomeTaxBreakdown) {
  return {
    deltaIFD: scenario.ifd - baseline.ifd,
    deltaCantonal: scenario.cantonal - baseline.cantonal,
    deltaCommunal: scenario.communal - baseline.communal,
    deltaChurch: scenario.church - baseline.church,
    deltaWealth: scenario.wealthTax - baseline.wealthTax,
    deltaTotal: scenario.totalTax - baseline.totalTax,
    /** Économie réalisée (positive si scénario > baseline réduit l'impôt) */
    savings: baseline.totalTax - scenario.totalTax,
  };
}

export { CANTON_SCALES };
