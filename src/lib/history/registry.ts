// Registry: mappe chaque type de simulation à ses KPIs (pour comparaison)
// et à sa fonction de regénération PDF.
import type { HistoryKpi, SimulationKind } from "./types";

type SummaryShape = Record<string, unknown>;
type InputsShape = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

/**
 * Extrait des KPIs comparables (toujours dans le même ordre par kind).
 */
export function extractKpis(kind: SimulationKind, summary: SummaryShape): HistoryKpi[] {
  switch (kind) {
    case "income_tax":
      return [
        { label: "Impôt total", value: num(summary.totalTax), unit: "CHF" },
        { label: "Taux effectif", value: Number(num(summary.effectiveRate).toFixed(2)), unit: "%" },
        { label: "Taux marginal", value: Number(num(summary.marginalRate).toFixed(2)), unit: "%" },
        { label: "Revenu imposable", value: num(summary.taxableIncomeCC), unit: "CHF" },
        { label: "IFD", value: num(summary.ifd), unit: "CHF" },
        { label: "Cantonal+communal", value: num(summary.cantonal) + num(summary.communal), unit: "CHF" },
      ];
    case "source_tax":
      return [
        { label: "Taux appliqué", value: Number(num(summary.rate).toFixed(2)), unit: "%" },
        { label: "Impôt mensuel", value: num(summary.monthlyTax), unit: "CHF" },
        { label: "Impôt annuel", value: num(summary.annualTax), unit: "CHF" },
      ];
    case "lpp":
      return [
        { label: "Capital projeté (net)", value: num(summary.projectedBalance), unit: "CHF" },
        { label: "Rente annuelle", value: num(summary.annualPension), unit: "CHF" },
        { label: "Rente mensuelle", value: num(summary.monthlyPension), unit: "CHF" },
        { label: "Frais cumulés", value: num(summary.totalFees), unit: "CHF" },
        { label: "Économie rachats", value: num(summary.totalTaxSavings), unit: "CHF" },
      ];
    case "pillar3a":
      return [
        { label: "Économie d'impôt", value: num(summary.taxSavings), unit: "CHF" },
        { label: "Coût net", value: num(summary.effectiveCost), unit: "CHF" },
        { label: "Capital final", value: num(summary.finalBalance), unit: "CHF" },
        { label: "Économie retrait étalé", value: num(summary.staggeredSavings), unit: "CHF" },
      ];
    case "retirement":
      return [
        { label: "Net rente", value: num(summary.netAnnuity), unit: "CHF" },
        { label: "Net capital", value: num(summary.netLumpSum), unit: "CHF" },
        { label: "Impôt unique", value: num(summary.lumpTaxTotal), unit: "CHF" },
        { label: "Recommandation", value: String(summary.recommendation ?? "—") },
      ];
    case "canton_compare":
      return [
        { label: "Canton le moins cher", value: String(summary.cheapestCanton ?? "—") },
        { label: "Impôt min", value: num(summary.cheapestTax), unit: "CHF" },
        { label: "Canton réf.", value: String(summary.referenceCanton ?? "—") },
        { label: "Impôt réf.", value: num(summary.referenceTax), unit: "CHF" },
        { label: "Économie possible", value: num(summary.maxSavings), unit: "CHF" },
      ];
    case "investment_compare":
      return [
        { label: "Différence nette", value: num(summary.netDifference), unit: "CHF" },
        { label: "Avantage", value: Number(num(summary.pctAdvantage).toFixed(2)), unit: "%" },
        { label: "Net A", value: num(summary.aFinalNet), unit: "CHF" },
        { label: "Net B", value: num(summary.bFinalNet), unit: "CHF" },
        { label: "Gagnant", value: String(summary.winner ?? "—") },
      ];
    case "avs_ai":
      return [
        { label: "Rente mensuelle", value: num(summary.monthlyPension), unit: "CHF" },
        { label: "Rente annuelle", value: num(summary.annualPension), unit: "CHF" },
        { label: "Années cotisées", value: num(summary.effectiveYears) },
        { label: "Années manquantes", value: num(summary.missingYears) },
      ];
    case "vested_benefits":
      return [
        { label: "Stratégie recommandée", value: String(summary.recommendedStrategy ?? "—") },
        { label: "Capital final (recommandé)", value: num(summary.recommendedFinalBalance), unit: "CHF" },
        { label: "Écart vs sécurité", value: num(summary.gainVsSecurity), unit: "CHF" },
        { label: "Années jusqu'à la retraite", value: num(summary.yearsToRetirement) },
      ];
    case "cross_border":
      return [
        { label: "Régime", value: String(summary.regimeLabel ?? "—") },
        { label: "Net annuel", value: num(summary.netAnnual), unit: "CHF" },
        { label: "Impôt total", value: num(summary.totalTax), unit: "CHF" },
        { label: "Taux global", value: Number(num(summary.totalRate).toFixed(2)), unit: "%" },
      ];
    case "tou":
      return [
        { label: "Éligible TOU", value: String(summary.eligibleForTOU ? "Oui" : "Non") },
        { label: "Part suisse", value: Number(num(summary.swissShare).toFixed(2)), unit: "%" },
        { label: "Économie TOU", value: num(summary.touSaving), unit: "CHF" },
        { label: "Recommandation", value: String(summary.recommendation ?? "—") },
      ];
    case "director_compensation":
      return [
        { label: "Stratégie recommandée", value: String(summary.recommendedLabel ?? "—") },
        { label: "Net dirigeant (reco.)", value: num(summary.recommendedDirectorNet), unit: "CHF" },
        { label: "Net actuel", value: num(summary.currentDirectorNet), unit: "CHF" },
        { label: "Gain annuel", value: num(summary.gainAnnual), unit: "CHF" },
      ];
    case "health_insurance_france":
      return [
        { label: "Option recommandée", value: summary.recommended === "LAMAL" ? "LAMal (Suisse)" : "CMU (France)" },
        { label: "Cotisation annuelle", value: num(summary.recommendedAnnualCHF), unit: "CHF" },
        { label: "Économie vs autre option", value: num(summary.savingsCHF), unit: "CHF" },
        { label: "RFR estimé (EUR)", value: num(summary.rfrEUR) },
      ];
    case "overtime":
      return [
        { label: "Économie fiscale", value: num(summary.taxSavingsCHF ?? summary.taxSavings), unit: "CHF" },
        { label: "Salaire exonéré (CHF)", value: num(summary.exemptSalaryRetainedCHF), unit: "CHF" },
        { label: "Heures exonérées", value: num(summary.exemptHoursRetained) },
        { label: "Heures annuelles", value: num(summary.annualHours) },
      ];
    case "tax_global":
      return [
        { label: "Impôt total", value: num(summary.totalTaxCHF), unit: "CHF" },
        { label: "Net annuel", value: num(summary.netAnnualCHF), unit: "CHF" },
        { label: "Taux effectif", value: Number(num(summary.effectiveRate).toFixed(2)), unit: "%" },
        { label: "Taux marginal", value: Number(num(summary.marginalRate).toFixed(2)), unit: "%" },
        { label: "Régime", value: String(summary.regimeLabel ?? summary.regime ?? "—") },
        { label: "Économie optimisations", value: num(summary.bestScenarioSavings), unit: "CHF" },
      ];
    case "fx_claim":
      return [
        { label: "Écart en faveur du client", value: num(summary.totalDeltaChf), unit: "CHF" },
        { label: "Économie d'impôt estimée", value: num(summary.estimatedTaxRefund), unit: "CHF" },
        { label: "CHF retenu (AFC)", value: num(summary.totalChfAfc), unit: "CHF" },
        { label: "CHF réel (marché)", value: num(summary.totalChfMarket), unit: "CHF" },
      ];
  }
}

/**
 * Regénère le PDF à partir des inputs sauvegardés en réinjectant le calcul.
 * Imports dynamiques pour ne pas alourdir le bundle initial.
 */
export async function regeneratePdf(
  kind: SimulationKind,
  inputs: InputsShape,
  brokerEmail: string | undefined,
): Promise<void> {
  const header = { brokerEmail };
  switch (kind) {
    case "income_tax": {
      const [{ computeIncomeTax }, { exportIncomeTaxPdf }] = await Promise.all([
        import("@/lib/tax/income"),
        import("@/lib/pdf/reports"),
      ]);
      const result = computeIncomeTax(inputs as unknown as Parameters<typeof computeIncomeTax>[0]);
      exportIncomeTaxPdf({ header, input: inputs as unknown as Parameters<typeof exportIncomeTaxPdf>[0]["input"], result });
      return;
    }
    case "source_tax": {
      const [{ computeSourceTax }, { exportSourceTaxPdf }] = await Promise.all([
        import("@/lib/tax/source"),
        import("@/lib/pdf/reports"),
      ]);
      const result = computeSourceTax(inputs as unknown as Parameters<typeof computeSourceTax>[0]);
      exportSourceTaxPdf({ header, input: inputs as unknown as Parameters<typeof exportSourceTaxPdf>[0]["input"], result });
      return;
    }
    case "lpp": {
      const [{ projectLPP, simulateBuybackPlan }, { exportLppPdf }] = await Promise.all([
        import("@/lib/lpp"),
        import("@/lib/pdf/reports"),
      ]);
      const f = inputs as Record<string, number | string>;
      const projection = projectLPP({
        ...(f as object),
        yearlyBuyback: Math.round(num(f.buybackCapacity) / Math.max(1, num(f.buybackYears))),
        buybackYears: num(f.buybackYears),
      } as Parameters<typeof projectLPP>[0]);
      const buybackPlan = simulateBuybackPlan({
        buybackCapacity: num(f.buybackCapacity),
        years: Math.max(1, num(f.buybackYears)),
        taxInput: {
          canton: String(f.canton),
          status: f.status as "single" | "married" | "single_with_children",
          grossSalary: num(f.grossSalary),
          children: num(f.children),
        },
      });
      exportLppPdf({
        header,
        input: inputs as unknown as Parameters<typeof exportLppPdf>[0]["input"],
        projection,
        buybackPlan,
      });
      return;
    }
    case "pillar3a": {
      const [
        { pillar3aTaxSavings, projectPillar3a, staggeredWithdrawal },
        { exportPillar3aPdf },
      ] = await Promise.all([import("@/lib/pillar3"), import("@/lib/pdf/reports")]);
      const f = inputs as Record<string, number | string>;
      const taxSavings = pillar3aTaxSavings({
        contribution: num(f.contribution),
        taxInput: {
          canton: String(f.canton),
          status: f.status as "single" | "married" | "single_with_children",
          grossSalary: num(f.grossSalary),
        },
      });
      const projection = projectPillar3a({
        currentBalance: num(f.currentBalance),
        yearlyContribution: num(f.contribution),
        years: num(f.yearsToRetirement),
        expectedReturnRate: num(f.expectedReturn),
      });
      const staggered = staggeredWithdrawal({
        totalCapital: num(f.withdrawalCapital),
        numberOfAccounts: num(f.withdrawalAccounts),
        canton: String(f.canton),
        status: f.status as "single" | "married" | "single_with_children",
      });
      exportPillar3aPdf({
        header,
        input: inputs as unknown as Parameters<typeof exportPillar3aPdf>[0]["input"],
        taxSavings,
        projection,
        staggered,
      });
      return;
    }
    case "retirement": {
      const [{ annuityVsLumpSum, capitalWithdrawalTax }, { exportRetirementPdf }] =
        await Promise.all([import("@/lib/lpp"), import("@/lib/pdf/reports")]);
      const f = inputs as Record<string, number | string>;
      const lumpTax = capitalWithdrawalTax({
        capital: num(f.capital),
        canton: String(f.canton),
        status: f.status as "single" | "married" | "single_with_children",
      });
      const compare = annuityVsLumpSum({
        capital: num(f.capital),
        conversionRate: num(f.conversionRate),
        yearsAlive: num(f.yearsAlive),
        selfReturnRate: num(f.selfReturnRate),
        rentMarginalRate: num(f.rentMarginalRate),
        lumpSumTax: lumpTax.total,
      });
      const reco =
        compare.recommendation === "annuity"
          ? "Privilégier la rente : sécurité à vie + revenu garanti."
          : compare.recommendation === "lump_sum"
            ? "Privilégier le capital : meilleur rendement net après impôts si bien placé."
            : "Mixte recommandé : 50/50 capital + rente pour équilibrer sécurité et performance.";
      exportRetirementPdf({
        header,
        input: inputs as unknown as Parameters<typeof exportRetirementPdf>[0]["input"],
        lumpTax,
        compare,
        reco,
      });
      return;
    }
    case "canton_compare": {
      const [{ computeIncomeTax }, { exportCantonComparePdf }, { getComparableCantons }] = await Promise.all([
        import("@/lib/tax/income"),
        import("@/lib/pdf/reports"),
        import("@/lib/swiss/cantons"),
      ]);
      const f = inputs as Record<string, number | string>;
      // getComparableCantons() (pas la liste CANTONS brute, qui inclut des
      // cantons hors scope v1 comme AG/ZH) : le calculateur interactif
      // (canton-compare.tsx) ne compare que les cantons "comparable: true" ;
      // utiliser la liste complète ici faisait planter la régénération du
      // PDF sur un canton non supporté par computeIncomeTax.
      const rows = getComparableCantons().map((c) => {
        const r = computeIncomeTax({
          canton: c.code,
          status: f.status as "single" | "married" | "single_with_children",
          children: num(f.children),
          grossSalary: num(f.grossSalary),
          spouseGrossSalary: num(f.spouseGrossSalary),
          netWealth: num(f.netWealth),
        });
        return { code: c.code, name: c.name, total: r.totalTax, effective: r.effectiveRate };
      }).sort((a, b) => a.total - b.total);
      exportCantonComparePdf({
        header,
        input: inputs as unknown as Parameters<typeof exportCantonComparePdf>[0]["input"],
        rows,
      });
      return;
    }
    case "investment_compare": {
      const [{ compareInvestments }, { exportInvestmentComparePdf }] = await Promise.all([
        import("@/lib/investment-compare"),
        import("@/lib/pdf/reports"),
      ]);
      const saved = inputs as { a?: Parameters<typeof compareInvestments>[0]; b?: Parameters<typeof compareInvestments>[1] };
      if (!saved.a || !saved.b) return;
      const comparison = compareInvestments(saved.a, saved.b);
      exportInvestmentComparePdf({ header, comparison });
      return;
    }
    case "avs_ai": {
      const [{ projectAvsPension }, { exportAvsAiPdf }] = await Promise.all([
        import("@/lib/avs"),
        import("@/lib/pdf/reports"),
      ]);
      const f = inputs as Record<string, number | string | boolean>;
      const buildPerson = (prefix: string) => ({
        birthYear: num(f[`${prefix}BirthYear`] ?? f.birthYear),
        gender: (f[`${prefix}Gender`] ?? f.gender) as never,
        contributionStartYear: num(f[`${prefix}ContributionStartYear`] ?? f.contributionStartYear),
        retirementYear: num(f[`${prefix}RetirementYear`] ?? f.retirementYear),
        averageAnnualIncome: num(f[`${prefix}AverageAnnualIncome`] ?? f.averageAnnualIncome),
      });
      const primary = {
        birthYear: num(f.birthYear),
        gender: f.gender as never,
        contributionStartYear: num(f.contributionStartYear),
        retirementYear: num(f.retirementYear),
        averageAnnualIncome: num(f.averageAnnualIncome),
        departureYear: num(f.departureYear) > 0 ? num(f.departureYear) : null,
        educationalYears: num(f.educationalYears),
        educationalShare: num(f.educationalShare),
        assistanceYears: num(f.assistanceYears),
        assistanceShare: num(f.assistanceShare),
      };
      const isCouple = Boolean(f.isCouple);
      const projection = projectAvsPension({
        status: isCouple ? "married" : "single",
        primary,
        spouse: isCouple ? buildPerson("spouse") : undefined,
      });
      const currentYear = new Date().getFullYear();
      const aiProjection = projectAvsPension({
        status: "single",
        primary: { ...primary, retirementYear: currentYear, departureYear: null },
      });
      exportAvsAiPdf({
        header,
        input: {
          birthYear: primary.birthYear,
          gender: String(primary.gender),
          contributionStartYear: primary.contributionStartYear,
          retirementYear: primary.retirementYear,
          averageAnnualIncome: primary.averageAnnualIncome,
          isCouple,
          spouseBirthYear: num(f.spouseBirthYear),
          spouseAverageAnnualIncome: num(f.spouseAverageAnnualIncome),
        },
        projection,
        aiProjection,
      });
      return;
    }
    case "vested_benefits": {
      const [{ compareVestedStrategies, recommendVestedStrategy }, { exportVestedBenefitsPdf }] = await Promise.all([
        import("@/lib/lpp/vested"),
        import("@/lib/pdf/reports"),
      ]);
      const f = inputs as Record<string, number | string>;
      const initialBalance = num(f.initialBalance);
      const yearsToRetirement = num(f.yearsToRetirement);
      const withdrawalCanton = String(f.withdrawalCanton);
      const projections = compareVestedStrategies(initialBalance, yearsToRetirement, withdrawalCanton);
      const recommended = recommendVestedStrategy(yearsToRetirement);
      exportVestedBenefitsPdf({
        header,
        input: { initialBalance, yearsToRetirement, withdrawalCanton },
        projections,
        recommended,
      });
      return;
    }
    case "director_compensation": {
      const [
        { computeAllStrategies, computeStrategy, computeStrategyFromAbsolute, recommendBestStrategy },
        { exportDirectorCompensationPdf },
      ] = await Promise.all([import("@/lib/director-compensation"), import("@/lib/pdf/reports")]);
      const saved = inputs as Record<string, unknown>;
      const { hasCurrent, current, custom, ...directorInputs } = saved;
      const di = directorInputs as unknown as Parameters<typeof computeAllStrategies>[0];
      const presetResults = computeAllStrategies(di);
      const customResult = custom
        ? computeStrategy(di, custom as Parameters<typeof computeStrategy>[1])
        : null;
      const strategiesForCompare = customResult ? [...presetResults, customResult] : presetResults;
      const currentResult =
        hasCurrent && current
          ? computeStrategyFromAbsolute(di, current as Parameters<typeof computeStrategyFromAbsolute>[1], "Situation actuelle")
          : null;
      const recommendation = recommendBestStrategy(strategiesForCompare);
      exportDirectorCompensationPdf({
        header,
        inputs: di,
        results: strategiesForCompare,
        recommended: recommendation.best,
        current: currentResult,
      });
      return;
    }
    case "health_insurance_france": {
      const [{ computeHealthFrance }, { exportHealthFrancePdf }] = await Promise.all([
        import("@/lib/health-france"),
        import("@/lib/pdf/reports"),
      ]);
      const hfInput = inputs as unknown as Parameters<typeof computeHealthFrance>[0];
      const result = computeHealthFrance(hfInput);
      exportHealthFrancePdf({ header, input: hfInput, result });
      return;
    }
    case "overtime": {
      const [{ computeOvertime }, { exportOvertimePdf }] = await Promise.all([
        import("@/lib/overtime-fr"),
        import("@/lib/pdf/reports"),
      ]);
      const otInput = inputs as unknown as Parameters<typeof computeOvertime>[0];
      const result = computeOvertime(otInput);
      exportOvertimePdf({ header, input: otInput, result });
      return;
    }
    case "tax_global": {
      const [{ computeTaxGlobal }, { exportTaxGlobalPdf }] = await Promise.all([
        import("@/lib/tax-global/engine"),
        import("@/lib/pdf/reports"),
      ]);
      const tgInput = inputs as unknown as Parameters<typeof computeTaxGlobal>[0];
      const result = computeTaxGlobal(tgInput);
      exportTaxGlobalPdf({ header, input: tgInput, result });
      return;
    }
    case "fx_claim": {
      const [{ analyzeFxClaim }, { exportFxClaimPdf }] = await Promise.all([
        import("@/lib/fx/analyze"),
        import("@/lib/pdf/fx-claim-report"),
      ]);
      const claimInput = inputs as unknown as Parameters<typeof analyzeFxClaim>[0];
      const result = analyzeFxClaim(claimInput);
      exportFxClaimPdf({ header, input: claimInput, result });
      return;
    }
    case "cross_border":
    case "tou": {
      // Aucun bouton Sauvegarder n'existe pour ces calculateurs autonomes
      // (cross-border.tsx / tou.tsx) : ils ne peuvent jamais produire de
      // ligne simulation_history, donc ce cas n'est jamais atteint en
      // pratique. Gardé explicite plutôt qu'un défaut silencieux.
      return;
    }
  }
}
