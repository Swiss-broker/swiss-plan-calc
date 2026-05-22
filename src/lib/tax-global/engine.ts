// Orchestrateur, appelle les moteurs existants selon le régime détecté.
// AUCUN calcul n'est réécrit : on délègue à income/source/cross-border/tou/health-france.

import { computeIncomeTax, type IncomeTaxInput } from "@/lib/tax/income";
import { computeSourceTax, inferSourceScale } from "@/lib/tax/source";
import { computeCrossBorder } from "@/lib/tax/cross-border";
import { checkQuasiResident, compareTOUvsSource } from "@/lib/tax/tou";
import { computeHealthFrance } from "@/lib/health-france";
import { detectRegime, toTaxStatus, toFrenchStatus, isCoupleStatus } from "./profile";
import type { TaxGlobalInput, TaxGlobalResult, Regime } from "./types";

/** Revenu brut cash de référence (valeur locative exclue, c'est un revenu fictif). */
function computeGrossForRegime(g: TaxGlobalInput, regime: Regime): number {
  const couple = isCoupleStatus(g.civilStatus);
  switch (regime) {
    case "resident_ordinary":
      return (
        g.grossSalary +
        g.bonus +
        (couple ? g.spouseGrossSalary : 0) +
        g.otherIncome +
        g.rentalIncome
      );
    case "source_taxed":
    case "tou":
      return (
        g.grossSalary +
        g.bonus +
        (couple && g.spouseEmployed ? g.spouseGrossSalary : 0)
      );
    case "cross_border_ge":
    case "cross_border_fr_1983":
    case "cross_border_other":
      return g.grossSalary + g.bonus;
    default:
      return g.grossSalary + g.bonus;
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
    status: toTaxStatus(g.civilStatus, g.children),
    confession: g.confession,
    children: g.children,
    age: g.age,
    grossSalary: g.grossSalary + g.bonus,
    spouseGrossSalary: isCoupleStatus(g.civilStatus) ? g.spouseGrossSalary : 0,
    otherIncome: g.otherIncome,
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
    donations: g.donations,
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


  // ─────────────────────── RÉSIDENT ORDINAIRE ───────────────────────
  if (det.regime === "resident_ordinary") {
    const income = computeIncomeTax(toIncomeTaxInput(g));
    const gross = computeGrossForRegime(g, det.regime);
    // Pas d'estimation LAMal automatique pour résident : les primes sont déjà
    // déductibles via `healthInsurancePremiums` (forfait cantonal). Afficher une
    // estimation séparée serait trompeur, laissé à 0, le net cash reste cohérent.
    const lamal = 0;
    if (g.foreignIncome > 0) {
      notes.push(
        "Revenu étranger : NON pris en compte dans ce calcul. À reporter manuellement en déclaration suisse pour la progressivité (méthode d'exemption avec réserve de progressivité).",
      );
    }
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
    const status = toTaxStatus(g.civilStatus, g.children);
    const couple = isCoupleStatus(g.civilStatus);
    const scale = inferSourceScale(status, couple && g.spouseEmployed);
    const source = computeSourceTax({
      monthlyGross: Math.round((g.grossSalary + g.bonus) / 12),
      spouseMonthlyGross:
        couple && g.spouseEmployed
          ? Math.round(g.spouseGrossSalary / 12)
          : undefined,
      canton: g.canton,
      scale,
      children: g.children,
      church: g.confession !== "none",
    });

    const swissIncome =
      g.grossSalary +
      g.bonus +
      (couple ? g.spouseGrossSalary : 0) +
      g.otherIncome +
      g.rentalIncome;
    const worldwide = swissIncome + g.foreignIncome;
    const touEligibility = checkQuasiResident({
      worldwideIncome: worldwide,
      swissIncome,
      isEUEFTAResident: true,
    });

    const touComparison = compareTOUvsSource({
      sourceTaxAnnual: source.annualTax,
      taxInput: toIncomeTaxInput(g),
      eligible: touEligibility.eligibleForTOU,
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
      (g.pillar3bContributions || 0);

    // Règle d'affichage : on prend le MIN entre source et ordinaire avec
    // déductions, peu importe l'éligibilité TOU. Le courtier veut voir
    // l'effet d'une déduction simulée même hors quasi-résident, la note
    // précise la démarche requise (TOU si éligible, rectification IS sinon).
    const useOrdinary = touComparison.ordinaryTax < source.annualTax;
    const total = useOrdinary ? touComparison.ordinaryTax : source.annualTax;
    if (useOrdinary && deductionsTotal > 0) {
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
    const marginal = useOrdinary ? touComparison.marginalRate : source.rate;
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      source,
      touEligibility,
      touComparison,
      totalTaxCHF: total,
      socialChargesCHF: lamal,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - total - lamal),
      swissShareCHF: total,
      foreignShareCHF: 0,
      effectiveRate: rate(total, gross),
      marginalRate: marginal,
      notes,
      trace: {
        ...baseTrace,
        assumptions: [
          `Barème IS appliqué : ${scale} (statut ${status}, conjoint actif: ${couple && g.spouseEmployed ? "oui" : "non"})`,
          "Impôt à la source mensuel × 12 (hors gratifications irrégulières)",
          touEligibility.eligibleForTOU
            ? `Quasi-résident : ${baseTrace.detection.swissShareOfWorldwide}% du revenu mondial en CH → TOU possible`
            : `Quasi-résident non éligible (seuil 90% du revenu mondial en CH), déductions appliquées sur rectification IS uniquement`,
          useOrdinary
            ? "Affichage : impôt ordinaire avec déductions (plus avantageux)"
            : "Affichage : impôt à la source (moins coûteux que l'ordinaire ici)",
          deductionsTotal > 0
            ? `Déductions saisies prises en compte : ${Math.round(deductionsTotal).toLocaleString("fr-CH")} CHF`
            : "Aucune déduction saisie",
        ],
        limits: [
          "Taux IS = taux moyen (le marginal réel dépend du barème détaillé)",
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
      // Déductions FR-éligibles uniquement (intérêts résidence FR, garde, dons).
      // Le 3e pilier A et le rachat LPP suisses ne sont pas déductibles côté FR.
      mortgageInterestCHF: g.mortgageInterest,
      childCareCostsCHF: g.childCareCosts,
      donationsCHF: g.donations,
    });

    // Couche santé : CMU vs LAMal, SÉPARÉE de l'impôt
    const health = computeHealthFrance({
      swissGrossSalaryCHF: g.grossSalary + g.bonus,
      civilStatus: couple ? "married" : "single",
      childrenCount: g.children,
      chfToEurRate: g.chfToEurRate,
      taxYear: g.taxYear,
      lamalAdultMonthlyCHF: g.lamalAdultMonthlyCHF,
      lamalChildMonthlyCHF: g.lamalChildMonthlyCHF,
    });

    // === Pour GE / cross_border_other : si déductions CH saisies, comparer
    //     avec la TOU GE (taxation ordinaire CH avec déductions).
    //     L'accord 1983 reste hors comparaison : imposition exclusive FR.
    const chDeductionsTotal =
      (g.pillar3aContributions || 0) +
      (g.lppBuyback || 0) +
      (g.realEstateMaintenance || 0) +
      (g.healthInsurancePremiums || 0) +
      (g.pillar3bContributions || 0);
    let displayedCrossBorder = crossBorder;
    const cbNotes = [...crossBorder.notes];
    if (
      (det.regime === "cross_border_ge" || det.regime === "cross_border_other") &&
      chDeductionsTotal > 0
    ) {
      const swissIncome =
        g.grossSalary + g.bonus + (couple ? g.spouseGrossSalary : 0) + g.otherIncome + g.rentalIncome;
      const worldwide = swissIncome + g.foreignIncome;
      const eligibleTou = worldwide > 0 ? swissIncome / worldwide >= 0.9 : true;
      const ordinaryCH = computeIncomeTax(toIncomeTaxInput(g));
      // Comparer impôt CH ordinaire (avec déductions) à l'impôt CH source actuel.
      if (ordinaryCH.totalTax < crossBorder.swissTax) {
        const newSwiss = ordinaryCH.totalTax;
        const newTotal = newSwiss + crossBorder.foreignTax;
        displayedCrossBorder = {
          ...crossBorder,
          swissTax: newSwiss,
          swissRate: Math.round((newSwiss / (g.grossSalary + g.bonus)) * 1000) / 10,
          totalTax: newTotal,
          totalRate: Math.round((newTotal / (g.grossSalary + g.bonus)) * 1000) / 10,
          netAnnual: Math.round((g.grossSalary + g.bonus) - newTotal),
          marginalRate: ordinaryCH.marginalRate,
        };
        cbNotes.push(
          eligibleTou
            ? `TOU GE applicable (${Math.round((swissIncome / Math.max(1, worldwide)) * 100)}% du revenu mondial en CH ≥ 90%) : déductions CH appliquées, économie suisse estimée ${Math.round(crossBorder.swissTax - newSwiss).toLocaleString("fr-CH")} CHF. Démarche : demander la TOU GE.`
            : `Déductions CH non automatiques (quasi-résident non éligible : ${Math.round((swissIncome / Math.max(1, worldwide)) * 100)}% < 90%). Affichage simulé ici, nécessite une rectification IS auprès de l'AFC pour s'appliquer réellement.`,
        );
      } else {
        cbNotes.push(
          "Déductions CH saisies insuffisantes pour battre la retenue source GE, IS GE conservée.",
        );
      }
    }
    if (det.regime === "cross_border_fr_1983" && chDeductionsTotal > 0) {
      cbNotes.push(
        `Accord 1983 : imposition exclusive en France. Les déductions CH (3a, rachat LPP, primes LAMal, entretien immobilier CH) NE SONT PAS déductibles, saisie ignorée (${Math.round(chDeductionsTotal).toLocaleString("fr-CH")} CHF). Seuls intérêts d'emprunt résidence FR, garde d'enfants et dons réduisent l'assiette française.`,
      );
    }

    const gross = computeGrossForRegime(g, det.regime);
    const totalTax = displayedCrossBorder.totalTax;
    const social = health.recommendedAnnualCHF;
    if (det.regime === "cross_border_ge") {
      cbNotes.push(
        "Part étrangère : estimation du résidu d'impôt français après crédit (à valider avec la déclaration FR effective).",
      );
    }
    return {
      regime: det.regime,
      regimeLabel: det.regimeLabel,
      crossBorder: displayedCrossBorder,
      health,
      totalTaxCHF: totalTax,
      socialChargesCHF: social,
      grossIncomeCHF: gross,
      netAnnualCHF: Math.max(0, gross - totalTax - social),
      swissShareCHF: displayedCrossBorder.swissTax,
      foreignShareCHF: displayedCrossBorder.foreignTax,
      effectiveRate: rate(totalTax, gross),
      marginalRate: displayedCrossBorder.marginalRate,
      notes: [...notes, ...cbNotes],
      trace: {
        ...baseTrace,
        assumptions: [
          det.regime === "cross_border_fr_1983"
            ? "Accord franco-suisse 1983 : imposition exclusive en France (canton retient 4.5% rétrocédés)"
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
          "Part étrangère = estimation du résidu d'impôt après crédit (≠ déclaration FR effective)",
          "Pas de prise en compte du quotient familial FR ni des charges de famille étendues",
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
    effectiveRate: 0,
    marginalRate: 0,
    notes: [
      det.reason,
      "Précisez canton, permis et pays de résidence pour activer le calcul automatique.",
    ],
  };
}
