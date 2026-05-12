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
      const [{ computeIncomeTax }, { exportCantonComparePdf }, { CANTONS }] = await Promise.all([
        import("@/lib/tax/income"),
        import("@/lib/pdf/reports"),
        import("@/lib/swiss/cantons"),
      ]);
      const f = inputs as Record<string, number | string>;
      const rows = CANTONS.map((c) => {
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
    case "investment_compare":
    case "avs_ai":
    case "vested_benefits":
    case "cross_border":
    case "tou":
    case "director_compensation": {
      // Pas de regénération PDF pour ces calculateurs (lien profond + bouton Exporter dans la fiche).
      return;
    }
  }
}
