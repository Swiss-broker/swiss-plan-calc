// Générateur PDF "Dossier de synthèse" multi-pages pour un client.
// V1 : 100 % en français. Le multilingue PDF sera traité dans une phase ultérieure.
import { ReportPdf, makeFilename, type PdfHeaderInfo } from "./builder";
import { formatCHF, formatPct } from "@/lib/format";
import { CANTONS } from "@/lib/swiss/cantons";
import {
  CIVIL_STATUS_LABELS,
  CONFESSION_LABELS,
  PERMIT_LABELS,
  TAX_STATUS_LABELS,
  WORK_STATUS_LABELS,
  LPP_PLAN_LABELS,
} from "@/lib/swiss/enums";
import { LEGAL_FORM_LABELS, type Company } from "@/lib/companies/types";
import { ageFromDob, parseChildren, type Client, type ClientPension, type ClientAssets } from "@/lib/clients/types";
import { extractGain, type ExtractedGain } from "@/lib/simulations/extract-gain";
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";
import { KIND_LABELS } from "@/lib/history/types";

const cantonName = (code?: string | null) =>
  (code && CANTONS.find((c) => c.code === code)?.name) || code || "—";

const dateFR = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
};
const str = (v: unknown): string | undefined => {
  if (typeof v === "string" && v.trim()) return v;
  return undefined;
};

const STATUS_FR: Record<string, string> = {
  single: "Célibataire",
  married: "Marié·e",
  registered_partnership: "Partenariat enregistré",
  single_with_children: "Famille monoparentale",
  divorced: "Divorcé·e",
  widowed: "Veuf / Veuve",
  separated: "Séparé·e",
};
const REGIME_FR: Record<string, string> = {
  fr_1983: "Frontalier français (accord 1983)",
  ge: "Frontalier Genève",
  tou: "TOU (taxation ordinaire ultérieure)",
};
const localizeStatus = (v: unknown) => {
  const k = typeof v === "string" ? v : "";
  return STATUS_FR[k] ?? (k || undefined);
};
const localizeRegime = (v: unknown) => {
  const k = typeof v === "string" ? v : "";
  return REGIME_FR[k] ?? (k || undefined);
};

// ============================================================================

export interface SynthesisReportArgs {
  header?: Partial<PdfHeaderInfo>;
  client: Client;
  pension: ClientPension | null;
  assets: ClientAssets | null;
  company?: Company | null;
  entries: HistoryEntry[]; // simulations sélectionnées
  options: {
    includeCharts: boolean;
    customNote?: string;
  };
}

export function exportSynthesisReportPdf(args: SynthesisReportArgs): void {
  const { client, pension, assets, company, entries, options } = args;
  const fullName = `${client.first_name} ${client.last_name}`.trim();

  const pdf = new ReportPdf({
    title: "Dossier de synthèse",
    subtitle: `Préparé pour ${fullName}`,
    ...args.header,
  } as PdfHeaderInfo);

  // ---------- PAGE 1 · COVER ----------
  drawCoverPage(pdf, fullName, options.customNote, args.header);

  // ---------- PAGE 2 · TABLE DES MATIÈRES (placeholder, rempli en fin de génération) ----------
  pdf.newPage();
  const tocPage = pdf.doc.getCurrentPageInfo().pageNumber;
  const toc: Array<{ title: string; page: number }> = [];

  // ---------- PROFIL CLIENT ----------
  pdf.newPage();
  toc.push({ title: "Profil client", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawClientProfile(pdf, client, pension, assets, company);

  // ---------- PAGES SIMULATIONS ----------
  for (const entry of entries) {
    pdf.newPage();
    const kindLabel = KIND_LABELS[entry.kind as SimulationKind] || entry.kind;
    const title = entry.title?.trim()
      ? `${kindLabel} : ${entry.title.trim()}`
      : kindLabel;
    toc.push({ title, page: pdf.doc.getCurrentPageInfo().pageNumber });
    drawSimulationPage(pdf, entry, options.includeCharts);
  }

  // ---------- AVANT/APRÈS ----------
  pdf.newPage();
  toc.push({ title: "Comparatif avant / après", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawComparisonPage(pdf, entries, pension, assets);

  // ---------- CONCLUSION ----------
  pdf.newPage();
  toc.push({ title: "Conclusion & recommandations", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawConclusionPage(pdf, entries);

  // ---------- Remplissage de la TOC sur la page placeholder ----------
  pdf.doc.setPage(tocPage);
  pdf.cursorY = 50;
  drawTableOfContents(pdf, toc);

  const datePart = new Date().toISOString().slice(0, 10);
  const safeName = fullName.replace(/[^a-z0-9_-]/gi, "_") || "client";
  pdf.save(`Synthese_${safeName}_${datePart}.pdf`);
}

// ============================================================================
// TABLE DES MATIÈRES
// ============================================================================
function drawTableOfContents(
  pdf: ReportPdf,
  items: Array<{ title: string; page: number }>,
) {
  const { doc, pageWidth, margin, primary, ink, muted } = pdf;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.text("Sommaire", margin, pdf.cursorY);
  pdf.cursorY += 4;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(margin, pdf.cursorY, margin + 30, pdf.cursorY);
  pdf.cursorY += 10;

  doc.setFontSize(11);
  for (const item of items) {
    const y = pdf.cursorY;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink);
    const titleMaxW = pageWidth - margin * 2 - 20;
    const titleLines = doc.splitTextToSize(item.title, titleMaxW) as string[];
    doc.text(titleLines[0], margin, y);

    // Pointillés entre titre et numéro de page
    const titleW = doc.getTextWidth(titleLines[0]);
    const pageStr = String(item.page);
    const pageW = doc.getTextWidth(pageStr);
    const dotsStart = margin + titleW + 2;
    const dotsEnd = pageWidth - margin - pageW - 2;
    if (dotsEnd > dotsStart) {
      doc.setTextColor(...muted);
      const dotChar = ".";
      const dotW = doc.getTextWidth(dotChar);
      const count = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotW));
      doc.text(dotChar.repeat(count), dotsStart, y);
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ink);
    doc.text(pageStr, pageWidth - margin, y, { align: "right" });

    pdf.cursorY += 8;
  }
}



// ============================================================================
// COVER
// ============================================================================
function drawCoverPage(
  pdf: ReportPdf,
  fullName: string,
  customNote: string | undefined,
  header: Partial<PdfHeaderInfo> | undefined,
) {
  const { doc, pageWidth, pageHeight, margin, primary, ink, muted } = pdf;

  // Grand titre central
  pdf.cursorY = 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...primary);
  const titleLines = doc.splitTextToSize(
    "Dossier de synthèse prévoyance & fiscalité",
    pageWidth - margin * 2,
  ) as string[];
  doc.text(titleLines, pageWidth / 2, pdf.cursorY, { align: "center" });
  pdf.cursorY += titleLines.length * 11 + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...ink);
  doc.text(`Préparé pour ${fullName}`, pageWidth / 2, pdf.cursorY, { align: "center" });
  pdf.cursorY += 18;

  // Bloc informations
  const blockX = margin + 20;
  const blockW = pageWidth - margin * 2 - 40;
  const blockY = pdf.cursorY;
  const todayIso = new Date().toISOString();
  const lines: Array<[string, string]> = [
    ["Date du dossier", dateFR(todayIso)],
    ["Données arrêtées au", dateFR(todayIso)],
    ["Préparé par", header?.brokerName || "Non renseigné"],
    ["Cabinet", header?.brokerageName || "Non renseigné"],
    [
      "Coordonnées",
      [header?.brokerPhone, header?.brokerEmail].filter(Boolean).join(" · ") || "Non renseignées",
    ],
  ];
  const blockH = lines.length * 9 + 12;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.roundedRect(blockX, blockY, blockW, blockH, 2, 2, "FD");

  let lineY = blockY + 9;
  lines.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(k.toUpperCase(), blockX + 5, lineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text(v, blockX + blockW - 5, lineY, { align: "right" });
    lineY += 9;
  });
  pdf.cursorY = blockY + blockH + 14;

  // Note personnalisée
  if (customNote && customNote.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    const noteLines = doc.splitTextToSize(customNote.trim(), pageWidth - margin * 2 - 20) as string[];
    doc.text(noteLines, pageWidth / 2, pdf.cursorY, { align: "center" });
    pdf.cursorY += noteLines.length * 5 + 4;
  }

  // Mention bas de page
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Document confidentiel · Usage interne", pageWidth / 2, pageHeight - 25, {
    align: "center",
  });
}

// ============================================================================
// PROFIL CLIENT
// ============================================================================
function drawClientProfile(
  pdf: ReportPdf,
  client: Client,
  pension: ClientPension | null,
  assets: ClientAssets | null,
  company: Company | null | undefined,
) {
  const age = ageFromDob(client.date_of_birth);
  const children = parseChildren(client.children);

  pdf.section("Identité");
  pdf.kvTable([
    ["Nom complet", `${client.first_name} ${client.last_name}`.trim()],
    ["Date de naissance", `${dateFR(client.date_of_birth)}${age != null ? ` (${age} ans)` : ""}`],
    ["État civil", CIVIL_STATUS_LABELS[client.civil_status] ?? "—"],
    ["Enfants", String(children.length)],
    ["Nationalité", client.nationality || "—"],
    ["Pays de résidence", client.country_of_residence || "Suisse"],
  ]);

  pdf.section("Situation fiscale");
  pdf.kvTable([
    ["Canton de domicile", cantonName(client.canton)],
    ["Commune", client.commune || "—"],
    ["Statut fiscal", TAX_STATUS_LABELS[client.tax_status] ?? "—"],
    ["Permis", PERMIT_LABELS[client.permit] ?? "—"],
    ["Confession", CONFESSION_LABELS[client.confession] ?? "—"],
  ]);

  pdf.section("Activité professionnelle");
  pdf.kvTable([
    ["Statut professionnel", WORK_STATUS_LABELS[client.work_status] ?? "—"],
    ["Employeur", client.employer || "—"],
    ["Salaire brut annuel", client.gross_annual_salary != null ? formatCHF(client.gross_annual_salary) : "—"],
    ["Bonus", client.bonus != null ? formatCHF(client.bonus) : "—"],
    ["Taux d'activité", client.activity_rate != null ? formatPct(client.activity_rate, 0) : "—"],
    ["Plan LPP", pension ? LPP_PLAN_LABELS[pension.lpp_plan] ?? "—" : "—"],
  ]);

  pdf.section("Patrimoine et prévoyance actuels");
  const rows: Array<[string, string]> = [];
  if (pension) {
    rows.push(["Avoir LPP", formatCHF(pension.lpp_current_balance)]);
    rows.push(["Versement 3a annuel", formatCHF(pension.pillar_3a_annual_contribution)]);
    rows.push(["Capacité de rachat LPP max", formatCHF(pension.lpp_max_buyback)]);
  }
  if (assets) {
    const totalAssets =
      Number(assets.bank_accounts) +
      Number(assets.securities) +
      Number(assets.real_estate_value) +
      Number(assets.vehicles) +
      Number(assets.other_assets);
    const totalDebts = Number(assets.mortgage_debt) + Number(assets.other_debts);
    rows.push(["Total actifs", formatCHF(totalAssets)]);
    rows.push(["Total dettes", formatCHF(totalDebts)]);
    rows.push(["Fortune nette", formatCHF(totalAssets - totalDebts)]);
  }
  if (rows.length) pdf.kvTable(rows);
  else pdf.paragraph("Aucune donnée patrimoniale renseignée.", { italic: true, muted: true });

  if (company) {
    pdf.section("Société rattachée");
    pdf.kvTable([
      ["Raison sociale", company.legal_name],
      ["Forme juridique", LEGAL_FORM_LABELS[company.legal_form] ?? "—"],
      ["Canton", cantonName(company.canton)],
      ["Rôle du client", client.company_role || "—"],
    ]);
  }
}

// ============================================================================
// SIMULATION (1 page par simulation)
// ============================================================================
function drawSimulationPage(pdf: ReportPdf, entry: HistoryEntry, includeCharts: boolean) {
  const kindLabel = KIND_LABELS[entry.kind as SimulationKind] || entry.kind;
  pdf.section(kindLabel);
  pdf.paragraph(entry.title, { italic: true, muted: true });

  // Section 1 · paramètres
  const params = formatInputs(entry);
  if (params.length) {
    pdf.spacer(2);
    pdf.section("Paramètres utilisés");
    pdf.kvTable(params);
  }

  // Section 2 · résultats clés
  const metrics = formatMetrics(entry);
  if (metrics.length) {
    pdf.spacer(2);
    pdf.section("Résultats clés");
    pdf.metricsGrid(metrics);
  }

  // Section 3 · graphique simplifié si pertinent
  if (includeCharts) {
    drawSimpleChart(pdf, entry);
  }

  // Section 4 · commentaire
  const comment = buildComment(entry);
  if (comment) {
    pdf.spacer(2);
    pdf.section("Analyse");
    pdf.paragraph(comment);
  }
}

function formatInputs(entry: HistoryEntry): Array<[string, string]> {
  const i = entry.inputs ?? {};
  const rows: Array<[string, string]> = [];
  switch (entry.kind) {
    case "lpp":
      pushIf(rows, "Âge actuel", i.currentAge);
      pushIf(rows, "Âge de retraite", i.retirementAge);
      pushIfChf(rows, "Salaire assuré", i.insuredSalary);
      pushIfChf(rows, "Avoir LPP actuel", i.currentBalance);
      pushIfChf(rows, "Capacité de rachat", i.buybackCapacity);
      pushIf(rows, "Étalement (années)", i.buybackYears);
      pushIfPct(rows, "Rendement attendu", i.expectedReturnRate);
      break;
    case "pillar3a":
      pushIfChf(rows, "Versement annuel", i.contribution);
      pushIf(rows, "Années jusqu'à la retraite", i.yearsToRetirement);
      pushIfPct(rows, "Rendement attendu", i.expectedReturn);
      pushStr(rows, "Canton", i.canton ? cantonName(String(i.canton)) : undefined);
      break;
    case "canton_compare":
      pushIfChf(rows, "Revenu imposable", i.taxableIncome);
      pushIfChf(rows, "Fortune imposable", i.taxableWealth);
      pushStr(rows, "Statut familial", localizeStatus(i.status));
      break;
    case "income_tax":
    case "source_tax":
      pushStr(rows, "Canton", i.canton ? cantonName(String(i.canton)) : undefined);
      pushIfChf(rows, "Revenu brut", i.grossIncome ?? i.income);
      pushStr(rows, "Statut familial", localizeStatus(i.status));
      break;
    case "retirement":
      pushIfChf(rows, "Capital LPP", i.capital);
      pushIfPct(rows, "Taux de conversion", i.conversionRate);
      pushIf(rows, "Âge", i.age);
      break;
    case "investment_compare": {
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      const nameA = str(a.name) || "Investissement A";
      const nameB = str(b.name) || "Investissement B";
      const freqLabel = (f: unknown) =>
        f === "monthly" ? "Mensuel" : f === "annual" ? "Annuel" : "Aucun";
      const typeLabel = (t: unknown) => {
        switch (t) {
          case "life_insurance": return "Assurance-vie";
          case "fund": return "Fonds de placement";
          case "etf": return "ETF";
          case "savings": return "Épargne / dépôt";
          case "pillar_3a": return "3e pilier A";
          case "pillar_3b": return "3e pilier B";
          default: return "Autre";
        }
      };
      const modeLabel = (m: unknown) => (m === "simple" ? "Intérêts simples" : "Intérêts composés");
      pushStr(rows, "Hypothèse A", nameA);
      pushStr(rows, "Hypothèse B", nameB);
      pushStr(rows, `Type · ${nameA}`, typeLabel(a.type));
      pushStr(rows, `Type · ${nameB}`, typeLabel(b.type));
      pushIf(rows, "Horizon (années)", a.durationYears ?? b.durationYears);
      pushIfChf(rows, `Capital initial · ${nameA}`, a.initialCapital);
      pushIfChf(rows, `Capital initial · ${nameB}`, b.initialCapital);
      pushStr(rows, `Fréquence versement · ${nameA}`, freqLabel(a.contributionFrequency));
      pushStr(rows, `Fréquence versement · ${nameB}`, freqLabel(b.contributionFrequency));
      pushIfChf(rows, `Versement périodique · ${nameA}`, a.periodicContribution);
      pushIfChf(rows, `Versement périodique · ${nameB}`, b.periodicContribution);
      pushIfPct(rows, `Rendement brut · ${nameA}`, a.grossReturnRate);
      pushIfPct(rows, `Rendement brut · ${nameB}`, b.grossReturnRate);
      pushIfPct(rows, `Frais annuels · ${nameA}`, a.annualFeeRate);
      pushIfPct(rows, `Frais annuels · ${nameB}`, b.annualFeeRate);
      pushIfPct(rows, `Imposition à la sortie · ${nameA}`, a.exitTaxRate);
      pushIfPct(rows, `Imposition à la sortie · ${nameB}`, b.exitTaxRate);
      pushStr(rows, `Mode de capitalisation · ${nameA}`, modeLabel(a.interestMode));
      pushStr(rows, `Mode de capitalisation · ${nameB}`, modeLabel(b.interestMode));
      break;
    }
    case "avs_ai":
      pushIf(rows, "Années cotisées", i.contributionYears);
      pushIfChf(rows, "Revenu annuel moyen", i.averageIncome);
      break;
    case "vested_benefits":
      pushIfChf(rows, "Capital de libre passage", i.balance);
      pushIf(rows, "Années avant retraite", i.yearsToRetirement);
      break;
    case "cross_border":
      pushIfChf(rows, "Salaire annuel", i.annualSalary);
      pushStr(rows, "Régime", localizeRegime(i.regime));
      break;
    case "tou":
      pushIfChf(rows, "Salaire brut", i.grossIncome);
      pushIfPct(rows, "Part suisse", i.swissShare);
      break;
    case "director_compensation":
      pushIfChf(rows, "Bénéfice avant rémunération", i.profitBeforeComp);
      pushIfChf(rows, "Salaire actuel", i.currentSalary);
      pushIfChf(rows, "Dividende actuel", i.currentDividend);
      pushStr(rows, "Canton société", i.companyCanton ? cantonName(String(i.companyCanton)) : undefined);
      pushStr(rows, "Canton dirigeant", i.directorCanton ? cantonName(String(i.directorCanton)) : undefined);
      break;
    case "health_insurance_france":
      pushIfChf(rows, "Salaire suisse brut", i.swissGrossSalaryCHF);
      pushStr(rows, "Situation civile", i.civilStatus === "married" ? "Marié·e / pacsé·e" : "Célibataire");
      pushIf(rows, "Enfants à charge", i.childrenCount);
      if (num(i.chfToEurRate)) rows.push(["Taux CHF→EUR", String(i.chfToEurRate)]);
      break;
    case "overtime":
      pushStr(rows, "Statut fiscal", str(i.taxStatus));
      pushStr(rows, "Canton de travail", i.workCanton ? cantonName(String(i.workCanton)) : undefined);
      pushIfChf(rows, "Salaire de base", i.baseAnnualSalaryCHF);
      pushIfChf(rows, "Heures sup brutes", i.overtimeAmountCHF);
      pushStr(rows, "Situation civile", i.civilStatus === "married" ? "Marié·e / pacsé·e" : "Célibataire");
      pushIf(rows, "Enfants à charge", i.childrenCount);
      pushIfPct(rows, "Taux marginal IR FR estimé", i.estimatedFrenchMarginalRate);
      break;
  }
  return rows;
}

function pushIf(rows: Array<[string, string]>, label: string, v: unknown) {
  const n = num(v);
  if (n) rows.push([label, String(n)]);
}
function pushIfChf(rows: Array<[string, string]>, label: string, v: unknown) {
  const n = num(v);
  if (n) rows.push([label, formatCHF(n)]);
}
function pushIfPct(rows: Array<[string, string]>, label: string, v: unknown) {
  const n = num(v);
  if (n) rows.push([label, formatPct(n, 2)]);
}
function pushStr(rows: Array<[string, string]>, label: string, v: string | undefined) {
  if (v) rows.push([label, v]);
}

function formatMetrics(
  entry: HistoryEntry,
): Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" }> {
  const s = entry.summary ?? {};
  const out: Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" }> = [];
  switch (entry.kind) {
    case "lpp":
      if (num(s.projectedBalance)) out.push({ label: "Capital projeté", value: num(s.projectedBalance), tone: "primary" });
      if (num(s.totalTaxSavings)) out.push({ label: "Économie fiscale rachats", value: num(s.totalTaxSavings), tone: "success" });
      if (num(s.annualPension)) out.push({ label: "Rente annuelle", value: num(s.annualPension) });
      break;
    case "pillar3a":
      if (num(s.taxSavings)) out.push({ label: "Économie fiscale annuelle", value: num(s.taxSavings), tone: "success" });
      if (num(s.projectedBalance)) out.push({ label: "Capital projeté", value: num(s.projectedBalance), tone: "primary" });
      break;
    case "canton_compare":
      if (num(s.maxSavings)) out.push({ label: "Économie max annuelle", value: num(s.maxSavings), tone: "success" });
      if (str(s.cheapestCanton)) out.push({ label: "Canton le moins cher", value: cantonName(str(s.cheapestCanton)) });
      if (str(s.referenceCanton)) out.push({ label: "Canton actuel", value: cantonName(str(s.referenceCanton)) });
      break;
    case "income_tax":
    case "source_tax":
      if (num(s.totalTax)) out.push({ label: "Impôt total", value: num(s.totalTax), tone: "warning" });
      if (num(s.netIncome)) out.push({ label: "Revenu net", value: num(s.netIncome), tone: "success" });
      break;
    case "retirement":
      if (num(s.netAnnuity)) out.push({ label: "Net rente", value: num(s.netAnnuity) });
      if (num(s.netLumpSum)) out.push({ label: "Net capital", value: num(s.netLumpSum) });
      if (str(s.recommendation)) out.push({ label: "Recommandation", value: str(s.recommendation)! });
      break;
    case "avs_ai":
      if (num(s.annualPension)) out.push({ label: "Rente AVS annuelle", value: num(s.annualPension) });
      if (num(s.missingYears)) out.push({ label: "Années manquantes", value: String(num(s.missingYears)), tone: "warning" });
      break;
    case "vested_benefits":
      if (num(s.recommendedFinalBalance)) out.push({ label: "Capital projeté (recommandé)", value: num(s.recommendedFinalBalance), tone: "primary" });
      if (num(s.securityFinalBalance)) out.push({ label: "Capital projeté (sécurité)", value: num(s.securityFinalBalance) });
      break;
    case "cross_border":
      if (num(s.currentTax)) out.push({ label: "Charge fiscale actuelle", value: num(s.currentTax), tone: "warning" });
      if (num(s.alternativeDelta)) out.push({ label: "Économie potentielle", value: num(s.alternativeDelta), tone: "success" });
      break;
    case "tou":
      if (num(s.touSaving)) out.push({ label: "Économie TOU", value: num(s.touSaving), tone: "success" });
      break;
    case "director_compensation":
      if (num(s.recommendedDirectorNet)) out.push({ label: "Net dirigeant optimisé", value: num(s.recommendedDirectorNet), tone: "success" });
      if (num(s.currentDirectorNet)) out.push({ label: "Net dirigeant actuel", value: num(s.currentDirectorNet) });
      if (num(s.gainAnnual)) out.push({ label: "Gain annuel", value: num(s.gainAnnual), tone: "primary" });
      break;
    case "investment_compare": {
      const i = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      const nameA = str(a.name) || "A";
      const nameB = str(b.name) || "B";
      if (num(s.aFinalNet)) out.push({ label: `Capital net · ${nameA}`, value: num(s.aFinalNet) });
      if (num(s.bFinalNet)) out.push({ label: `Capital net · ${nameB}`, value: num(s.bFinalNet) });
      if (num(s.netDifference)) out.push({ label: "Différence nette", value: num(s.netDifference), tone: "primary" });
      if (num(s.pctAdvantage)) out.push({ label: "Avantage relatif", value: formatPct(num(s.pctAdvantage)), tone: "success" });
      const w = str(s.winner);
      if (w && w !== "tie") out.push({ label: "Stratégie gagnante", value: w === "a" ? nameA : nameB, tone: "success" });
      break;
    }
    case "health_insurance_france": {
      const reco = str(s.recommended);
      const recoLabel = reco === "LAMAL" ? "LAMal (Suisse)" : reco === "CMU" ? "CMU (France)" : "—";
      if (reco) out.push({ label: "Option recommandée", value: recoLabel, tone: "primary" });
      if (num(s.recommendedAnnualCHF)) out.push({ label: "Cotisation annuelle (recommandé)", value: num(s.recommendedAnnualCHF), tone: "success" });
      if (num(s.savingsCHF)) out.push({ label: "Économie vs autre option", value: num(s.savingsCHF), tone: "success" });
      if (num(s.cmuAnnualCHF)) out.push({ label: "CMU", value: num(s.cmuAnnualCHF) });
      if (num(s.lamalAnnualCHF)) out.push({ label: "LAMal", value: num(s.lamalAnnualCHF) });
      break;
    }
    case "overtime": {
      if (num(s.netOvertimeCHF)) out.push({ label: "Net perçu sur heures sup", value: num(s.netOvertimeCHF), tone: "success" });
      if (num(s.taxSavings)) out.push({ label: "Économie fiscale (exonération FR)", value: num(s.taxSavings), tone: "success" });
      if (num(s.totalTaxOnOvertime)) out.push({ label: "Impôt total heures sup", value: num(s.totalTaxOnOvertime), tone: "warning" });
      if (num(s.overtimeCHF)) out.push({ label: "Heures sup brutes", value: num(s.overtimeCHF) });
      break;
    }
  }
  return out;
}

// Petit graphique natif : barres horizontales comparatives quand on a deux valeurs.
function drawSimpleChart(pdf: ReportPdf, entry: HistoryEntry) {
  const s = entry.summary ?? {};
  let pair: { left: { label: string; value: number }; right: { label: string; value: number } } | null = null;
  switch (entry.kind) {
    case "retirement":
      if (num(s.netAnnuity) && num(s.netLumpSum))
        pair = {
          left: { label: "Rente nette", value: num(s.netAnnuity) },
          right: { label: "Capital net", value: num(s.netLumpSum) },
        };
      break;
    case "vested_benefits":
      if (num(s.recommendedFinalBalance) && num(s.securityFinalBalance))
        pair = {
          left: { label: "Sécurité", value: num(s.securityFinalBalance) },
          right: { label: "Recommandée", value: num(s.recommendedFinalBalance) },
        };
      break;
    case "director_compensation":
      if (num(s.recommendedDirectorNet) && num(s.currentDirectorNet))
        pair = {
          left: { label: "Actuel", value: num(s.currentDirectorNet) },
          right: { label: "Optimisé", value: num(s.recommendedDirectorNet) },
        };
      break;
    case "investment_compare": {
      const i = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      const aNet = num(s.aFinalNet);
      const bNet = num(s.bFinalNet);
      if (aNet && bNet)
        pair = {
          left: { label: str(a.name) || "A", value: aNet },
          right: { label: str(b.name) || "B", value: bNet },
        };
      break;
    }
    case "cross_border":
      if (num(s.currentTax) && num(s.alternativeTax))
        pair = {
          left: { label: "Régime actuel", value: num(s.currentTax) },
          right: { label: "Régime alternatif", value: num(s.alternativeTax) },
        };
      break;
  }
  if (!pair) return;
  pdf.spacer(2);
  pdf.section("Comparaison visuelle");
  drawBarPair(pdf, pair.left, pair.right);
}

function drawBarPair(
  pdf: ReportPdf,
  a: { label: string; value: number },
  b: { label: string; value: number },
) {
  const { doc, margin, contentWidth } = pdf;
  const max = Math.max(a.value, b.value, 1);
  const labelW = 40;
  const valueW = 35;
  const barAreaW = contentWidth - labelW - valueW - 8;
  const rowH = 9;
  const startY = pdf.cursorY;
  [a, b].forEach((row, idx) => {
    const y = startY + idx * (rowH + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...pdf.ink);
    doc.text(row.label, margin, y + 6);
    const w = (row.value / max) * barAreaW;
    const isHigher = row.value >= max;
    const color: [number, number, number] = isHigher ? [22, 163, 74] : pdf.primary;
    doc.setFillColor(...color);
    doc.rect(margin + labelW, y + 1.5, Math.max(0.5, w), rowH - 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...pdf.ink);
    doc.text(formatCHF(row.value), margin + contentWidth, y + 6, { align: "right" });
  });
  pdf.cursorY = startY + 2 * (rowH + 3) + 4;
}

function buildComment(entry: HistoryEntry): string | null {
  const s = entry.summary ?? {};
  const i = entry.inputs ?? {};
  switch (entry.kind) {
    case "lpp": {
      const cap = num(i.buybackCapacity);
      const years = Math.max(1, num(i.buybackYears));
      const sav = num(s.totalTaxSavings);
      if (!cap || !sav) return null;
      const rate = ((sav / cap) * 100).toFixed(1).replace(".", ",");
      return `Un rachat de ${formatCHF(cap)}, étalé sur ${years} an${years > 1 ? "s" : ""}, génère une économie fiscale totale de ${formatCHF(sav)}, soit un retour fiscal moyen de ${rate} % du montant racheté. Concrètement, chaque franc versé dans le 2e pilier réduit d'autant le revenu imposable l'année du versement, tout en renforçant le capital de prévoyance qui sera converti en rente ou retiré à la retraite. Point de vigilance : un rachat LPP bloque tout retrait en capital pendant les 3 années qui suivent (art. 79b al. 3 LPP), à anticiper si un achat immobilier ou un départ à l'étranger est envisagé sur cet horizon.`;
    }
    case "pillar3a": {
      const sav = num(s.taxSavings);
      const c = num(i.contribution);
      if (!sav || !c) return null;
      return `Le versement annuel de ${formatCHF(c)} sur le 3e pilier A génère une économie fiscale récurrente de ${formatCHF(sav)} par an, intégralement déductible du revenu imposable dans la limite du plafond légal. Sur 10 ans, cette économie représente ${formatCHF(sav * 10)} cumulés, en plus de la constitution d'un capital de prévoyance supplémentaire. Point de vigilance : ce capital reste bloqué jusqu'à 5 ans avant l'âge ordinaire de la retraite, sauf exceptions prévues par la loi (achat de la résidence principale, départ définitif de Suisse, passage à l'indépendance).`;
    }
    case "canton_compare": {
      const sav = num(s.maxSavings);
      const cheap = str(s.cheapestCanton);
      const ref = str(s.referenceCanton);
      if (!sav || !cheap || !ref) return null;
      return `À revenu identique, un déménagement de ${cantonName(ref)} vers ${cantonName(cheap)} permettrait une économie annuelle de ${formatCHF(sav)} sur la charge fiscale totale, soit ${formatCHF(sav * 10)} cumulés sur 10 ans si la situation reste stable. Cet écart s'explique par les différences de barèmes cantonaux et de multiplicateurs communaux entre les deux cantons. Point de vigilance : un changement de domicile a des conséquences qui dépassent la seule fiscalité (emploi, scolarité des enfants, distance, coût de la vie local) et mérite une réflexion globale avant toute décision.`;
    }
    case "retirement": {
      const a = num(s.netAnnuity);
      const l = num(s.netLumpSum);
      const reco = str(s.recommendation);
      if (!a || !l) return null;
      const recoTxt =
        reco === "annuity"
          ? "La rente viagère ressort comme l'option la plus avantageuse dans ce scénario, offrant un revenu garanti à vie."
          : reco === "lump_sum"
            ? "Le retrait en capital ressort comme l'option la plus avantageuse dans ce scénario, sous réserve d'une gestion disciplinée du capital sur la durée."
            : "Les deux options sont proches en termes de résultat net, une solution mixte permettant d'équilibrer sécurité et performance.";
      return `La comparaison oppose la rente viagère (${formatCHF(a)} net par an, versée à vie) au retrait en capital (${formatCHF(l)} net après l'impôt unique sur le capital de prévoyance). ${recoTxt} Ce choix dépend fortement de facteurs propres au client : son espérance de vie, l'existence d'un conjoint à protéger, sa tolérance au risque de placement, et une éventuelle volonté de transmission du capital restant à ses héritiers, ce que la rente viagère ne permet pas.`;
    }
    case "director_compensation": {
      const reco = num(s.recommendedDirectorNet);
      const cur = num(s.currentDirectorNet);
      const gain = num(s.gainAnnual) || (cur > 0 ? reco - cur : 0);
      if (gain <= 0) return null;
      return `En ajustant le mix salaire / dividende / réserves à structure de société constante, le dirigeant peut dégager un gain net annuel de ${formatCHF(gain)}, soit ${formatCHF(gain * 10)} cumulés sur 10 ans. Ce gain provient de l'optimisation des charges sociales et de la fiscalité différenciée entre salaire et dividendes qualifiés. Point de vigilance : toute réduction significative du salaire doit rester compatible avec l'usage de la branche, au risque d'une requalification par l'AFC ou l'AVS au titre de la théorie du dividende dissimulé (art. 58 CO).`;
    }
    case "vested_benefits": {
      const r = num(s.recommendedFinalBalance);
      const sec = num(s.securityFinalBalance);
      if (!r || !sec) return null;
      const diff = Math.max(0, r - sec);
      return `La stratégie de placement recommandée projette un capital de libre passage de ${formatCHF(r)} à l'échéance, contre ${formatCHF(sec)} pour une stratégie purement sécuritaire, soit un gain potentiel de ${formatCHF(diff)} avant fiscalité au retrait. Ce résultat dépend directement du niveau de risque accepté sur l'horizon de placement retenu. Point de vigilance : ces projections restent des hypothèses de rendement, non garanties ; l'horizon de placement et la tolérance au risque du client doivent être validés avant toute mise en œuvre.`;
    }
    case "investment_compare": {
      const i = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      const nameA = str(a.name) || "Investissement A";
      const nameB = str(b.name) || "Investissement B";
      const years = num(a.durationYears) || num(b.durationYears);
      const diff = num(s.netDifference);
      const pct = num(s.pctAdvantage);
      const w = str(s.winner);
      const aNet = num(s.aFinalNet);
      const bNet = num(s.bFinalNet);
      if (!diff || !w || w === "tie") {
        return `Sur ${years || "l'horizon retenu"} an${(years || 0) > 1 ? "s" : ""}, les deux placements comparés (${nameA} et ${nameB}) aboutissent à un capital net final comparable, une fois frais et fiscalité de sortie déduits. La décision se jouera donc surtout sur des critères non chiffrés : liquidité du placement, appétence au risque, et cohérence avec les autres avoirs du client.${entry.note ? ` ${entry.note.trim()}` : ""}`;
      }
      const winnerName = w === "a" ? nameA : nameB;
      const loserName = w === "a" ? nameB : nameA;
      const winnerNet = w === "a" ? aNet : bNet;
      const loserNet = w === "a" ? bNet : aNet;
      const pctTxt = pct ? ` (soit +${formatPct(pct)})` : "";
      return `Sur ${years || "l'horizon retenu"} an${(years || 0) > 1 ? "s" : ""}, ${winnerName} dégage un capital net de ${formatCHF(winnerNet)} contre ${formatCHF(loserNet)} pour ${loserName}, un avantage net de ${formatCHF(diff)}${pctTxt} en faveur de ${winnerName}. Cette comparaison intègre les frais de gestion annuels et l'imposition à la sortie, et reste exprimée en valeurs nominales, sans effet de l'inflation.${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "health_insurance_france": {
      const reco = str(s.recommended);
      const cot = num(s.recommendedAnnualCHF);
      const sav = num(s.savingsCHF);
      if (!reco || !cot) return entry.note?.trim() || null;
      const recoLabel = reco === "LAMAL" ? "LAMal (Suisse)" : "CMU (France, gérée par le CNTFS via l'URSSAF)";
      const otherLabel = reco === "LAMAL" ? "CMU" : "LAMal";
      const savTxt = sav > 0 ? ` Cela représente une économie annuelle de ${formatCHF(sav)} par rapport à l'option ${otherLabel}.` : "";
      return `Pour ce profil de frontalier, l'affiliation ${recoLabel} ressort comme la plus avantageuse, avec une cotisation annuelle estimée à ${formatCHF(cot)}.${savTxt} Ce calcul s'appuie sur les barèmes 2026 (PASS 47'100 EUR, taux CMU 8 %, abattement individuel de 25 % du PASS). Point de vigilance : le choix entre CMU et LAMal engage sur une période donnée et a des conséquences sur la couverture maladie de toute la famille, à valider au cas par cas.${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "overtime": {
      const net = num(s.netOvertimeCHF);
      const sav = num(s.taxSavings);
      const total = num(s.totalTaxOnOvertime);
      const brut = num(s.overtimeCHF);
      if (!brut) return entry.note?.trim() || null;
      const savTxt = sav > 0 ? ` L'exonération partielle côté français sur les heures supplémentaires génère une économie fiscale de ${formatCHF(sav)}.` : "";
      return `Sur ${formatCHF(brut)} d'heures supplémentaires brutes, l'imposition combinée Suisse/France atteint ${formatCHF(total)}, pour un montant net effectivement perçu de ${formatCHF(net)}.${savTxt}${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "avs_ai": {
      const monthly = num(s.monthlyPension);
      const annual = num(s.annualPension);
      const theoretical = num(s.theoreticalAnnualPension);
      const missing = num(s.missingYears);
      const isCouple = Boolean(s.isCouple);
      const combined = num(s.combinedAnnualPension);
      if (!annual) return null;
      const missingTxt =
        missing > 0
          ? ` Il manque actuellement ${missing} année${missing > 1 ? "s" : ""} de cotisation pour atteindre la rente complète (${formatCHF(theoretical)} par an), chaque année manquante réduisant la rente d'environ 1/44e.`
          : ` La carrière de cotisation est complète (échelle 44), la rente correspond donc au maximum atteignable pour ce revenu déterminant.`;
      const coupleTxt = isCouple && combined > 0 ? ` En couple, la rente combinée plafonnée s'élève à ${formatCHF(combined)} par an (plafond légal de 150 % de la rente maximale individuelle).` : "";
      return `La rente AVS/AI projetée s'élève à ${formatCHF(monthly)} par mois, soit ${formatCHF(annual)} par an.${missingTxt}${coupleTxt} Cette estimation reste indicative : la rente définitive est arrêtée par la caisse de compensation cantonale sur la base de l'Extrait de Compte Individuel (CI) officiel, à demander gratuitement avant tout engagement définitif du client sur cette base.`;
    }
    case "tax_global": {
      const total = num(s.totalTaxCHF);
      const net = num(s.netAnnualCHF);
      const eff = num(s.effectiveRate);
      const marg = num(s.marginalRate);
      const regimeLabel = str(s.regimeLabel);
      const foreignShare = num(s.foreignShareCHF);
      if (!total) return null;
      const regimeTxt = regimeLabel ? ` selon le régime fiscal détecté : ${regimeLabel}` : "";
      const foreignTxt = foreignShare > 0 ? ` Une part de ${formatCHF(foreignShare)} relève d'un revenu de source étrangère, prise en compte uniquement pour déterminer le taux d'imposition applicable (méthode d'exemption avec réserve de progressivité), sans être elle-même imposée en Suisse.` : "";
      return `La charge fiscale totale estimée s'élève à ${formatCHF(total)} par an${regimeTxt}, pour un revenu net disponible de ${formatCHF(net)}. Le taux effectif ressort à ${formatPct(eff)} du revenu brut, tandis que le taux marginal de ${formatPct(marg)} indique la charge fiscale sur le prochain franc gagné, un repère utile pour évaluer l'intérêt d'une déduction supplémentaire (3a, rachat LPP).${foreignTxt} Cette estimation se base sur les barèmes 2026 et la situation déclarée ; elle doit être confirmée par la déclaration fiscale officielle du client.`;
    }
    case "cross_border":
    case "tou":
    case "income_tax":
    case "source_tax":
      return entry.note?.trim() || null;
    default:
      return null;
  }
}

// ============================================================================
// COMPARAISON AVANT / APRÈS
// ============================================================================
function drawComparisonPage(
  pdf: ReportPdf,
  entries: HistoryEntry[],
  pension: ClientPension | null,
  _assets: ClientAssets | null,
) {
  pdf.section("Synthèse globale · Situation avant et après optimisation");
  pdf.paragraph(
    "Ce tableau agrège les résultats de l'ensemble des simulations sélectionnées et chiffre l'impact global des optimisations identifiées.",
    { muted: true, italic: true },
  );

  const rows: Array<[string, string, string, string]> = [];

  // Capital LPP
  const lpp = entries.find((e) => e.kind === "lpp");
  if (lpp) {
    const before = num(pension?.lpp_current_balance);
    const after = num(lpp.summary?.projectedBalance);
    rows.push([
      "Capital LPP projeté à la retraite",
      formatCHF(before),
      formatCHF(after),
      formatDelta(after - before),
    ]);
  }
  // 3a
  const p3a = entries.find((e) => e.kind === "pillar3a");
  if (p3a) {
    const proj = num(p3a.summary?.projectedBalance);
    rows.push(["Pilier 3a cumulé à la retraite", formatCHF(0), formatCHF(proj), formatDelta(proj)]);
  }
  // Canton compare
  const cc = entries.find((e) => e.kind === "canton_compare");
  if (cc) {
    const sav = num(cc.summary?.maxSavings);
    rows.push(["Charge fiscale annuelle (déménagement)", "—", `-${formatCHF(sav)}`, formatDelta(-sav)]);
  }
  // Director
  const dc = entries.find((e) => e.kind === "director_compensation");
  if (dc) {
    const cur = num(dc.summary?.currentDirectorNet);
    const reco = num(dc.summary?.recommendedDirectorNet);
    if (cur && reco) {
      rows.push(["Net annuel dirigeant", formatCHF(cur), formatCHF(reco), formatDelta(reco - cur)]);
    }
  }
  // Tous gains agrégés
  for (const e of entries) {
    if (["lpp", "pillar3a", "canton_compare", "director_compensation"].includes(e.kind)) continue;
    const g = extractGain(e);
    if (g.type === "none") continue;
    rows.push([
      KIND_LABELS[e.kind],
      "—",
      g.type === "annual" ? `${formatCHF(g.amount)} / an` : formatCHF(g.amount),
      formatDelta(g.amount),
    ]);
  }

  if (rows.length === 0) {
    pdf.paragraph("Aucune simulation chiffrée disponible pour la comparaison.", {
      italic: true,
      muted: true,
    });
  } else {
    pdf.table(["Indicateur", "Avant", "Après", "Delta"], rows);
  }

  // Bloc "Gain total identifié"
  const totals = computeTotals(entries);
  pdf.spacer(4);
  drawGainHighlight(pdf, totals);
}

function formatDelta(v: number): string {
  if (!v) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${formatCHF(v)}`;
}

interface Totals {
  oneTime: number;
  annual: number;
  details: string[];
}
function computeTotals(entries: HistoryEntry[]): Totals {
  let oneTime = 0;
  let annual = 0;
  const details: string[] = [];
  for (const e of entries) {
    const g = extractGain(e);
    if (g.type === "annual") {
      annual += g.amount;
      details.push(`${formatCHF(g.amount)}/an (${KIND_LABELS[e.kind]})`);
    } else if (g.type === "one_time") {
      oneTime += g.amount;
      details.push(`${formatCHF(g.amount)} (${KIND_LABELS[e.kind]})`);
    }
  }
  return { oneTime, annual, details };
}

function drawGainHighlight(pdf: ReportPdf, totals: Totals) {
  const HORIZON = 10;
  const total = totals.oneTime + totals.annual * HORIZON;
  const { doc, margin, contentWidth } = pdf;
  const h = 38;
  pdf.ensureSpace(h + 4);
  const y = pdf.cursorY;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, h, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52);
  doc.text("GAIN TOTAL IDENTIFIÉ (sur 10 ans)", margin + 6, y + 8);
  doc.setFontSize(22);
  doc.setTextColor(22, 163, 74);
  doc.text(formatCHF(total), margin + contentWidth - 6, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...pdf.ink);
  const detail =
    `Détail : ${formatCHF(totals.oneTime)} de gains ponctuels` +
    (totals.annual > 0
      ? ` + ${formatCHF(totals.annual)}/an récurrents (= ${formatCHF(totals.annual * HORIZON)} sur 10 ans)`
      : "");
  const lines = doc.splitTextToSize(detail, contentWidth - 12) as string[];
  doc.text(lines, margin + 6, y + 28);
  pdf.cursorY = y + h + 4;
}


// ============================================================================
// CONCLUSION
// ============================================================================
function drawConclusionPage(pdf: ReportPdf, entries: HistoryEntry[]) {
  pdf.section("Recommandations chiffrées");
  if (entries.length === 0) {
    pdf.paragraph("Aucune recommandation : effectuez d'abord des simulations depuis la fiche client.", {
      italic: true,
      muted: true,
    });
  } else {
    let n = 1;
    for (const e of entries) {
      const g = extractGain(e);
      if (g.type === "none") continue;
      const amount =
        g.type === "annual" ? `${formatCHF(g.amount)} / an` : formatCHF(g.amount);
      pdf.paragraph(`${n}. ${g.label} · Gain estimé : ${amount}.${g.details ? ` ${g.details}.` : ""}`);
      n++;
    }
  }

  pdf.spacer(4);
  pdf.section("Prochaines étapes");
  pdf.paragraph(
    "Prenez rendez-vous avec votre courtier pour mettre en œuvre ces optimisations. Les démarches administratives (rachat LPP, ouverture d'un 3e pilier, changement de canton, restructuration de la rémunération dirigeant) peuvent être accompagnées par votre conseiller.",
  );

  pdf.spacer(4);
  pdf.section("Avertissement");
  pdf.paragraph(
    `Les projections présentées dans ce document sont des estimations basées sur les paramètres fiscaux et sociaux en vigueur en ${new Date().getFullYear()}. Elles ne constituent ni un conseil fiscal ni un engagement contractuel. Les barèmes peuvent évoluer et les hypothèses (rendement, durée, revenu) peuvent ne pas se réaliser. Une analyse personnalisée auprès d'un fiduciaire ou d'un fiscaliste est recommandée avant toute décision.`,
    { muted: true },
  );
}

export { makeFilename };
