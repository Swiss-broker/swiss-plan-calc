// Orchestrateur, appelle les moteurs existants selon le régime détecté.
// AUCUN calcul n'est réécrit : on délègue à income/source/cross-border/tou/health-france.

import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { computeSourceTax, inferSourceScale, inferSourceRectification } from "@/lib/tax/source";
import { computeCrossBorder } from "@/lib/tax/cross-border";
import {
  checkQuasiResident,
  compareTOUvsSource,
  TOU_MANDATORY_GROSS_THRESHOLD,
  type QuasiResidentResult,
  type TOUComparisonResult,
} from "@/lib/tax/tou";
import { computeHealthFrance } from "@/lib/health-france";
import { detectRegime, toTaxStatus, toFrenchStatus, isCoupleStatus } from "./profile";
import type { TaxGlobalInput, TaxGlobalResult, Regime } from "./types";

/** Indépendant (ou activité mixte) : pas de certificat de salaire qui
 *  inclurait déjà les allocations familiales dans un salaire brut — c'est
 *  donc un revenu distinct à ajouter. Salarié : déjà comprises dans
 *  `grossSalary` (chiffre 1 du certificat de salaire, confirmé ESTV), donc
 *  jamais rajoutées (sinon double-comptage). */
export function isSelfEmployedStatus(ws: TaxGlobalInput["workStatus"]): boolean {
  return ws === "self_employed" || ws === "mixed";
}

/** Montant d'allocations familiales à ajouter au revenu imposable — 0 pour
 *  un salarié (déjà dans le salaire brut, voir `isSelfEmployedStatus`). */
function addableFamilyAllowances(g: TaxGlobalInput): number {
  return isSelfEmployedStatus(g.workStatus) ? g.familyAllowances || 0 : 0;
}

/** Revenu brut cash de référence (valeur locative exclue, c'est un revenu fictif).
 *  Exportée pour que l'écran du calculateur (accordéon "Revenu brut total")
 *  affiche exactement ce total, régime par régime, au lieu d'une somme
 *  recalculée à la main qui incluait le salaire du conjoint dès qu'il y a
 *  couple, sans tenir compte de son inclusion/exclusion selon le régime
 *  détecté (ex. exclu pour les frontaliers, gating sur spouseEmployed pour
 *  source/TOU) — deux totaux "revenu brut" différents sur le même écran. */
export function computeGrossForRegime(g: TaxGlobalInput, regime: Regime): number {
  const couple = isCoupleStatus(g.civilStatus);
  const familyAllowances = addableFamilyAllowances(g);
  switch (regime) {
    case "resident_ordinary":
      return (
        g.grossSalary +
        g.bonus +
        (couple ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome +
        familyAllowances
      );
    case "source_taxed":
    case "tou":
      return (
        g.grossSalary +
        g.bonus +
        (couple && g.spouseEmployed ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome +
        familyAllowances
      );
    case "cross_border_fr_1983":
      // Imposition commune du foyer en France : l'impôt affiché porte sur
      // les deux salaires du couple, le revenu de référence aussi (même
      // logique que le résident ordinaire).
      return (
        g.grossSalary +
        g.bonus +
        (couple ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome +
        familyAllowances
      );
    case "cross_border_ge":
    case "cross_border_other":
      return g.grossSalary + g.bonus + g.otherIncome + g.rentalIncome + familyAllowances;
    default:
      return g.grossSalary + g.bonus + g.otherIncome + g.rentalIncome + familyAllowances;
  }
}

/** Estimation rapide LAMal CH (résident) à partir des primes saisies.
 *  Utilisée uniquement pour le bloc santé frontalier ; pour le résident, on
 *  laisse 0 car les primes sont déjà déduites via `healthInsurancePremiums`.
 */
function estimateLamalCH(g: TaxGlobalInput): number {
  const couple = isCoupleStatus(g.civilStatus);
  const adults = couple ? 2 : 1;
  const adultAnnual = (g.lamalAdultMonthlyCHF || 0) * 12 * adults;
  const childAnnual = (g.lamalChildMonthlyCHF || 0) * 12 * g.children;
  return Math.round(adultAnnual + childAnnual);
}

export function toIncomeTaxInput(g: TaxGlobalInput): IncomeTaxInput {
  return {
    canton: g.canton,
    communalMultiplier: g.communalMultiplier,
    vsIndexationPercent: g.vsIndexationPercent,
    status: toTaxStatus(g.civilStatus, g.children),
    confession: g.confession,
    children: g.children,
    childrenAges: g.childrenAges,
    age: g.age,
    workStatus: g.workStatus,
    lppPlan: g.lppPlan,
    lppInsuredSalary: g.lppInsuredSalary,
    grossSalary: g.grossSalary + g.bonus,
    spouseGrossSalary: isCoupleStatus(g.civilStatus) ? g.spouseGrossSalary : 0,
    // Allocations familiales : ajoutées ici uniquement pour un indépendant
    // (addableFamilyAllowances renvoie 0 pour un salarié, déjà comprises
    // dans grossSalary — voir isSelfEmployedStatus).
    otherIncome: g.otherIncome + addableFamilyAllowances(g),
    rentalIncome: g.rentalIncome,
    imputedRent: g.imputedRent,
    pillar3aContributions: g.pillar3aContributions,
    lppBuyback: g.lppBuyback,
    mortgageInterest: g.mortgageInterest,
    realEstateMaintenance: g.realEstateMaintenance,
    // 3e pilier B : agrégé aux primes d'assurance déductibles (plafond canton/IFD)
    healthInsurancePremiums:
      (g.healthInsurancePremiums || 0) + (g.pillar3bContributions || 0) || undefined,
    childCareCosts: g.childCareCosts,
    commutingExpenses: g.commutingExpenses,
    mealExpenses: g.mealExpenses,
    professionalExpenses: g.professionalExpenses,
    secondaryActivityExpenses: g.secondaryActivityExpenses,
    healthInsuranceSubsidy: g.healthInsuranceSubsidy,
    rentalCharges: g.rentalCharges,
    donations: g.donations,
    medicalExpenses: g.medicalExpenses,
    netWealth: g.netWealth,
  };
}

function rate(num: number, base: number): number {
  return base > 0 ? Math.round((num / base) * 1000) / 10 : 0;
}

export function computeTaxGlobal(g: TaxGlobalInput): TaxGlobalResult {
  const det = detectRegime(g);
  const notes: string[] = [det.reason];
  if (g.civilStatus === "cohabiting") {
    notes.push(
      "Concubinage : imposition séparée en Suisse, chaque partenaire déclare seul (barème célibataire).",
    );
  }

  // Trace commune à tous les régimes
  const swissTotalIncome =
    g.grossSalary + g.bonus + g.spouseGrossSalary + g.otherIncome + g.rentalIncome;
  const worldwide = swissTotalIncome + g.foreignIncome;
  const baseTrace = {
    regimeReason: det.reason,
    detection: {
      canton: g.canton,
      permit: g.permit,
      countryOfResidence: g.countryOfResidence,
      swissShareOfWorldwide:
        worldwide > 0 ? Math.round((swissTotalIncome / worldwide) * 1000) / 10 : 100,
    },
  };
  const familyAllowancesCHF = g.familyAllowances || 0;
  const familyAllowancesIncludedInIncome = isSelfEmployedStatus(g.workStatus);
  if (familyAllowancesCHF > 0) {
    notes.push(
      familyAllowancesIncludedInIncome
        ? `Dont ${familyAllowancesCHF.toLocaleString("fr-CH")} CHF d'allocations familiales : ajoutées au revenu imposable (indépendant, pas de certificat de salaire qui les inclurait déjà).`
        : `Dont ${familyAllowancesCHF.toLocaleString("fr-CH")} CHF d'allocations familiales, déjà comprises dans le salaire brut saisi (chiffre 1 du certificat de salaire), non rajoutées.`,
    );
  }

  // ─────────────────────── RÉSIDENT ORDINAIRE ───────────────────────
  if (det.regime === "resident_ordinary") {
    const incomeTaxInput = toIncomeTaxInput(g);

    let income = computeIncomeTax(incomeTaxInput);

    // Progressivité avec revenu étranger (art. 7 LIFD / art. 6 LHID)
    // Le revenu étranger est exempté d'impôt CH mais retenu pour déterminer
    // le taux applicable au revenu suisse (méthode d'exemption avec réserve
    // de progressivité). On calcule l'impôt sur le revenu mondial, puis on
    // applique le taux effectif mondial uniquement sur le revenu suisse.
    if (g.foreignIncome > 0) {
      const grossSwiss = income.grossIncome;
      const grossWorldwide = grossSwiss + g.foreignIncome;
      // Impôt théorique sur revenu mondial (pour obtenir le taux progressif)
      const incomeWorldwide = computeIncomeTax({
        ...incomeTaxInput,
        grossSalary: incomeTaxInput.grossSalary + g.foreignIncome,
      });
      // Taux effectif mondial
      const worldwideEffectiveRate =
        grossWorldwide > 0 ? incomeWorldwide.totalTax / incomeWorldwide.grossIncome : 0;
      // Impôt recalculé : taux mondial × revenu suisse uniquement
      const taxWithProgressivity = Math.round(grossSwiss * worldwideEffectiveRate);
      // On remplace uniquement le totalTax et l'effectiveRate
      income = {
        ...income,
        totalTax: taxWithProgressivity,
        effectiveRate: grossSwiss > 0 ? (taxWithProgressivity / grossSwiss) * 100 : 0,
      };
      notes.push(
        "Revenu étranger de " +
          g.foreignIncome.toLocaleString("fr-CH") +
          " CHF pris en compte pour la progressivité (art. 7 LIFD). Taux effectif mondial " +
          (worldwideEffectiveRate * 100).toFixed(1) +
          "% appliqué sur le revenu suisse uniquement.",
      );
    }

    const gross = computeGrossForRegime(g, det.regime);
    const lamal = 0;
    if (g.imputedRent > 0) {
      notes.push(
        "Valeur locative incluse dans le revenu imposable (impôt) mais exclue du net cash affiché.",
      );
    }
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      income,
      totalTaxCHF: income.totalTax,
      socialChargesCHF: lamal,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - income.totalTax - lamal),
      swissShareCHF: income.totalTax,
      foreignShareCHF: 0,
      familyAllowancesCHF,
      familyAllowancesIncludedInIncome,
      effectiveRate: rate(income.totalTax, gross),
      marginalRate: income.marginalRate,
      notes,
      trace: {
        ...baseTrace,
        assumptions: [
          "Forfait frais professionnels = 3% du salaire net (min 2 000 / max 4 000 CHF)",
          "Forfait primes maladie cantonal 2026 si dispo, sinon forfait IFD (1 800 célib. / 3 600 marié / +700 par enfant)",
          "Plafond 3a affilié LPP : 7 258 CHF par contribuable",
          "Plafond AC 2026 : 148 200 CHF (au-delà : cotisation solidarité 0.5%)",
          "Bonifications LPP selon âge × salaire coordonné (part salarié = 50%)",
          `Multiplicateur communal : chef-lieu de ${g.canton} (commune non résolue)`,
          "Déduction enfant IFD : 6 700 CHF/enfant + rabais d'impôt 259 CHF/enfant",
        ],
        limits: [
          "Revenu étranger non inclus dans la progressivité (à reporter manuellement)",
          "Multiplicateur communal réel non utilisé (chef-lieu par défaut)",
          "Valeur locative incluse dans l'impôt mais exclue du net cash affiché",
          "Pas de prise en compte des dépenses de santé extraordinaires (art. 33 al. 1 let. h LIFD)",
        ],
      },
    };
  }

  // ─────────────────────── SOURCE / QUASI-RÉSIDENT ───────────────────────
  if (det.regime === "source_taxed" || det.regime === "tou") {
    const couple = isCoupleStatus(g.civilStatus);
    // Barème appliqué par l'employeur : A (non marié), B (marié, un
    // revenu) ou C (marié, deux revenus) — jamais H d'office. Les enfants
    // entrent d'office dans les barèmes B et C (B1, C2…, voir
    // computeSourceTax) ; une personne non mariée reste en A0 et n'obtient
    // le barème H que par rectification (voir plus bas).
    const statusForScale = toTaxStatus(g.civilStatus, 0);
    const scale = inferSourceScale(statusForScale, couple && g.spouseEmployed);
    const source = computeSourceTax({
      monthlyGross: Math.round((g.grossSalary + g.bonus) / 12),
      spouseMonthlyGross:
        couple && g.spouseEmployed ? Math.round(g.spouseGrossSalary / 12) : undefined,
      canton: g.canton,
      scale,
      children: g.children,
      church: g.confession !== "none",
    });

    // "Avant rectification" (barème par défaut, calculé ci-dessus) vs
    // "après rectification" (barème réellement attribué à la situation du
    // contribuable, voir inferSourceRectification) — pour matérialiser
    // visuellement, bouton par bouton, l'optimisation que représente la
    // démarche de rectification elle-même (indépendamment de la TOU).
    const rectification = inferSourceRectification(
      statusForScale,
      couple && g.spouseEmployed,
      g.children,
    );
    const rectifiedSource = rectification.rectificationApplicable
      ? computeSourceTax({
          monthlyGross: Math.round((g.grossSalary + g.bonus) / 12),
          spouseMonthlyGross:
            couple && g.spouseEmployed ? Math.round(g.spouseGrossSalary / 12) : undefined,
          canton: g.canton,
          scale: rectification.rectifiedScale,
          children: g.children,
          church: g.confession !== "none",
        })
      : null;
    const sourceRectification = {
      defaultScale: rectification.defaultScale,
      rectifiedScale: rectification.rectifiedScale,
      applicable: rectification.rectificationApplicable,
      reason: rectification.reason,
      defaultAnnualTax: source.annualTax,
      rectifiedAnnualTax: rectifiedSource ? rectifiedSource.annualTax : source.annualTax,
      delta: rectifiedSource ? rectifiedSource.annualTax - source.annualTax : 0,
    };

    const swissIncome =
      g.grossSalary + g.bonus + (couple ? g.spouseGrossSalary : 0) + g.otherIncome + g.rentalIncome;
    const worldwide = swissIncome + g.foreignIncome;
    const quasiResident = checkQuasiResident({
      worldwideIncome: worldwide,
      swissIncome,
      isEUEFTAResident: true,
    });
    // Résident en Suisse imposé à la source : la TOU sur demande est ouverte
    // sans condition de part de revenu suisse (art. 89a LIFD) — le seuil de
    // 90 % (quasi-résident, art. 99a LIFD) ne concerne que les non-résidents.
    // Elle devient obligatoire dès 120'000 CHF de salaire brut (art. 89 LIFD).
    const residentCH = (g.countryOfResidence || "CH").toUpperCase() === "CH";
    const touMandatory =
      residentCH &&
      (g.grossSalary + g.bonus >= TOU_MANDATORY_GROSS_THRESHOLD ||
        (couple && g.spouseEmployed && g.spouseGrossSalary >= TOU_MANDATORY_GROSS_THRESHOLD));
    const touEligibility: QuasiResidentResult = residentCH
      ? {
          ...quasiResident,
          eligibleForTOU: true,
          recommendation: touMandatory
            ? "Taxation ordinaire ultérieure obligatoire : salaire brut d'au moins 120 000 CHF (art. 89 LIFD)."
            : "Résident imposé à la source : la TOU peut être demandée jusqu'au 31 mars de l'année suivante, sans condition de part de revenu suisse. Le choix vaut ensuite pour toutes les années suivantes.",
        }
      : quasiResident;

    const touComparison = compareTOUvsSource({
      sourceTaxAnnual: source.annualTax,
      taxInput: toIncomeTaxInput(g),
      eligible: touEligibility.eligibleForTOU,
      mandatory: touMandatory,
    });

    // Total des déductions saisies par l'utilisateur (utilisé pour décider
    // si on doit basculer l'affichage sur le scénario ordinaire).
    const deductionsTotal =
      (g.pillar3aContributions || 0) +
      (g.lppBuyback || 0) +
      (g.mortgageInterest || 0) +
      (g.realEstateMaintenance || 0) +
      (g.healthInsurancePremiums || 0) +
      (g.childCareCosts || 0) +
      (g.donations || 0) +
      (g.medicalExpenses || 0) +
      (g.pillar3bContributions || 0);

    // Règle d'affichage : on prend le MIN entre source et ordinaire avec
    // déductions, peu importe l'éligibilité TOU. Le courtier veut voir
    // l'effet d'une déduction simulée même hors quasi-résident, la note
    // précise la démarche requise (TOU si éligible, rectification IS sinon).
    const useOrdinary = touMandatory || touComparison.ordinaryTax < source.annualTax;
    const total = useOrdinary ? touComparison.ordinaryTax : source.annualTax;
    if (touMandatory) {
      notes.push(
        `Salaire brut d'au moins ${TOU_MANDATORY_GROSS_THRESHOLD.toLocaleString("fr-CH")} CHF : taxation ordinaire ultérieure obligatoire (art. 89 LIFD). L'impôt à la source reste prélevé sur le salaire (${source.annualTax.toLocaleString("fr-CH")} CHF/an) puis imputé sur l'impôt ordinaire ; toutes les déductions (3e pilier A, rachat LPP, intérêts) s'appliquent sans démarche particulière.`,
      );
    } else if (useOrdinary && deductionsTotal > 0) {
      if (touEligibility.eligibleForTOU) {
        notes.push(
          `Affichage basé sur la TOU (taxation ordinaire avec déductions) car plus avantageuse. Démarche : déposer la demande TOU avant le 31 mars ${g.taxYear + 1}.`,
        );
      } else {
        notes.push(
          `Quasi-résident NON éligible (${touEligibility.swissShare}% du revenu mondial en CH, seuil 90%). Déductions appliquées ici uniquement via démarche de rectification IS auprès du canton, sans cette demande, la retenue source brute (${source.annualTax.toLocaleString("fr-CH")} CHF) s'applique.`,
        );
      }
    } else if (deductionsTotal > 0 && !useOrdinary) {
      notes.push(
        `Déductions saisies (${Math.round(deductionsTotal).toLocaleString("fr-CH")} CHF) insuffisantes pour battre la retenue source, IS conservée.`,
      );
    }
    const gross = computeGrossForRegime(g, det.regime);
    // Idem résident : pas d'estimation LAMal automatique pour source/TOU (résident CH).
    const lamal = 0;
    const marginal = useOrdinary ? touComparison.marginalRate : source.marginalRate;
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      source,
      touEligibility,
      touComparison,
      sourceRectification,
      totalTaxCHF: total,
      socialChargesCHF: lamal,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - total - lamal),
      swissShareCHF: total,
      foreignShareCHF: 0,
      familyAllowancesCHF,
      familyAllowancesIncludedInIncome,
      effectiveRate: rate(total, gross),
      marginalRate: marginal,
      notes,
      trace: {
        ...baseTrace,
        assumptions: [
          `Barème IS appliqué : ${source.scaleUsed} (conjoint actif : ${couple && g.spouseEmployed ? "oui" : "non"})${scale === "C" ? ", taux lu sur le salaire propre (le barème C intègre déjà un revenu théorique du conjoint)" : ""}`,
          "Impôt à la source mensuel × 12 (hors gratifications irrégulières)",
          touMandatory
            ? "Taxation ordinaire ultérieure obligatoire (salaire brut ≥ 120 000 CHF)"
            : touEligibility.eligibleForTOU
              ? residentCH
                ? "Résident imposé à la source : TOU possible sur demande (avant le 31 mars de l'année suivante)"
                : `Quasi-résident : ${baseTrace.detection.swissShareOfWorldwide}% du revenu mondial en CH → TOU possible`
              : `Quasi-résident non éligible (seuil 90% du revenu mondial en CH), déductions appliquées sur rectification IS uniquement`,
          touMandatory
            ? "Affichage : impôt ordinaire (taxation ordinaire ultérieure obligatoire)"
            : useOrdinary
            ? "Affichage : impôt ordinaire avec déductions (plus avantageux)"
            : "Affichage : impôt à la source (moins coûteux que l'ordinaire ici)",
          deductionsTotal > 0
            ? `Déductions saisies prises en compte : ${Math.round(deductionsTotal).toLocaleString("fr-CH")} CHF`
            : "Aucune déduction saisie",
        ],
        limits: [
          "Taux marginal IS = dérivée numérique de la courbe de barème (pas un vrai saut de palier officiel) : approximation, pas la valeur exacte de la table ESTV",
          "Bonus / 13e salaire annualisés via la part fixe, vérifier le mode de prélèvement employeur",
          "Pour appliquer les déductions, démarche administrative requise (TOU ou rectification IS)",
        ],
      },
    };
  }

  // ─────────────────────── FRONTALIER FR (GE ou accord 1983) ───────────────────────
  if (
    det.regime === "cross_border_ge" ||
    det.regime === "cross_border_fr_1983" ||
    det.regime === "cross_border_other"
  ) {
    const frStatus = toFrenchStatus(g.civilStatus);
    const couple = isCoupleStatus(g.civilStatus);
    const crossBorder = computeCrossBorder({
      workCanton: g.canton,
      grossAnnualSalary: g.grossSalary + g.bonus,
      status: frStatus,
      children: g.children,
      spouseEmployed: couple && g.spouseEmployed,
      spouseGrossSalary: couple ? g.spouseGrossSalary : 0,
      eurChfRate: g.eurChfRate,
      age: g.age,
      lppPlan: g.lppPlan,
      lppInsuredSalary: g.lppInsuredSalary,
      childrenUnder6: g.childrenAges?.some((a) => a != null)
        ? g.childrenAges.filter((a) => a != null && a < 6).length
        : undefined,
      // Avantages fiscaux français uniquement (crédit garde d'enfants,
      // réduction pour dons). 3e pilier A, rachat LPP et intérêts
      // hypothécaires n'ouvrent aucune déduction côté français.
      childCareCostsCHF: g.childCareCosts,
      donationsCHF: g.donations,
    });

    // Couche santé : CMU vs LAMal, SÉPARÉE de l'impôt
    const health = computeHealthFrance({
      swissGrossSalaryCHF: g.grossSalary + g.bonus,
      age: g.age,
      civilStatus: couple ? "married" : "single",
      childrenCount: g.children,
      chfToEurRate: g.chfToEurRate,
      taxYear: g.taxYear,
      lamalAdultMonthlyCHF: g.lamalAdultMonthlyCHF,
      lamalChildMonthlyCHF: g.lamalChildMonthlyCHF,
    });

    // === Pour GE / cross_border_other : comparer en permanence avec la TOU
    //     GE (taxation ordinaire CH avec déductions), pas seulement quand des
    //     déductions sont saisies — sans ça, le courtier ne voit JAMAIS le
    //     chiffre "si vous demandiez la TOU" et ne peut pas vérifier que
    //     l'app a bien pris en compte la possibilité d'une démarche.
    //     L'accord 1983 reste hors comparaison : imposition exclusive FR.
    const chOnlyDeductions =
      (g.pillar3aContributions || 0) +
      (g.lppBuyback || 0) +
      (g.realEstateMaintenance || 0) +
      (g.healthInsurancePremiums || 0) +
      (g.pillar3bContributions || 0);
    // Genève / Fribourg (taxation ordinaire possible via TOU) : toutes les
    // déductions de la déclaration ordinaire comptent, y compris les
    // intérêts hypothécaires de la résidence en France, premier levier TOU
    // d'un frontalier propriétaire. Accord 1983 : seules les déductions
    // purement suisses sont signalées comme sans effet.
    const chDeductionsTotal =
      det.regime === "cross_border_fr_1983"
        ? chOnlyDeductions
        : chOnlyDeductions +
          (g.mortgageInterest || 0) +
          (g.childCareCosts || 0) +
          (g.donations || 0) +
          (g.medicalExpenses || 0);
    let displayedCrossBorder = crossBorder;
    const cbNotes = [...crossBorder.notes];
    // touComparison : même objet, même formulation (recommendationText déjà
    // rédigé pour les 3 cas : avantageux / pas avantageux / négligeable) que
    // pour le régime source_taxed/tou plus haut — un seul endroit qui décide
    // comment expliquer "TOU oui/non", jamais deux textes qui divergent.
    let crossBorderTouComparison: TOUComparisonResult | undefined;
    let crossBorderTouEligibility: QuasiResidentResult | undefined;
    if (det.regime === "cross_border_ge" || det.regime === "cross_border_other") {
      const swissIncome =
        g.grossSalary +
        g.bonus +
        (couple ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome;
      const worldwide = swissIncome + g.foreignIncome;
      crossBorderTouEligibility = checkQuasiResident({
        worldwideIncome: worldwide,
        swissIncome,
        isEUEFTAResident: true,
      });
      crossBorderTouComparison = compareTOUvsSource({
        sourceTaxAnnual: crossBorder.swissTax,
        taxInput: toIncomeTaxInput(g),
        eligible: crossBorderTouEligibility.eligibleForTOU,
      });
      const ordinaryCH = crossBorderTouComparison.ordinaryTax;
      // Affichage du TOTAL retenu (totalTaxCHF) : toujours le MIN réel entre
      // source et ordinaire — c'est ce que le client paierait concrètement
      // en agissant au mieux, jamais un chiffre théorique. Le banc
      // d'explication ci-dessus (crossBorderTouComparison) reste visible
      // même quand ce n'est PAS avantageux, avec le pourquoi.
      if (chDeductionsTotal > 0 && ordinaryCH < crossBorder.swissTax) {
        const newTotal = ordinaryCH + crossBorder.foreignTax;
        displayedCrossBorder = {
          ...crossBorder,
          swissTax: ordinaryCH,
          swissRate: Math.round((ordinaryCH / (g.grossSalary + g.bonus)) * 1000) / 10,
          totalTax: newTotal,
          totalRate: Math.round((newTotal / (g.grossSalary + g.bonus)) * 1000) / 10,
          netAnnual: Math.round(g.grossSalary + g.bonus - newTotal),
          marginalRate: crossBorderTouComparison.marginalRate,
        };
      }
      if (chDeductionsTotal > 0) {
        cbNotes.push(crossBorderTouComparison.recommendationText);
      }
    }
    if (det.regime === "cross_border_fr_1983" && chDeductionsTotal > 0) {
      cbNotes.push(
        `Accord 1983 : imposition exclusive en France. Les déductions CH (3a, rachat LPP, primes LAMal, entretien immobilier CH) NE SONT PAS déductibles, saisie ignorée (${Math.round(chDeductionsTotal).toLocaleString("fr-CH")} CHF). Seuls les frais de garde (enfants de moins de 6 ans) et les dons ouvrent un avantage fiscal en France.`,
      );
    }

    const gross = computeGrossForRegime(g, det.regime);
    const totalTax = displayedCrossBorder.totalTax;
    const social = health.recommendedAnnualCHF;
    if (det.regime === "cross_border_ge") {
      cbNotes.push(
        "Part étrangère à 0 : le crédit d'impôt français neutralise l'impôt sur le salaire genevois. Si le foyer a d'autres revenus imposables en France (conjoint, loyers), ils y restent imposés au taux effectif (à valider avec la déclaration française).",
      );
    }
    if (
      g.otherIncome > 0 &&
      (det.regime === "cross_border_ge" || det.regime === "cross_border_other")
    ) {
      cbNotes.push(
        "Autres revenus suisses (" +
          g.otherIncome.toLocaleString("fr-CH") +
          " CHF : dividendes, revenus locatifs suisses) : non soumis à la retenue source mensuelle. Feront l'objet d'une rectification IS en fin d'année, un solde d'impôt supplémentaire sera probablement dû.",
      );
    }
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      crossBorder: displayedCrossBorder,
      health,
      touEligibility: crossBorderTouEligibility,
      touComparison: crossBorderTouComparison,
      totalTaxCHF: totalTax,
      socialChargesCHF: social,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - totalTax - social),
      swissShareCHF: displayedCrossBorder.swissTax,
      foreignShareCHF: displayedCrossBorder.foreignTax,
      familyAllowancesCHF,
      familyAllowancesIncludedInIncome,
      effectiveRate: rate(totalTax, gross),
      marginalRate: displayedCrossBorder.marginalRate,
      notes: [...notes, ...cbNotes],
      trace: {
        ...baseTrace,
        assumptions: [
          det.regime === "cross_border_fr_1983"
            ? "Accord franco-suisse 1983 : imposition du salaire en France uniquement, aucune retenue suisse sur le salaire (compensation de 4,5 % versée par la France au canton)"
            : det.regime === "cross_border_ge"
              ? "IS genevoise prélevée à la source + crédit d'impôt côté France"
              : "IS canton de travail + imposition pays de résidence (modèle générique)",
          `Taux EUR/CHF utilisé : ${g.eurChfRate.toFixed(4)} (CHF→EUR dérivé : ${g.chfToEurRate.toFixed(4)})`,
          "Santé : comparaison CMU vs LAMal sur base des primes mensuelles saisies",
          chDeductionsTotal > 0
            ? `Déductions CH saisies : ${Math.round(chDeductionsTotal).toLocaleString("fr-CH")} CHF, ${det.regime === "cross_border_fr_1983" ? "ignorées (accord 1983)" : "appliquées via TOU/rectification IS"}`
            : "Aucune déduction CH saisie",
        ],
        limits: [
          "Impôt français = estimation au barème 2026 (quotient familial plafonné, décote) ≠ avis d'imposition effectif",
          "Cotisations maladie (CMU ou LAMal frontalier), demi-part de parent isolé et autres revenus français non pris en compte",
          "Pas de calcul de la CSG/CRDS si affiliation FR partielle (statut mixte)",
          "Taux de change figé : volatilité EUR/CHF non simulée",
          det.regime === "cross_border_fr_1983"
            ? "Accord 1983 : déductions CH (3a, LPP, LAMal) totalement ignorées"
            : "GE/autre : déductions CH appliquées uniquement via démarche TOU ou rectification IS",
        ],
      },
    };
  }

  // ─────────────────────── INCONNU ───────────────────────
  return {
    regime: "unknown",
    regimeLabel: det.regimeLabel,
    totalTaxCHF: 0,
    socialChargesCHF: 0,
    grossIncomeCHF: 0,
    netAnnualCHF: 0,
    swissShareCHF: 0,
    foreignShareCHF: 0,
    familyAllowancesCHF: 0,
    familyAllowancesIncludedInIncome: false,
    effectiveRate: 0,
    marginalRate: 0,
    notes: [
      det.reason,
      "Précisez canton, permis et pays de résidence pour activer le calcul automatique.",
    ],
  };
}
