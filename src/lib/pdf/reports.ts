// Générateurs de rapports PDF complets pour chaque calculateur.
// Textes explicatifs longs, contexte fiscal suisse, recommandations.
import { ReportPdf, makeFilename, type PdfHeaderInfo } from "./builder";
import { formatCHF, formatPct } from "@/lib/format";
import type { IncomeTaxBreakdown, IncomeTaxInput } from "@/lib/tax/income";
import type { LPPProjectionResult, LPPBuybackPlanResult, AnnuityVsLumpSumResult } from "@/lib/lpp";
import type { Pillar3aProjectionResult, StaggeredWithdrawalResult } from "@/lib/pillar3";
import type { SourceTaxResult } from "@/lib/tax/source";
import { CANTONS } from "@/lib/swiss/cantons";

const cantonName = (code: string) => CANTONS.find((c) => c.code === code)?.name ?? code;
const STATUS_LABEL: Record<string, string> = {
  single: "Célibataire",
  married: "Marié·e (imposition commune)",
  single_with_children: "Famille monoparentale",
};

// ============================================================================
// IMPÔT REVENU & FORTUNE
// ============================================================================

export function exportIncomeTaxPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: IncomeTaxInput;
  result: IncomeTaxBreakdown;
}) {
  const { input, result } = args;
  const pdf = new ReportPdf({
    title: "Rapport d'imposition revenu & fortune",
    subtitle: `Canton de ${cantonName(input.canton)} · barèmes 2026`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse");
  pdf.paragraph(
    `Cette simulation estime votre charge fiscale annuelle pour l'année 2026 dans le canton de ${cantonName(input.canton)}. ` +
      `Elle combine l'impôt fédéral direct (IFD), l'impôt cantonal et communal (ICC), l'impôt sur la fortune et, le cas échéant, ` +
      `la contribution ecclésiastique. Les déductions sociales obligatoires (AVS/AI/APG/AC, LPP) ainsi que les déductions fiscales ` +
      `usuelles (3a, rachats LPP, frais professionnels, primes d'assurance) sont automatiquement appliquées selon les plafonds 2026.`,
  );
  pdf.metricsGrid([
    { label: "Impôt total", value: result.totalTax, tone: "primary" },
    { label: "Taux effectif", value: formatPct(result.effectiveRate), tone: "primary" },
    { label: "Taux marginal", value: formatPct(result.marginalRate), tone: "warning" },
    { label: "Revenu imposable", value: result.taxableIncomeCC },
  ]);

  pdf.section("Profil du contribuable");
  pdf.kvTable([
    ["Canton de domicile", cantonName(input.canton)],
    ["Situation civile", STATUS_LABEL[input.status] ?? input.status],
    ["Confession", input.confession === "none" ? "Aucune" : (input.confession ?? "—")],
    ["Nombre d'enfants à charge", String(input.children ?? 0)],
    ["Salaire brut principal", formatCHF(input.grossSalary)],
    ...(input.spouseGrossSalary
      ? [["Salaire brut conjoint", formatCHF(input.spouseGrossSalary)] as [string, string]]
      : []),
    ...(input.bonus ? [["Bonus", formatCHF(input.bonus)] as [string, string]] : []),
    ...(input.otherIncome
      ? [["Autres revenus", formatCHF(input.otherIncome)] as [string, string]]
      : []),
    ...(input.netWealth
      ? [["Fortune nette", formatCHF(input.netWealth)] as [string, string]]
      : []),
  ]);

  pdf.section("Décomposition du revenu imposable");
  pdf.paragraph(
    `Le revenu net imposable est obtenu en déduisant du revenu brut total l'ensemble des charges et déductions fiscales ` +
      `admises. Les cotisations AVS/AI/APG/AC sont prélevées à la source à hauteur de 6,25 % côté salarié ; la part LPP varie ` +
      `selon votre âge (7 % à 18 % du salaire coordonné). Le pilier 3a est plafonné à CHF 7'258 pour un salarié affilié à une ` +
      `caisse de pension en 2026.`,
  );
  pdf.table(
    ["Poste", "Montant CHF"],
    [
      ["Revenu brut total", formatCHF(result.grossIncome)],
      ["− Cotisations AVS / AI / APG / AC", formatCHF(-result.deductions.avs)],
      ["− Cotisations LPP", formatCHF(-result.deductions.lpp)],
      ["− Cotisation 3e pilier A", formatCHF(-result.deductions.pillar3a)],
      ["− Rachat LPP", formatCHF(-result.deductions.lppBuyback)],
      ["− Frais professionnels", formatCHF(-result.deductions.professional)],
      ["− Primes d'assurance maladie", formatCHF(-result.deductions.healthInsurance)],
      ["− Intérêts hypothécaires", formatCHF(-result.deductions.mortgage)],
      ["− Entretien immobilier", formatCHF(-result.deductions.realEstate)],
      ["− Frais de garde / dons", formatCHF(-(result.deductions.childCare + result.deductions.donations))],
      ["Total des déductions", formatCHF(-result.totalDeductions)],
      ["Revenu imposable", formatCHF(result.taxableIncomeCC)],
    ],
    { highlightLast: true },
  );

  pdf.section("Détail des impôts");
  pdf.paragraph(
    `L'impôt fédéral direct (IFD) suit un barème progressif uniforme dans toute la Suisse, avec un taux marginal maximum de 11,5 %. ` +
      `L'impôt cantonal et communal (ICC) dépend du canton et de la commune de domicile : il est calculé en appliquant un coefficient ` +
      `multiplicateur (en pourcentage) au barème de base cantonal. La contribution ecclésiastique est levée en sus pour les contribuables ` +
      `affiliés à une église officiellement reconnue.`,
  );
  pdf.kvTable([
    ["Impôt fédéral direct (IFD)", formatCHF(result.ifd)],
    ["Impôt cantonal", formatCHF(result.cantonal)],
    ["Impôt communal", formatCHF(result.communal)],
    ["Contribution ecclésiastique", formatCHF(result.church)],
    ["Impôt sur la fortune", formatCHF(result.wealthTax)],
    ["TOTAL", formatCHF(result.totalTax)],
  ]);

  pdf.section("Pistes d'optimisation");
  const tips: string[] = [];
  const max3a = 7258;
  if ((input.pillar3aContributions ?? 0) < max3a) {
    const gap = max3a - (input.pillar3aContributions ?? 0);
    tips.push(
      `Vous n'utilisez pas la totalité du plafond 3a 2026 (${formatCHF(max3a)}). En versant CHF ${gap.toLocaleString("fr-CH")} ` +
        `supplémentaires, vous économiseriez environ ${formatCHF(Math.round(gap * (result.marginalRate / 100)))} d'impôts au taux marginal actuel de ${result.marginalRate.toFixed(1)} %.`,
    );
  }
  if (!input.lppBuyback) {
    tips.push(
      `Un rachat LPP est intégralement déductible du revenu imposable. Pour un taux marginal de ${result.marginalRate.toFixed(1)} %, ` +
        `chaque tranche de CHF 10'000 rachetée vous fait économiser environ ${formatCHF(Math.round(10000 * (result.marginalRate / 100)))}. ` +
        `Étalez les rachats sur plusieurs années pour maximiser l'effet progressif et respecter le délai de blocage de 3 ans avant retrait.`,
    );
  }
  if (result.marginalRate > 30) {
    tips.push(
      `Votre taux marginal dépasse 30 %. Toute déduction supplémentaire produit un effet de levier fiscal majeur. ` +
        `Étudiez prioritairement le 3a, les rachats LPP, et · si votre situation le permet · un changement de commune à coefficient plus bas.`,
    );
  }
  if (tips.length === 0)
    tips.push("Votre dossier est déjà bien optimisé sur les déductions standard. Étudiez les leviers patrimoniaux (immobilier, donations).");
  tips.forEach((t) => pdf.callout(t, "success"));

  pdf.section("Méthodologie & avertissements");
  pdf.paragraph(
    "Les barèmes appliqués sont ceux de l'année fiscale 2026, tels que publiés par l'Administration fédérale des contributions et ` +" +
      "les administrations cantonales. Les coefficients communaux retenus correspondent aux chefs-lieux de canton sauf indication contraire. " +
      "Les déductions forfaitaires (frais professionnels, assurance maladie) sont appliquées selon les seuils légaux ; le contribuable peut " +
      "opter pour les frais effectifs si ceux-ci sont supérieurs.",
    { muted: true, italic: true },
  );

  pdf.save(makeFilename("impot_revenu", input.canton));
}

// ============================================================================
// IMPÔT À LA SOURCE
// ============================================================================

export function exportSourceTaxPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    canton: string;
    scale: string;
    monthlyGross: number;
    children: number;
    church: boolean;
    isCrossBorderFR: boolean;
  };
  result: SourceTaxResult;
}) {
  const { input, result } = args;
  const pdf = new ReportPdf({
    title: "Impôt à la source · simulation",
    subtitle: `Canton de ${cantonName(input.canton)} · barème ${input.scale}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse");
  pdf.paragraph(
    `L'impôt à la source est prélevé directement sur le salaire des contribuables sans permis C. Le taux dépend du canton de travail, ` +
      `du barème applicable selon la situation familiale (A : célibataire, B : marié monoactif, C : marié biactif, H : famille monoparentale), ` +
      `du nombre d'enfants à charge et de l'éventuelle affiliation à une église reconnue.`,
  );
  pdf.metricsGrid([
    { label: "Taux appliqué", value: formatPct(result.rate), tone: "primary" },
    { label: "Impôt mensuel", value: result.monthlyTax, tone: "primary" },
    { label: "Impôt annuel (×12)", value: result.annualTax },
  ]);

  pdf.section("Détail de la situation");
  pdf.kvTable([
    ["Canton de travail", cantonName(input.canton)],
    ["Barème", `Barème ${input.scale}`],
    ["Salaire brut mensuel", formatCHF(input.monthlyGross)],
    ["Salaire brut annualisé (×13)", formatCHF(input.monthlyGross * 13)],
    ["Enfants à charge", String(input.children)],
    ["Contribution ecclésiastique", input.church ? "Oui" : "Non"],
    ["Frontalier France (accord 4,5 %)", input.isCrossBorderFR ? "Oui" : "Non"],
  ]);

  if (input.isCrossBorderFR) {
    pdf.section("Statut frontalier France");
    pdf.callout(
      "En tant que frontalier France résidant à moins de 30 km de la frontière et rentrant chaque jour à votre domicile, " +
        "vous bénéficiez de l'accord franco-suisse de 1983 : la Suisse perçoit une retenue limitée à 4,5 % du brut, " +
        "puis rétrocède une compensation à la France. Vous êtes ensuite imposé en France selon le barème français de l'impôt sur le revenu.",
      "info",
    );
    pdf.paragraph(
      "Cette simulation reflète la retenue suisse uniquement. Pour estimer votre imposition française complémentaire, " +
        "il faut intégrer le revenu suisse dans la déclaration française et appliquer le barème progressif français en tenant compte du quotient familial.",
    );
  }

  pdf.section("Recommandations");
  pdf.paragraph(
    "À partir d'un revenu brut annuel de CHF 120'000 ou en présence de revenus complémentaires (immobilier, indépendant), " +
      "une taxation ordinaire ultérieure (TOU) peut être plus avantageuse. La demande doit être déposée avant le 31 mars de l'année suivante " +
      "auprès de l'administration cantonale.",
  );
  if (input.monthlyGross * 12 > 120_000)
    pdf.callout(
      "Votre salaire annualisé dépasse CHF 120'000 : vous êtes éligible à la TOU. Comparez la charge fiscale ordinaire " +
        "(IFD + ICC) à la retenue à la source pour décider du basculement.",
      "warning",
    );

  pdf.save(makeFilename("impot_source", input.canton));
}

// ============================================================================
// LPP · PROJECTION & RACHATS
// ============================================================================

export function exportLppPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    currentAge: number;
    retirementAge: number;
    insuredSalary: number;
    expectedReturnRate: number;
    feeRate: number;
    canton: string;
    grossSalary: number;
    buybackCapacity: number;
    buybackYears: number;
  };
  projection: LPPProjectionResult;
  buybackPlan: LPPBuybackPlanResult;
}) {
  const { input, projection, buybackPlan } = args;
  const pdf = new ReportPdf({
    title: "Prévoyance professionnelle (LPP) · Projection complète",
    subtitle: `Capital et rachats · horizon ${input.retirementAge} ans`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse de la projection");
  pdf.paragraph(
    `La projection LPP simule l'évolution de votre avoir de prévoyance jusqu'à l'âge de la retraite (${input.retirementAge} ans), ` +
      `en intégrant les bonifications de vieillesse légales (7 % à 18 % du salaire coordonné selon l'âge), un rendement brut annuel ` +
      `de ${input.expectedReturnRate.toFixed(2)} %, des frais de gestion de ${input.feeRate.toFixed(2)} % et les éventuels rachats injectés. ` +
      `Le rendement net effectivement appliqué est donc de ${projection.netReturnRate.toFixed(2)} % par an.`,
  );
  pdf.metricsGrid([
    { label: "Capital projeté (net)", value: projection.projectedBalance, tone: "primary" },
    { label: "Rente annuelle", value: projection.annualPension, tone: "success" },
    { label: "Rente mensuelle", value: projection.monthlyPension },
    { label: "Sans rendement", value: projection.projectedBalanceNoYield },
    { label: "Frais cumulés", value: projection.totalFees, tone: "warning" },
    { label: "Rachats injectés", value: projection.totalBuybacks },
  ]);

  pdf.section("Comprendre votre 2e pilier");
  pdf.paragraph(
    "La LPP (Loi sur la prévoyance professionnelle) est obligatoire dès CHF 22'680 de salaire annuel. Elle se compose de la part " +
      "obligatoire (taux de conversion légal de 6,8 %) et d'une éventuelle part surobligatoire (taux librement fixé par la caisse). " +
      "Les bonifications de vieillesse s'accumulent sur le salaire coordonné (salaire brut moins la déduction de coordination de CHF 26'460, " +
      "plafonné à CHF 90'720 en 2026).",
  );

  pdf.section("Plan de rachat LPP");
  pdf.paragraph(
    `Le rachat LPP consiste à combler les lacunes de cotisation accumulées au cours de votre carrière. Il est intégralement déductible ` +
      `du revenu imposable l'année du versement. Pour CHF ${input.buybackCapacity.toLocaleString("fr-CH")} de capacité totale étalés sur ` +
      `${input.buybackYears} ans, l'effet fiscal est maximisé en respectant la progressivité des barèmes.`,
  );
  pdf.metricsGrid([
    { label: "Économie totale", value: buybackPlan.totalTaxSavings, tone: "success" },
    { label: "Versement annuel", value: buybackPlan.yearlyAmount },
    { label: "Retour fiscal moyen", value: `${buybackPlan.averageReturn} %`, tone: "primary" },
  ]);
  pdf.table(
    ["Année", "Versement", "Économie d'impôt", "Coût net"],
    buybackPlan.yearly.map((y) => [
      `Année ${y.year}`,
      formatCHF(y.amount),
      formatCHF(y.taxSavings),
      formatCHF(y.effectiveCost),
    ]),
  );

  pdf.callout(
    "Attention au délai de blocage : tout rachat LPP est bloqué pendant 3 ans avant un retrait en capital (achat immobilier, départ de Suisse, retraite). " +
      "Évitez de racheter dans les 3 années précédant la retraite si vous prévoyez un retrait en capital.",
    "warning",
  );

  pdf.section("Évolution annuelle du capital");
  const sample = projection.yearly.filter((_, i) => i % Math.max(1, Math.floor(projection.yearly.length / 12)) === 0);
  if (sample[sample.length - 1] !== projection.yearly[projection.yearly.length - 1])
    sample.push(projection.yearly[projection.yearly.length - 1]);
  pdf.table(
    ["Âge", "Salaire", "Bonification", "Intérêts nets", "Frais", "Capital"],
    sample.map((y) => [
      String(y.age),
      formatCHF(y.salary),
      formatCHF(y.credit),
      formatCHF(y.interest),
      formatCHF(y.fees),
      formatCHF(y.balance),
    ]),
    { highlightLast: true },
  );

  pdf.save(makeFilename("lpp_projection", input.canton));
}

// ============================================================================
// PILIER 3A
// ============================================================================

export function exportPillar3aPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    canton: string;
    contribution: number;
    yearsToRetirement: number;
    expectedReturn: number;
    withdrawalCapital: number;
    withdrawalAccounts: number;
    grossSalary: number;
  };
  taxSavings: { taxSavings: number; effectiveCost: number; marginalRate: number };
  projection: Pillar3aProjectionResult;
  staggered: StaggeredWithdrawalResult;
}) {
  const { input, taxSavings, projection, staggered } = args;
  const pdf = new ReportPdf({
    title: "Pilier 3a · Stratégie complète",
    subtitle: `Cotisation, projection et retrait étalé · ${cantonName(input.canton)}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Pourquoi cotiser au 3a ?");
  pdf.paragraph(
    "Le pilier 3a est la prévoyance individuelle liée. Les cotisations sont entièrement déductibles du revenu imposable jusqu'au plafond " +
      "annuel (CHF 7'258 en 2026 pour un salarié affilié à une caisse de pension, CHF 36'288 pour un indépendant sans LPP). Le capital est bloqué " +
      "jusqu'à 5 ans avant l'âge AVS, sauf cas particuliers (achat immobilier, indépendance, départ de Suisse, invalidité).",
  );

  pdf.section("Économie fiscale immédiate");
  pdf.metricsGrid([
    { label: "Cotisation versée", value: input.contribution, tone: "primary" },
    { label: "Économie d'impôt", value: taxSavings.taxSavings, tone: "success" },
    { label: "Coût net réel", value: taxSavings.effectiveCost },
    { label: "Taux marginal", value: formatPct(taxSavings.marginalRate), tone: "warning" },
  ]);
  pdf.paragraph(
    `Pour un salaire brut de ${formatCHF(input.grossSalary)} dans le canton de ${cantonName(input.canton)}, votre taux marginal estimé est de ` +
      `${taxSavings.marginalRate.toFixed(1)} %. Chaque franc versé au 3a vous fait donc économiser environ ${(taxSavings.marginalRate / 100).toFixed(2)} centime ` +
      `d'impôt l'année du versement.`,
  );

  pdf.section("Projection du capital 3a");
  pdf.paragraph(
    `En cotisant ${formatCHF(input.contribution)} par an pendant ${input.yearsToRetirement} ans avec un rendement net annuel de ` +
      `${input.expectedReturn.toFixed(1)} %, votre capital final atteindra environ ${formatCHF(projection.finalBalance)}.`,
  );
  pdf.metricsGrid([
    { label: "Capital final", value: projection.finalBalance, tone: "primary" },
    { label: "Cotisations cumulées", value: projection.totalContributions },
    { label: "Intérêts cumulés", value: projection.totalReturns, tone: "success" },
  ]);

  pdf.section("Stratégie de retrait étalé");
  pdf.paragraph(
    "Le retrait du 3a fait l'objet d'une imposition séparée à un taux privilégié (1/5 du barème ordinaire au niveau fédéral). " +
      "Détenir plusieurs comptes 3a (idéalement 3 à 5) permet de retirer le capital sur plusieurs années fiscales et de profiter " +
      "de la progressivité du barème pour réduire significativement la charge fiscale globale.",
  );
  pdf.metricsGrid([
    { label: "Impôt si retrait unique", value: staggered.totalTaxSingle, tone: "warning" },
    { label: "Impôt si fractionné", value: staggered.totalTaxSeparated, tone: "primary" },
    { label: "Économie", value: staggered.savings, tone: "success" },
    { label: "Capital par compte", value: staggered.perAccount },
  ]);

  pdf.callout(
    `En répartissant ${formatCHF(input.withdrawalCapital)} sur ${input.withdrawalAccounts} comptes retirés sur autant d'années fiscales différentes, ` +
      `vous économiseriez environ ${formatCHF(staggered.savings)} d'impôts sur la prestation en capital.`,
    "success",
  );

  pdf.save(makeFilename("pilier_3a", input.canton));
}

// ============================================================================
// RENTE vs CAPITAL
// ============================================================================

export function exportRetirementPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    capital: number;
    canton: string;
    conversionRate: number;
    yearsAlive: number;
    selfReturnRate: number;
    rentMarginalRate: number;
  };
  lumpTax: { ifd: number; cantonal: number; total: number };
  compare: AnnuityVsLumpSumResult;
  reco: string;
}) {
  const { input, lumpTax, compare, reco } = args;
  const pdf = new ReportPdf({
    title: "Rente ou capital ? · Décision retraite",
    subtitle: `Capital LPP de ${formatCHF(input.capital)} · ${cantonName(input.canton)}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("La décision la plus importante de la retraite");
  pdf.paragraph(
    "À l'âge de la retraite, vous devez choisir entre percevoir votre 2e pilier sous forme de rente viagère, de capital unique, " +
      "ou d'une combinaison des deux (mix généralement entre 50 % rente et 50 % capital). Cette décision est définitive et engage " +
      "votre niveau de vie à long terme. Elle dépend de quatre facteurs : votre espérance de vie, vos autres revenus, votre " +
      "discipline de gestion patrimoniale et votre fiscalité personnelle.",
  );

  pdf.section("Hypothèses retenues");
  pdf.kvTable([
    ["Capital LPP au moment du choix", formatCHF(input.capital)],
    ["Canton de domicile", cantonName(input.canton)],
    ["Taux de conversion appliqué", `${input.conversionRate.toFixed(2)} %`],
    ["Espérance de vie résiduelle", `${input.yearsAlive} ans`],
    ["Rendement net du capital placé", `${input.selfReturnRate.toFixed(1)} % / an`],
    ["Taux marginal sur la rente", `${input.rentMarginalRate.toFixed(1)} %`],
  ]);

  pdf.section("Imposition unique du capital (1/5 du barème)");
  pdf.paragraph(
    "Le retrait en capital est imposé séparément du revenu, à un taux réduit correspondant au cinquième du barème ordinaire au niveau " +
      "fédéral. Le canton applique son propre barème spécifique sur les prestations en capital de la prévoyance.",
  );
  pdf.kvTable([
    ["IFD (1/5)", formatCHF(lumpTax.ifd)],
    ["Impôt cantonal/communal", formatCHF(lumpTax.cantonal)],
    ["TOTAL impôt sur capital", formatCHF(lumpTax.total)],
    ["Capital net après impôt", formatCHF(input.capital - lumpTax.total)],
  ]);

  pdf.section("Comparaison des scénarios");
  pdf.metricsGrid([
    { label: "Rente · Total brut", value: compare.totalRente },
    { label: "Rente · Net après impôts", value: compare.netAnnuity, tone: "primary" },
    { label: "Capital · Net projeté", value: compare.netLumpSum, tone: "primary" },
    { label: "Différence", value: compare.netLumpSum - compare.netAnnuity },
  ]);

  pdf.section("Recommandation");
  pdf.callout(reco, compare.recommendation === "annuity" ? "info" : "success");

  pdf.section("Avertissements & limites du modèle");
  pdf.paragraph(
    "Ce comparatif ne tient pas compte de l'inflation, ni des éventuelles indexations de rente, ni du risque de longévité au-delà de " +
      "l'espérance de vie retenue. Il ignore également la fiscalité de l'éventuel rendement du capital placé après retrait. La rente offre " +
      "une sécurité absolue à vie, le capital offre flexibilité et transmissibilité aux héritiers.",
    { italic: true, muted: true },
  );

  pdf.save(makeFilename("rente_vs_capital", input.canton));
}

// ============================================================================
// COMPARATEUR CANTONAL
// ============================================================================

export function exportCantonComparePdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    grossSalary: number;
    spouseGrossSalary: number;
    status: string;
    children: number;
    netWealth: number;
    referenceCanton: string;
  };
  rows: Array<{ code: string; name: string; total: number; effective: number }>;
}) {
  const { input, rows } = args;
  const pdf = new ReportPdf({
    title: "Comparateur cantonal · Charge fiscale 2026",
    subtitle: `Profil : ${formatCHF(input.grossSalary)} brut, ${STATUS_LABEL[input.status] ?? input.status}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Profil simulé");
  pdf.kvTable([
    ["Salaire brut", formatCHF(input.grossSalary)],
    ...(input.spouseGrossSalary
      ? [["Salaire conjoint", formatCHF(input.spouseGrossSalary)] as [string, string]]
      : []),
    ["Situation civile", STATUS_LABEL[input.status] ?? input.status],
    ["Enfants", String(input.children)],
    ["Fortune nette", formatCHF(input.netWealth)],
    ["Canton de référence", cantonName(input.referenceCanton)],
  ]);

  const ref = rows.find((r) => r.code === input.referenceCanton);
  const cheapest = rows[0];
  const mostExpensive = rows[rows.length - 1];

  pdf.section("Synthèse");
  pdf.paragraph(
    `Pour le profil simulé, la Suisse présente un écart fiscal de ${formatCHF(mostExpensive.total - cheapest.total)} entre le canton ` +
      `le plus avantageux (${cheapest.name}, ${formatCHF(cheapest.total)}) et le plus cher (${mostExpensive.name}, ${formatCHF(mostExpensive.total)}). ` +
      `Votre canton de référence ${ref?.name ?? input.referenceCanton} se situe à ${formatCHF(ref?.total ?? 0)} (taux effectif ${ref?.effective ?? 0} %).`,
  );
  if (ref && ref.total > cheapest.total) {
    pdf.callout(
      `En vous domiciliant à ${cheapest.name}, vous économiseriez environ ${formatCHF(ref.total - cheapest.total)} d'impôts par an, ` +
        `soit ${formatCHF((ref.total - cheapest.total) * 10)} sur 10 ans.`,
      "success",
    );
  }

  pdf.section("Classement des cantons romands (+ Zoug en référence)");
  pdf.table(
    ["Rang", "Canton", "Impôt total", "Taux effectif"],
    rows.map((r, i) => [
      String(i + 1),
      `${r.code} · ${r.name}`,
      formatCHF(r.total),
      `${r.effective.toFixed(2)} %`,
    ]),
  );

  pdf.section("Limites du modèle");
  pdf.paragraph(
    "Les coefficients communaux retenus correspondent par défaut aux chefs-lieux. La charge réelle peut varier de ±15 % selon la " +
      "commune choisie au sein d'un même canton. Le coût de la vie (loyers, primes maladie, services publics) doit également être " +
      "intégré dans toute décision de relocation.",
    { italic: true, muted: true },
  );

  pdf.save(makeFilename("comparateur_cantons"));
}

// ============================================================================
// FRONTALIERS · CROSS-BORDER
// ============================================================================
import type { CrossBorderInput, CrossBorderResult } from "@/lib/tax/cross-border";
import type { QuasiResidentResult, TOUComparisonResult } from "@/lib/tax/tou";
import type { VestedProjectionResult } from "@/lib/lpp/vested";

export function exportCrossBorderPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: CrossBorderInput;
  result: CrossBorderResult;
}) {
  const { input, result } = args;
  const pdf = new ReportPdf({
    title: "Frontalier · Simulation fiscale transfrontalière",
    subtitle: result.regimeLabel,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse");
  pdf.paragraph(
    `Cette simulation détermine automatiquement le régime fiscal frontalier applicable selon le canton de travail (${cantonName(input.workCanton)}) ` +
      `et estime la charge fiscale combinée Suisse + pays de résidence. Trois régimes sont supportés : l'accord franco-suisse de 1983 (retenue 4,5 % ` +
      `dans 8 cantons), le régime spécial genevois (IS genevoise + rétrocession 3,5 % à la France), et l'accord italo-suisse 2023 pour le Tessin.`,
  );
  pdf.metricsGrid([
    { label: "Net annuel", value: result.netAnnual, tone: "success" },
    { label: "Charge totale", value: formatPct(result.totalRate), tone: "primary" },
    { label: "Retenue Suisse", value: result.swissTax },
    { label: "Impôt résident", value: result.foreignTax },
  ]);

  pdf.section("Hypothèses retenues");
  pdf.kvTable([
    ["Canton de travail", `${input.workCanton} · ${cantonName(input.workCanton)}`],
    ["Régime appliqué", result.regimeLabel],
    ["Salaire annuel brut (CHF)", formatCHF(input.grossAnnualSalary)],
    ["Situation civile", input.status === "single" ? "Célibataire" : "Marié·e / pacsé·e"],
    ["Enfants à charge", String(input.children ?? 0)],
    ...(input.spouseGrossSalary
      ? [["Salaire conjoint (CHF)", formatCHF(input.spouseGrossSalary)] as [string, string]]
      : []),
    ["Taux EUR/CHF retenu", String(input.eurChfRate ?? 0.95)],
  ]);

  pdf.section("Décomposition fiscale");
  pdf.table(
    ["Poste", "Taux", "Montant CHF"],
    [
      ["Retenue Suisse", `${result.swissRate}%`, formatCHF(result.swissTax)],
      ["Impôt pays de résidence", `${result.foreignRate}%`, formatCHF(result.foreignTax)],
      ["TOTAL charge fiscale", `${result.totalRate}%`, formatCHF(result.totalTax)],
      ["Net après impôts", "—", formatCHF(result.netAnnual)],
    ],
    { highlightLast: true },
  );

  if (result.alternative) {
    pdf.section("Comparatif régime alternatif");
    pdf.callout(
      `${result.alternative.label} · Total : ${formatCHF(result.alternative.totalTax)} · Net : ${formatCHF(result.alternative.netAnnual)}. ` +
        (result.alternative.delta > 0
          ? `Le régime actuel est plus avantageux de ${formatCHF(result.alternative.delta)}.`
          : `Le régime alternatif coûterait ${formatCHF(Math.abs(result.alternative.delta))} de moins (à étudier).`),
      result.alternative.delta > 0 ? "success" : "warning",
    );
  }

  pdf.section("Notes du régime");
  result.notes.forEach((n) => pdf.paragraph(`• ${n}`));

  pdf.section("Méthodologie & avertissements");
  pdf.paragraph(
    "L'estimation de l'impôt français applique le barème progressif 2025 (DGFiP) avec abattement forfaitaire 10 % et quotient familial. " +
      "L'IRPEF italien intègre les addizionali régionale/communale moyennes (~2,5 %) et la franchise frontalière de 10 000 EUR (loi 83/2023). " +
      "Le résultat est indicatif : la déclaration définitive doit être établie par un fiscaliste agréé dans le pays de résidence.",
    { italic: true, muted: true },
  );

  pdf.save(makeFilename("frontalier", input.workCanton));
}

// ============================================================================
// TOU / QUASI-RÉSIDENT
// ============================================================================

export function exportTouPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    canton: string;
    grossSalary: number;
    bonus: number;
    sourceTaxAnnual: number;
    worldwideIncome: number;
    isEUEFTAResident: boolean;
    pillar3aContributions: number;
    lppBuyback: number;
    mortgageInterest: number;
    realEstateMaintenance: number;
    healthInsurancePremiums: number;
  };
  eligibility: QuasiResidentResult;
  comparison: TOUComparisonResult;
}) {
  const { input, eligibility, comparison } = args;
  const pdf = new ReportPdf({
    title: "TOU · Taxation Ordinaire Ultérieure",
    subtitle: `Quasi-résident · ${cantonName(input.canton)}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse");
  pdf.paragraph(
    "La Taxation Ordinaire Ultérieure (TOU) permet aux contribuables imposés à la source et résidant dans l'UE/AELE de demander " +
      "une taxation ordinaire dès lors qu'ils réalisent au moins 90 % de leur revenu mondial en Suisse (statut quasi-résident, art. 99a/b LIFD). " +
      "Cette procédure permet de faire valoir les déductions effectives (3a, rachats LPP, intérêts hypothécaires, entretien immobilier) " +
      "qui ne sont pas prises en compte dans les barèmes forfaitaires de l'impôt à la source.",
  );

  pdf.metricsGrid([
    { label: "Part revenu CH", value: `${eligibility.swissShare}%`, tone: eligibility.eligibleForTOU ? "success" : "warning" },
    { label: "IS retenue", value: comparison.sourceTax },
    { label: "TOU calculée", value: comparison.ordinaryTax, tone: "primary" },
    {
      label: comparison.delta < 0 ? "Économie TOU" : "Surcoût TOU",
      value: Math.abs(comparison.delta),
      tone: comparison.delta < 0 ? "success" : "warning",
    },
  ]);

  pdf.section("Éligibilité quasi-résident");
  pdf.kvTable([
    ["Revenu mondial annuel", formatCHF(input.worldwideIncome)],
    ["Revenu suisse", formatCHF(input.grossSalary + input.bonus)],
    ["Part suisse / mondiale", `${eligibility.swissShare} %`],
    ["Seuil légal (90 %)", eligibility.meetsThreshold ? "Atteint" : "Non atteint"],
    ["Résidence UE / AELE", input.isEUEFTAResident ? "Oui" : "Non"],
    ["Éligible à la TOU", eligibility.eligibleForTOU ? "OUI" : "NON"],
  ]);
  pdf.callout(eligibility.recommendation, eligibility.eligibleForTOU ? "success" : "warning");

  pdf.section("Comparatif IS vs TOU");
  pdf.table(
    ["Régime", "Impôt annuel", "Taux effectif"],
    [
      ["Impôt à la source (actuel)", formatCHF(comparison.sourceTax), `${comparison.effectiveRateIS} %`],
      ["TOU (taxation ordinaire)", formatCHF(comparison.ordinaryTax), `${comparison.effectiveRateTOU} %`],
      [
        comparison.delta < 0 ? "ÉCONOMIE TOU" : "SURCOÛT TOU",
        formatCHF(Math.abs(comparison.delta)),
        `Marginal ${comparison.marginalRate} %`,
      ],
    ],
    { highlightLast: true },
  );

  pdf.section("Déductions effectives valorisées");
  pdf.kvTable([
    ["Cotisations 3e pilier A", formatCHF(input.pillar3aContributions)],
    ["Rachat LPP", formatCHF(input.lppBuyback)],
    ["Intérêts hypothécaires", formatCHF(input.mortgageInterest)],
    ["Entretien immobilier", formatCHF(input.realEstateMaintenance)],
    ["Primes maladie / LCA", formatCHF(input.healthInsurancePremiums)],
  ]);
  pdf.paragraph(comparison.potentialDeductionsImpact);

  pdf.section("Recommandation");
  pdf.callout(
    comparison.recommendationText,
    comparison.recommendation === "tou" ? "success" : comparison.recommendation === "source" ? "info" : "warning",
  );

  pdf.section("Procédure & délais");
  eligibility.notes.forEach((n) => pdf.paragraph(`• ${n}`));
  pdf.callout(
    "La demande de TOU doit être déposée par écrit auprès de l'administration fiscale cantonale au plus tard le 31 mars de l'année suivant " +
      "l'année fiscale concernée. Une fois acceptée, elle s'applique aux années suivantes jusqu'à fin de l'assujettissement à la source.",
    "info",
  );

  pdf.save(makeFilename("tou_quasi_resident", input.canton));
}

// ============================================================================
// LIBRE PASSAGE · VESTED BENEFITS
// ============================================================================

export function exportVestedBenefitsPdf(args: {
  header?: Partial<PdfHeaderInfo>;
  input: {
    initialBalance: number;
    yearsToRetirement: number;
    withdrawalCanton: string;
  };
  projections: VestedProjectionResult[];
  recommended: string;
}) {
  const { input, projections, recommended } = args;
  const pdf = new ReportPdf({
    title: "Libre passage · Stratégies de placement",
    subtitle: `Capital ${formatCHF(input.initialBalance)} · horizon ${input.yearsToRetirement} ans · ${cantonName(input.withdrawalCanton)}`,
    ...args.header,
  } as PdfHeaderInfo);

  pdf.section("Synthèse");
  pdf.paragraph(
    "Un compte de libre passage est ouvert lors d'une interruption d'affiliation à une caisse de pension (départ à l'étranger, indépendance, " +
      "période sans emploi). L'avoir reste bloqué jusqu'à 5 ans avant l'âge AVS, sauf cas particuliers (achat immobilier, départ définitif hors UE/AELE). " +
      "Trois profils d'investissement sont proposés ici, calibrés selon l'allocation actions/obligations et les frais de gestion (TER + frais administratifs).",
  );

  const reco = projections.find((p) => p.strategy.id === recommended);
  if (reco) {
    pdf.metricsGrid([
      { label: "Stratégie conseillée", value: reco.strategy.label, tone: "primary" },
      { label: "Capital final projeté", value: reco.finalBalance, tone: "success" },
      { label: "Gains nets", value: reco.totalGains, tone: "success" },
      ...(reco.estimatedExitTax !== undefined
        ? [{ label: "Net après impôt sortie", value: reco.finalBalance - reco.estimatedExitTax, tone: "primary" as const }]
        : []),
    ]);
  }

  pdf.section("Hypothèses");
  pdf.kvTable([
    ["Capital libre passage actuel", formatCHF(input.initialBalance)],
    ["Horizon avant retrait", `${input.yearsToRetirement} ans`],
    ["Canton de retrait", `${input.withdrawalCanton} · ${cantonName(input.withdrawalCanton)}`],
    ["Stratégie recommandée (selon horizon)", projections.find((p) => p.strategy.id === recommended)?.strategy.label ?? "—"],
  ]);

  pdf.section("Comparatif des 3 stratégies");
  pdf.table(
    ["Stratégie", "Rdt net annualisé", "Capital final", "Fourchette ±1σ", "Impôt sortie", "Net après impôt"],
    projections.map((p) => [
      p.strategy.label,
      `${p.netReturn} %`,
      formatCHF(p.finalBalance),
      `${formatCHF(p.finalLow)} → ${formatCHF(p.finalHigh)}`,
      p.estimatedExitTax !== undefined ? formatCHF(p.estimatedExitTax) : "—",
      p.estimatedExitTax !== undefined ? formatCHF(p.finalBalance - p.estimatedExitTax) : formatCHF(p.finalBalance),
    ]),
  );

  projections.forEach((p) => {
    pdf.section(`Stratégie · ${p.strategy.label}`);
    pdf.paragraph(p.strategy.description);
    pdf.kvTable([
      ["Allocation actions cible", `${Math.round(p.strategy.equityAllocation * 100)} %`],
      ["Rendement brut espéré", `${p.strategy.expectedReturn} %`],
      ["Frais annuels totaux", `${p.strategy.totalFees} %`],
      ["Volatilité (écart-type)", `${p.strategy.volatility} %`],
      ["Rendement net annualisé", `${p.netReturn} %`],
      ["Capital final projeté", formatCHF(p.finalBalance)],
      ["Fourchette basse (-1σ)", formatCHF(p.finalLow)],
      ["Fourchette haute (+1σ)", formatCHF(p.finalHigh)],
      ["Gains nets cumulés", formatCHF(p.totalGains)],
      ...(p.estimatedExitTax !== undefined
        ? ([
            ["Impôt sortie estimé", formatCHF(p.estimatedExitTax)],
            ["Net après impôt sortie", formatCHF(p.finalBalance - p.estimatedExitTax)],
          ] as Array<[string, string]>)
        : []),
    ]);
  });

  pdf.section("Optimisation fiscale du retrait");
  pdf.callout(
    "Fragmentez vos avoirs sur 2 ou 3 comptes de libre passage et échelonnez les retraits sur plusieurs années fiscales (≥ 1 an d'écart) pour " +
      "casser la progressivité de l'impôt sur les prestations en capital. Combiné à un retrait 3a étalé, l'économie peut dépasser 20 % de la charge totale.",
    "success",
  );

  pdf.section("Avertissements");
  pdf.paragraph(
    "Les rendements espérés sont des moyennes long terme nettes de frais ; les fourchettes ±1σ couvrent ~68 % des scénarios statistiquement probables. " +
      "Performance passée non garantie. L'impôt sur prestation en capital est estimé à partir des barèmes cantonaux 2026 et de l'IFD séparé (1/5 du barème ordinaire) ; " +
      "il varie selon la commune, l'état civil et la confession.",
    { italic: true, muted: true },
  );

  pdf.save(makeFilename("libre_passage", input.withdrawalCanton));
}
