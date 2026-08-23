// Générateur PDF "Dossier de synthèse" multi-pages pour un client.
// V1 : 100 % en français. Le multilingue PDF sera traité dans une phase ultérieure.
import { ReportPdf, makeFilename, tint, shade, type PdfHeaderInfo } from "./builder";
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
import type { HistoryEntry, HistoryKpi, SimulationKind } from "@/lib/history/types";
import { KIND_LABELS } from "@/lib/history/types";
import { extractKpis } from "@/lib/history/registry";

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
// Distingue "la donnée existe" (y compris si elle vaut 0, un résultat
// parfaitement valide) de "la donnée est absente". Avant ce correctif,
// `if (num(x))` traitait 0 comme absent et faisait disparaître des tuiles
// et des paragraphes entiers alors que 0 est une information à part entière.
const has = (v: unknown): boolean => {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return v.trim() !== "" && !Number.isNaN(Number(v));
  return false;
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
// EXPLICATIONS PÉDAGOGIQUES PAR TYPE DE CALCULATEUR
// Un paragraphe fixe, écrit comme un courtier l'expliquerait à un client qui
// découvre le sujet, affiché en tête de chaque page de simulation.
// ============================================================================
const EXPLAIN_FR: Partial<Record<SimulationKind, string>> = {
  lpp: "La LPP est votre 2e pilier : une épargne retraite obligatoire dès que votre salaire dépasse un certain seuil. Chaque mois, une partie de votre salaire y est versée et complétée par votre employeur, puis ce capital grandit avec les intérêts jusqu'à votre retraite. Vous pouvez aussi, sous certaines conditions, verser volontairement un montant supplémentaire (un rachat) pour augmenter ce capital. Chaque rachat réduit également l'impôt que vous payez l'année où vous le versez.",
  pillar3a: "Le 3e pilier A est une épargne retraite volontaire, encouragée par l'État : tout ce que vous y versez, dans la limite d'un montant maximum chaque année, réduit directement votre revenu imposable. En échange, ce capital reste bloqué jusqu'à 5 ans avant votre retraite, sauf dans quelques cas particuliers (achat de votre logement, départ définitif de Suisse, passage à l'indépendance). Il profite aussi d'une fiscalité avantageuse au moment du retrait.",
  canton_compare: "Pour un même revenu, l'impôt que vous payez peut fortement varier d'un canton suisse à l'autre. Ce comparateur calcule votre imposition dans plusieurs cantons, à situation strictement identique, pour objectiver ce que changerait réellement un déménagement sur le plan fiscal, indépendamment de toute autre considération personnelle ou professionnelle.",
  tax_global: "Ce calculateur reconstitue l'ensemble de votre charge fiscale annuelle (impôt fédéral, cantonal et communal réunis), sur la base de votre situation personnelle et professionnelle. Il fait ressortir deux chiffres utiles : votre taux d'imposition moyen sur l'ensemble de votre revenu, et votre taux marginal, c'est-à-dire ce que vous payez d'impôt sur le prochain franc que vous gagnez. Ce second chiffre est particulièrement utile pour savoir si une déduction supplémentaire, comme un versement 3a ou un rachat LPP, vaut la peine pour vous.",
  income_tax: "Ce calcul détermine l'impôt sur le revenu que vous devez, sur la base des barèmes cantonaux et fédéraux en vigueur pour votre situation.",
  source_tax: "L'impôt à la source s'applique automatiquement si vous êtes salarié étranger sans permis d'établissement C : votre employeur prélève directement l'impôt sur votre salaire, selon un barème qui dépend de votre situation familiale et de votre canton.",
  retirement: "Au moment de la retraite, vous avez le choix entre toucher une rente à vie, ou retirer tout ou partie de votre capital de prévoyance en une fois. C'est une décision importante et difficile à revenir en arrière. Ce calculateur compare les deux options sur la base de votre espérance de vie, du taux de conversion applicable et de votre situation fiscale, pour vous aider à objectiver ce choix.",
  avs_ai: "L'AVS est votre 1er pilier, le socle obligatoire de la prévoyance suisse. Son montant dépend de deux choses : le nombre d'années où vous avez cotisé (44 ans pour une carrière complète) et votre revenu moyen sur l'ensemble de votre carrière. Chaque année de cotisation manquante réduit votre rente finale.",
  vested_benefits: "Le libre passage correspond à votre capital LPP en transit entre deux emplois, ou lorsque vous quittez temporairement le marché du travail suisse. Ce capital doit être placé sur un compte ou une police dédiée, et la stratégie de placement que vous choisissez influence directement le montant dont vous disposerez à votre prochain emploi ou à la retraite.",
  cross_border: "En tant que frontalier, la façon dont vous êtes imposé dépend d'accords particuliers entre la Suisse et votre pays de résidence, qui peuvent varier sensiblement d'un canton de travail à l'autre. Ce calculateur compare votre charge fiscale selon les différents régimes qui pourraient s'appliquer à votre situation.",
  tou: "Si vous êtes imposé à la source, vous pouvez, sous certaines conditions, demander à passer à la taxation ordinaire (la TOU). Cela vous ouvre droit à des déductions supplémentaires que le barème source ne prend pas en compte, comme le 3e pilier A, vos frais professionnels réels, ou une pension alimentaire versée. Ce calcul objective si cette démarche est financièrement intéressante pour vous.",
  director_compensation: "En tant que dirigeant actionnaire de votre société, la façon dont vous répartissez salaire, dividendes et réserves a un impact direct sur votre charge sociale et fiscale globale : salaire et dividendes ne sont pas imposés de la même manière. Ce calculateur simule plusieurs répartitions pour identifier celle qui vous est la plus avantageuse, dans le respect des règles fiscales applicables.",
  investment_compare: "Ce calculateur compare deux placements ou stratégies sur une durée donnée, en tenant compte des frais de gestion annuels et de l'impôt applicable à la sortie, pour déterminer lequel vous laisse le plus de capital net à l'échéance.",
  health_insurance_france: "En tant que frontalier résidant en France, vous pouvez choisir entre l'assurance maladie suisse (LAMal) et la couverture maladie universelle française (CMU). Ce choix doit être fait dans les 3 mois suivant le début de votre activité en Suisse, et vous engage pour longtemps : il mérite une comparaison chiffrée précise.",
  overtime: "Si vous êtes frontalier sous l'accord franco-suisse de 1983, vos heures supplémentaires peuvent, sous certaines conditions, être partiellement exonérées d'impôt sur le revenu en France. Ce calculateur détermine le montant exonérable et l'économie fiscale réelle que cela représente pour vous.",
};

function explainKind(kind: SimulationKind): string {
  return (
    EXPLAIN_FR[kind] ??
    "Cette simulation présente les résultats du calculateur correspondant, sur la base des données saisies pour ce client."
  );
}
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

  // ---------- VUE D'ENSEMBLE ----------
  // Les chiffres clés d'abord, avant le détail sujet par sujet : le client
  // repart avec l'essentiel même s'il ne relit jamais les pages suivantes.
  pdf.newPage();
  toc.push({ title: "Vue d'ensemble", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawOverviewPage(pdf, pension, assets, entries);

  // ---------- PROFIL CLIENT ----------
  pdf.newPage();
  toc.push({ title: "Profil client", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawClientProfile(pdf, client, pension, assets, company);

  // ---------- PAGES SIMULATIONS ----------
  // Les simulations s'enchaînent à la suite les unes des autres, sans saut
  // de page forcé entre chacune (le passage à la page suivante ne se
  // déclenche que si le contenu déborde réellement, via ensureSpace).
  //
  // Détection des paires "situation actuelle / situation projetée" : pour
  // chaque calculateur présent, si une sauvegarde est marquée comme
  // référence (is_baseline, choisie par le courtier sur la fiche client) ET
  // qu'une sauvegarde plus récente du même calculateur est aussi incluse
  // dans ce dossier, les deux se dessinent ensemble comme un duo comparatif
  // plutôt que comme deux pages de simulation indépendantes.
  const byKind = new Map<SimulationKind, HistoryEntry[]>();
  for (const e of entries) {
    const k = e.kind as SimulationKind;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k)!.push(e);
  }
  const spreadPairs = new Map<SimulationKind, { baseline: HistoryEntry; projected: HistoryEntry }>();
  for (const [kind, list] of byKind) {
    const baseline = list.find((e) => e.is_baseline);
    if (!baseline) continue;
    const candidates = list
      .filter((e) => e.id !== baseline.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const projected = candidates[0];
    if (!projected) continue;
    spreadPairs.set(kind, { baseline, projected });
  }

  const drawnPairKinds = new Set<SimulationKind>();
  for (const entry of entries) {
    const kind = entry.kind as SimulationKind;
    const pair = spreadPairs.get(kind);
    if (pair) {
      if (drawnPairKinds.has(kind)) continue; // l'autre moitié de la paire a déjà tout dessiné
      drawnPairKinds.add(kind);
      pdf.spacer(6);
      const kindLabel = KIND_LABELS[kind] || kind;
      toc.push({ title: `${kindLabel} : actuelle / projetée`, page: pdf.doc.getCurrentPageInfo().pageNumber });
      drawComparisonSpread(pdf, kind, pair.baseline, pair.projected, options.includeCharts);
      continue;
    }
    pdf.spacer(6);
    const kindLabel = KIND_LABELS[kind] || kind;
    const title = entry.title?.trim()
      ? `${kindLabel} : ${entry.title.trim()}`
      : kindLabel;
    toc.push({ title, page: pdf.doc.getCurrentPageInfo().pageNumber });
    drawSimulationPage(pdf, entry, options.includeCharts);
  }

  // ---------- AVANT/APRÈS ----------
  pdf.newPage();
  toc.push({ title: "Comparatif avant / après", page: pdf.doc.getCurrentPageInfo().pageNumber });
  drawComparisonPage(pdf, entries, pension, assets, spreadPairs);

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

  // Repère avant le titre : identifie immédiatement la nature du document.
  pdf.cursorY = 58;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primary);
  doc.text("DOSSIER DE SYNTHÈSE", pageWidth / 2, pdf.cursorY, { align: "center" });
  pdf.cursorY += 10;

  // Grand titre central
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...ink);
  const titleLines = doc.splitTextToSize(
    "Votre situation et vos options",
    pageWidth - margin * 2,
  ) as string[];
  doc.text(titleLines, pageWidth / 2, pdf.cursorY, { align: "center" });
  pdf.cursorY += titleLines.length * 11 + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...muted);
  doc.text(fullName, pageWidth / 2, pdf.cursorY, { align: "center" });
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
  doc.setFillColor(...tint(primary, 0.95));
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

  // Mention bas de page — corrige une incohérence : le document est remis
  // au client, "usage interne" n'avait pas de sens ici.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Document confidentiel, préparé exclusivement pour ${fullName}.`, pageWidth / 2, pageHeight - 25, {
    align: "center",
  });
}

// ============================================================================
// VUE D'ENSEMBLE
// ============================================================================
function drawOverviewPage(
  pdf: ReportPdf,
  pension: ClientPension | null,
  assets: ClientAssets | null,
  entries: HistoryEntry[],
) {
  pdf.section("Votre situation en un coup d'oeil");
  pdf.paragraph(
    "Ce dossier détaille, sujet par sujet, votre situation actuelle et l'impact des pistes évoquées aujourd'hui. Voici d'abord l'essentiel.",
  );

  const tiles: Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" | "accent" }> = [];

  if (assets) {
    const totalAssets =
      Number(assets.bank_accounts) +
      Number(assets.securities) +
      Number(assets.real_estate_value) +
      Number(assets.vehicles) +
      Number(assets.other_assets);
    const totalDebts = Number(assets.mortgage_debt) + Number(assets.other_debts);
    tiles.push({ label: "Patrimoine net", value: totalAssets - totalDebts });
  }
  if (pension && has(pension.lpp_current_balance)) {
    tiles.push({ label: "Capital LPP actuel", value: num(pension.lpp_current_balance) });
  }

  // Chiffre fiscal "tête de dossier" : priorité au calcul le plus complet
  // (fiscalité globale), sinon on retombe sur un calcul d'impôt simple.
  const taxGlobal = entries.find((e) => e.kind === "tax_global");
  const incomeTax = entries.find((e) => e.kind === "income_tax");
  if (taxGlobal && has(taxGlobal.summary?.totalTaxCHF)) {
    tiles.push({ label: "Charge fiscale totale", value: num(taxGlobal.summary?.totalTaxCHF), tone: "warning" });
    if (has(taxGlobal.summary?.netAnnualCHF)) {
      tiles.push({ label: "Revenu net annuel", value: num(taxGlobal.summary?.netAnnualCHF), tone: "success" });
    }
  } else if (incomeTax && has(incomeTax.summary?.totalTax)) {
    tiles.push({ label: "Impôt total", value: num(incomeTax.summary?.totalTax), tone: "warning" });
  }

  // Même horizon (10 ans) et même calcul que le bloc "Gain total identifié"
  // de la page comparatif avant/après : ce chiffre est un teaser, il ne
  // doit jamais diverger de celui détaillé plus loin dans le même dossier.
  const totals = computeTotals(entries);
  const totalGain = totals.oneTime + totals.annual * 10;
  if (totalGain > 0) {
    tiles.push({ label: "Gain identifié (sur 10 ans)", value: totalGain, tone: "accent" });
  }

  if (tiles.length > 0) {
    pdf.spacer(2);
    pdf.metricsGrid(tiles);
  } else {
    pdf.paragraph(
      "Les chiffres clés apparaîtront ici une fois le patrimoine et les simulations renseignés.",
      { italic: true, muted: true },
    );
  }

  pdf.spacer(4);
  pdf.paragraph(
    "Le détail de chaque sujet, avec votre situation actuelle puis projetée le cas échéant, commence page suivante.",
    { muted: true, italic: true },
  );
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

  pdf.spacer(4);
  pdf.section("Situation fiscale");
  pdf.kvTable([
    ["Canton de domicile", cantonName(client.canton)],
    ["Commune", client.commune || "—"],
    ["Statut fiscal", TAX_STATUS_LABELS[client.tax_status] ?? "—"],
    ["Permis", PERMIT_LABELS[client.permit] ?? "—"],
    ["Confession", CONFESSION_LABELS[client.confession] ?? "—"],
  ]);

  pdf.spacer(4);
  pdf.section("Activité professionnelle");
  pdf.kvTable([
    ["Statut professionnel", WORK_STATUS_LABELS[client.work_status] ?? "—"],
    ["Employeur", client.employer || "—"],
    ["Salaire brut annuel", client.gross_annual_salary != null ? formatCHF(client.gross_annual_salary) : "—"],
    ["Bonus", client.bonus != null ? formatCHF(client.bonus) : "—"],
    ["Taux d'activité", client.activity_rate != null ? formatPct(client.activity_rate, 0) : "—"],
    ["Plan LPP", pension ? LPP_PLAN_LABELS[pension.lpp_plan] ?? "—" : "—"],
  ]);

  pdf.spacer(4);
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
  pdf.calculatorTitle(kindLabel, entry.title);

  // Explication pédagogique : de quoi parle ce calculateur, en langage clair.
  pdf.spacer(1);
  pdf.paragraph(explainKind(entry.kind as SimulationKind));

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
    // On réserve la place du bandeau "Résultats clés" ET de la grille de
    // tuiles qui le suit, avant de dessiner quoi que ce soit. Sans ça, le
    // bandeau seul passe le test de place, se dessine, puis la grille
    // constate qu'elle ne tient pas et saute seule à la page suivante,
    // laissant le bandeau orphelin derrière elle.
    const gridRows = Math.ceil(metrics.length / 2);
    const gridHeight = gridRows * 28 + 2;
    pdf.spacer(2);
    pdf.ensureSpace(15 + gridHeight);
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

// ============================================================================
// DUO "SITUATION ACTUELLE / SITUATION PROJETÉE"
// Remplace drawSimulationPage pour un calculateur dont une sauvegarde a été
// marquée comme référence (is_baseline) par le courtier : les deux
// sauvegardes s'affichent l'une après l'autre, avec les écarts chiffrés
// entre les deux, plutôt que comme deux pages de simulation indépendantes.
// ============================================================================
function formatKpiValue(v: number | string, unit?: "CHF" | "%" | null): string {
  if (typeof v === "string") return v;
  if (unit === "CHF") return formatCHF(v);
  if (unit === "%") return `${v.toFixed(2)} %`;
  return v.toLocaleString("fr-CH");
}

function kpiDelta(base: HistoryKpi, cur: HistoryKpi): string {
  if (typeof base.value !== "number" || typeof cur.value !== "number") return "";
  const d = cur.value - base.value;
  if (d === 0) return "";
  const sign = d > 0 ? "+" : "";
  if (base.unit === "CHF") return ` (${sign}${formatCHF(d)})`;
  if (base.unit === "%") return ` (${sign}${d.toFixed(2)} pts)`;
  return ` (${sign}${d})`;
}

function drawComparisonSpread(
  pdf: ReportPdf,
  kind: SimulationKind,
  baseline: HistoryEntry,
  projected: HistoryEntry,
  includeCharts: boolean,
) {
  const kindLabel = KIND_LABELS[kind] || kind;
  pdf.calculatorTitle(kindLabel, "Situation actuelle et projetée");
  pdf.spacer(1);
  pdf.paragraph(explainKind(kind));

  const baseKpis = extractKpis(kind, baseline.summary ?? {});
  const projKpis = extractKpis(kind, projected.summary ?? {});

  // ---- Situation actuelle ----
  pdf.spacer(3);
  pdf.situationBanner();
  if (baseKpis.length) {
    pdf.kvTable(baseKpis.map((k) => [k.label, formatKpiValue(k.value, k.unit)] as [string, string]));
  }
  const baseComment = buildComment(baseline);
  if (baseComment) pdf.paragraph(baseComment, { muted: true });
  pdf.paragraph(`Basé sur la sauvegarde du ${dateFR(baseline.created_at)}.`, { italic: true, muted: true });

  // ---- Situation projetée ----
  pdf.spacer(4);
  pdf.projectionBanner();
  if (projKpis.length) {
    pdf.kvTable(
      projKpis.map((k, i) => {
        const delta = baseKpis[i] ? kpiDelta(baseKpis[i], k) : "";
        return [k.label, `${formatKpiValue(k.value, k.unit)}${delta}`] as [string, string];
      }),
    );
  }

  const gain = extractGain(projected);
  if (gain.type !== "none") {
    const amountTxt = gain.type === "annual" ? `${formatCHF(gain.amount)} par an` : formatCHF(gain.amount);
    pdf.callout(`Ce que vous gagnez : ${amountTxt}.${gain.details ? ` ${gain.details}` : ""}`, "accent");
  }
  const projComment = buildComment(projected);
  if (projComment) pdf.paragraph(projComment);
  pdf.paragraph(
    `Basé sur la sauvegarde du ${dateFR(projected.created_at)}, comparée automatiquement à votre situation actuelle.`,
    { italic: true, muted: true },
  );

  if (includeCharts) {
    const firstChf = baseKpis.find((k) => k.unit === "CHF" && typeof k.value === "number");
    const projValue = firstChf ? projKpis.find((k) => k.label === firstChf.label) : undefined;
    if (firstChf && projValue && typeof firstChf.value === "number" && typeof projValue.value === "number") {
      pdf.spacer(2);
      pdf.section("Comparaison visuelle");
      drawBarPair(
        pdf,
        { label: "Situation actuelle", value: firstChf.value },
        { label: "Situation projetée", value: projValue.value },
      );
    }
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
      pushStr(rows, "Canton de référence", i.referenceCanton ? cantonName(String(i.referenceCanton)) : undefined);
      pushIfChf(rows, "Salaire brut annuel", i.grossSalary);
      pushIfChf(rows, "Salaire brut conjoint", i.spouseGrossSalary);
      pushStr(rows, "Statut familial", localizeStatus(i.civilStatus));
      pushIf(rows, "Enfants", i.children);
      pushIfChf(rows, "Fortune nette", i.netWealth);
      break;
    case "tax_global":
      pushStr(rows, "Canton", i.canton ? cantonName(String(i.canton)) : undefined);
      pushStr(rows, "Statut familial", localizeStatus(i.civilStatus));
      pushIf(rows, "Enfants", i.children);
      pushIf(rows, "Âge", i.age);
      pushIfChf(rows, "Salaire brut annuel", i.grossSalary);
      pushIfChf(rows, "Bonus", i.bonus);
      pushIfChf(rows, "Autres revenus", i.otherIncome);
      pushIfChf(rows, "Intérêts hypothécaires", i.mortgageInterest);
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
      if (has(s.projectedBalance)) out.push({ label: "Capital projeté", value: num(s.projectedBalance), tone: "primary" });
      if (has(s.totalTaxSavings)) out.push({ label: "Économie fiscale rachats", value: num(s.totalTaxSavings), tone: "success" });
      if (has(s.annualPension)) out.push({ label: "Rente annuelle", value: num(s.annualPension) });
      if (has(s.monthlyPension)) out.push({ label: "Rente mensuelle", value: num(s.monthlyPension) });
      if (has(s.totalBuybacks)) out.push({ label: "Rachats cumulés", value: num(s.totalBuybacks) });
      break;
    case "pillar3a":
      if (has(s.taxSavings)) out.push({ label: "Économie fiscale annuelle", value: num(s.taxSavings), tone: "success" });
      if (has(s.finalBalance)) out.push({ label: "Capital projeté", value: num(s.finalBalance), tone: "primary" });
      if (has(s.effectiveCost)) out.push({ label: "Coût net réel", value: num(s.effectiveCost) });
      if (has(s.marginalRate)) out.push({ label: "Taux marginal", value: formatPct(num(s.marginalRate)), tone: "warning" });
      if (has(s.totalContributions)) out.push({ label: "Cotisations cumulées", value: num(s.totalContributions) });
      break;
    case "canton_compare":
      if (str(s.referenceCanton)) out.push({ label: "Canton actuel", value: cantonName(str(s.referenceCanton)) });
      if (has(s.referenceTax)) out.push({ label: "Charge fiscale actuelle", value: num(s.referenceTax), tone: "warning" });
      if (str(s.cheapestCanton)) out.push({ label: "Canton le moins cher", value: cantonName(str(s.cheapestCanton)) });
      if (has(s.cheapestTax)) out.push({ label: "Charge fiscale la plus basse", value: num(s.cheapestTax) });
      if (has(s.maxSavings)) out.push({ label: "Économie max annuelle", value: num(s.maxSavings), tone: "success" });
      break;
    case "tax_global":
      if (has(s.totalTaxCHF)) out.push({ label: "Impôt total", value: num(s.totalTaxCHF), tone: "warning" });
      if (has(s.netAnnualCHF)) out.push({ label: "Revenu net annuel", value: num(s.netAnnualCHF), tone: "success" });
      if (has(s.effectiveRate)) out.push({ label: "Taux effectif", value: formatPct(num(s.effectiveRate)) });
      if (has(s.marginalRate)) out.push({ label: "Taux marginal", value: formatPct(num(s.marginalRate)) });
      if (str(s.regimeLabel)) out.push({ label: "Régime fiscal", value: str(s.regimeLabel)! });
      break;
    case "income_tax":
    case "source_tax":
      if (has(s.totalTax)) out.push({ label: "Impôt total", value: num(s.totalTax), tone: "warning" });
      if (has(s.netIncome)) out.push({ label: "Revenu net", value: num(s.netIncome), tone: "success" });
      break;
    case "retirement": {
      if (has(s.netAnnuity)) out.push({ label: "Net rente", value: num(s.netAnnuity) });
      if (has(s.netLumpSum)) out.push({ label: "Net capital", value: num(s.netLumpSum) });
      if (has(s.lumpTaxTotal)) out.push({ label: "Impôt retrait capital", value: num(s.lumpTaxTotal), tone: "warning" });
      const reco = str(s.recommendation);
      const recoLabel =
        reco === "annuity" ? "La rente viagère" : reco === "lump_sum" ? "Le retrait en capital" : reco === "mixed" ? "Solution mixte" : undefined;
      if (recoLabel) out.push({ label: "Option recommandée", value: recoLabel, tone: "success" });
      break;
    }
    case "avs_ai":
      if (has(s.annualPension)) out.push({ label: "Rente AVS annuelle", value: num(s.annualPension) });
      if (has(s.monthlyPension)) out.push({ label: "Rente AVS mensuelle", value: num(s.monthlyPension) });
      if (has(s.missingYears)) out.push({ label: "Années manquantes", value: String(num(s.missingYears)), tone: "warning" });
      break;
    case "vested_benefits":
      if (has(s.recommendedFinalBalance)) out.push({ label: "Capital projeté (recommandé)", value: num(s.recommendedFinalBalance), tone: "primary" });
      if (has(s.securityFinalBalance)) out.push({ label: "Capital projeté (sécurité)", value: num(s.securityFinalBalance) });
      break;
    case "cross_border":
      if (has(s.currentTax)) out.push({ label: "Charge fiscale actuelle", value: num(s.currentTax), tone: "warning" });
      if (has(s.alternativeDelta)) out.push({ label: "Économie potentielle", value: num(s.alternativeDelta), tone: "success" });
      break;
    case "tou":
      if (has(s.touSaving)) out.push({ label: "Économie TOU", value: num(s.touSaving), tone: "success" });
      break;
    case "director_compensation":
      if (has(s.recommendedDirectorNet)) out.push({ label: "Net dirigeant optimisé", value: num(s.recommendedDirectorNet), tone: "success" });
      if (has(s.currentDirectorNet)) out.push({ label: "Net dirigeant actuel", value: num(s.currentDirectorNet) });
      if (has(s.gainAnnual)) out.push({ label: "Gain annuel", value: num(s.gainAnnual), tone: "primary" });
      break;
    case "investment_compare": {
      const i = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (i.a ?? {}) as Record<string, unknown>;
      const b = (i.b ?? {}) as Record<string, unknown>;
      const nameA = str(a.name) || "A";
      const nameB = str(b.name) || "B";
      if (has(s.aFinalNet)) out.push({ label: `Capital net · ${nameA}`, value: num(s.aFinalNet) });
      if (has(s.bFinalNet)) out.push({ label: `Capital net · ${nameB}`, value: num(s.bFinalNet) });
      if (has(s.netDifference)) out.push({ label: "Différence nette", value: num(s.netDifference), tone: "primary" });
      if (has(s.pctAdvantage)) out.push({ label: "Avantage relatif", value: formatPct(num(s.pctAdvantage)), tone: "success" });
      const w = str(s.winner);
      if (w && w !== "tie") out.push({ label: "Stratégie gagnante", value: w === "a" ? nameA : nameB, tone: "success" });
      break;
    }
    case "health_insurance_france": {
      const reco = str(s.recommended);
      const recoLabel = reco === "LAMAL" ? "LAMal (Suisse)" : reco === "CMU" ? "CMU (France)" : "—";
      if (reco) out.push({ label: "Option recommandée", value: recoLabel, tone: "primary" });
      if (has(s.recommendedAnnualCHF)) out.push({ label: "Cotisation annuelle (recommandé)", value: num(s.recommendedAnnualCHF), tone: "success" });
      if (has(s.savingsCHF)) out.push({ label: "Économie vs autre option", value: num(s.savingsCHF), tone: "success" });
      if (has(s.cmuAnnualCHF)) out.push({ label: "CMU", value: num(s.cmuAnnualCHF) });
      if (has(s.lamalAnnualCHF)) out.push({ label: "LAMal", value: num(s.lamalAnnualCHF) });
      break;
    }
    case "overtime": {
      if (has(s.netOvertimeCHF)) out.push({ label: "Net perçu sur heures sup", value: num(s.netOvertimeCHF), tone: "success" });
      if (has(s.taxSavings)) out.push({ label: "Économie fiscale (exonération FR)", value: num(s.taxSavings), tone: "success" });
      if (has(s.totalTaxOnOvertime)) out.push({ label: "Impôt total heures sup", value: num(s.totalTaxOnOvertime), tone: "warning" });
      if (has(s.overtimeCHF)) out.push({ label: "Heures sup brutes", value: num(s.overtimeCHF) });
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
    case "pillar3a":
      if (num(s.totalContributions) && num(s.finalBalance))
        pair = {
          left: { label: "Cotisations versées", value: num(s.totalContributions) },
          right: { label: "Capital projeté", value: num(s.finalBalance) },
        };
      break;
    case "lpp":
      if (num(s.projectedBalanceNoYield) && num(s.projectedBalance))
        pair = {
          left: { label: "Capital sans rendement", value: num(s.projectedBalanceNoYield) },
          right: { label: "Capital projeté", value: num(s.projectedBalance) },
        };
      break;
    case "tax_global":
      if (num(s.netAnnualCHF) && num(s.totalTaxCHF))
        pair = {
          left: { label: "Impôt total", value: num(s.totalTaxCHF) },
          right: { label: "Revenu net annuel", value: num(s.netAnnualCHF) },
        };
      break;
    case "canton_compare":
      if (num(s.referenceTax) && num(s.cheapestTax))
        pair = {
          left: { label: str(s.referenceCanton) ? cantonName(str(s.referenceCanton)) : "Canton actuel", value: num(s.referenceTax) },
          right: { label: str(s.cheapestCanton) ? cantonName(str(s.cheapestCanton)) : "Canton le moins cher", value: num(s.cheapestTax) },
        };
      break;
    case "avs_ai":
      if (num(s.theoreticalAnnualPension) && num(s.annualPension) && num(s.missingYears) > 0)
        pair = {
          left: { label: "Rente actuelle projetée", value: num(s.annualPension) },
          right: { label: "Rente pleine (44 ans)", value: num(s.theoreticalAnnualPension) },
        };
      break;
    case "health_insurance_france":
      if (num(s.cmuAnnualCHF) && num(s.lamalAnnualCHF))
        pair = {
          left: { label: "CMU (France)", value: num(s.cmuAnnualCHF) },
          right: { label: "LAMal (Suisse)", value: num(s.lamalAnnualCHF) },
        };
      break;
    case "overtime":
      if (num(s.overtimeCHF) && num(s.netOvertimeCHF))
        pair = {
          left: { label: "Heures sup brutes", value: num(s.overtimeCHF) },
          right: { label: "Net perçu", value: num(s.netOvertimeCHF) },
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
      const proj = num(s.projectedBalance);
      if (!has(s.totalTaxSavings) && !has(s.projectedBalance)) return null;
      if (sav > 0) {
        const rate = ((sav / Math.max(1, cap)) * 100).toFixed(1).replace(".", ",");
        return `Un rachat de ${formatCHF(cap)}, étalé sur ${years} an${years > 1 ? "s" : ""}, vous ferait économiser ${formatCHF(sav)} d'impôts au total, soit un retour fiscal moyen de ${rate} % du montant racheté. Concrètement, chaque franc versé dans votre 2e pilier réduit d'autant votre revenu imposable l'année du versement, tout en renforçant votre capital de prévoyance qui sera converti en rente ou retiré à la retraite. Point de vigilance : un rachat LPP bloque tout retrait en capital pendant les 3 années qui suivent (art. 79b al. 3 LPP), à anticiper si un achat immobilier ou un départ à l'étranger est envisagé sur cet horizon.`;
      }
      return `Votre capital LPP projeté à la retraite s'élève à ${formatCHF(proj)}, sur la base des paramètres saisis (âge, salaire assuré, rendement attendu). Aucun rachat n'a été simulé ici, ou celui-ci ne génère pas d'économie fiscale supplémentaire dans ce scénario ; une capacité de rachat existe peut-être encore, à vérifier sur le certificat de prévoyance du client.`;
    }
    case "pillar3a": {
      const sav = num(s.taxSavings);
      const c = num(i.contribution);
      const bal = num(s.finalBalance);
      if (!has(s.taxSavings) && !has(s.finalBalance)) return null;
      if (sav > 0 && c > 0) {
        return `Votre versement annuel de ${formatCHF(c)} sur le 3e pilier A vous fait économiser ${formatCHF(sav)} d'impôts chaque année, intégralement déductible de votre revenu imposable dans la limite du plafond légal. Sur 10 ans, cette économie représente ${formatCHF(sav * 10)} cumulés, en plus de la constitution d'un capital de prévoyance supplémentaire. Point de vigilance : ce capital reste bloqué jusqu'à 5 ans avant l'âge ordinaire de la retraite, sauf exceptions prévues par la loi (achat de votre résidence principale, départ définitif de Suisse, passage à l'indépendance).`;
      }
      return `Sur la base d'un versement annuel de ${formatCHF(c)}, votre capital 3a projeté à la retraite atteindrait ${formatCHF(bal)}. Aucune économie fiscale supplémentaire n'a été chiffrée dans ce scénario précis, votre taux marginal d'imposition étant peut-être déjà nul ou très faible sur cette tranche de revenu ; le 3a conserve néanmoins tout son intérêt comme outil d'épargne bloquée à long terme.`;
    }
    case "canton_compare": {
      const sav = num(s.maxSavings);
      const cheap = str(s.cheapestCanton);
      const ref = str(s.referenceCanton);
      if (!cheap || !ref) return null;
      if (sav > 0) {
        return `À revenu identique, un déménagement de ${cantonName(ref)} vers ${cantonName(cheap)} vous ferait économiser ${formatCHF(sav)} par an sur votre charge fiscale totale, soit ${formatCHF(sav * 10)} cumulés sur 10 ans si votre situation reste stable. Cet écart s'explique par les différences de barèmes cantonaux et de multiplicateurs communaux entre les deux cantons. Point de vigilance : un changement de domicile a des conséquences qui dépassent la seule fiscalité (emploi, scolarité des enfants, distance, coût de la vie local) et mérite une réflexion globale avant toute décision.`;
      }
      return `Pour ce profil, le canton de ${cantonName(ref)} ressort déjà comme le plus avantageux ou proche du plus avantageux parmi les cantons comparés (${cantonName(cheap)}) : un changement de domicile n'apporterait pas d'économie fiscale significative dans ce scénario précis.`;
    }
    case "retirement": {
      const a = num(s.netAnnuity);
      const l = num(s.netLumpSum);
      if (!has(s.netAnnuity) && !has(s.netLumpSum)) return null;
      const reco = str(s.recommendation);
      const recoTxt =
        reco === "annuity"
          ? "La rente viagère ressort comme l'option la plus avantageuse dans votre scénario, avec un revenu garanti à vie."
          : reco === "lump_sum"
            ? "Le retrait en capital ressort comme l'option la plus avantageuse dans votre scénario, sous réserve d'une gestion disciplinée du capital sur la durée."
            : "Les deux options sont proches en termes de résultat net pour vous, une solution mixte permettant d'équilibrer sécurité et performance.";
      return `La comparaison oppose la rente viagère (${formatCHF(a)} net par an, versée à vie) au retrait en capital (${formatCHF(l)} net après l'impôt unique sur le capital de prévoyance). ${recoTxt} Ce choix dépend fortement de facteurs qui vous sont propres : votre espérance de vie, l'existence d'un conjoint à protéger, votre tolérance au risque de placement, et votre éventuelle volonté de transmettre le capital restant à vos héritiers, ce que la rente viagère ne permet pas.`;
    }
    case "director_compensation": {
      const reco = num(s.recommendedDirectorNet);
      const cur = num(s.currentDirectorNet);
      const gain = has(s.gainAnnual) ? num(s.gainAnnual) : (cur > 0 ? reco - cur : 0);
      if (!has(s.recommendedDirectorNet)) return null;
      if (gain > 0) {
        return `En ajustant le mix salaire / dividende / réserves à structure de société constante, vous pourriez dégager un gain net annuel de ${formatCHF(gain)}, soit ${formatCHF(gain * 10)} cumulés sur 10 ans. Ce gain provient de l'optimisation des charges sociales et de la fiscalité différenciée entre salaire et dividendes qualifiés. Point de vigilance : toute réduction significative de votre salaire doit rester compatible avec l'usage de la branche, au risque d'une requalification par l'AFC ou l'AVS au titre de la théorie du dividende dissimulé (art. 58 CO).`;
      }
      return `La répartition actuelle entre salaire et dividendes ressort déjà comme proche de l'optimum pour ce profil de société : le gain supplémentaire identifié en ajustant le mix salaire / dividende / réserves reste marginal ou nul dans ce scénario précis.`;
    }
    case "vested_benefits": {
      const r = num(s.recommendedFinalBalance);
      const sec = num(s.securityFinalBalance);
      if (!has(s.recommendedFinalBalance) || !has(s.securityFinalBalance)) return null;
      const diff = Math.max(0, r - sec);
      return `La stratégie de placement recommandée vous projette un capital de libre passage de ${formatCHF(r)} à l'échéance, contre ${formatCHF(sec)} pour une stratégie purement sécuritaire, soit un gain potentiel de ${formatCHF(diff)} avant fiscalité au retrait. Ce résultat dépend directement du niveau de risque que vous acceptez sur l'horizon de placement retenu. Point de vigilance : ces projections restent des hypothèses de rendement, non garanties ; votre horizon de placement et votre tolérance au risque doivent être validés avant toute mise en oeuvre.`;
    }
    case "investment_compare": {
      const i2 = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (i2.a ?? {}) as Record<string, unknown>;
      const b = (i2.b ?? {}) as Record<string, unknown>;
      const nameA = str(a.name) || "Investissement A";
      const nameB = str(b.name) || "Investissement B";
      const years = num(a.durationYears) || num(b.durationYears);
      const diff = num(s.netDifference);
      const pct = num(s.pctAdvantage);
      const w = str(s.winner);
      const aNet = num(s.aFinalNet);
      const bNet = num(s.bFinalNet);
      if (!w) return entry.note?.trim() || null;
      if (!diff || w === "tie") {
        return `Sur ${years || "l'horizon retenu"} an${(years || 0) > 1 ? "s" : ""}, les deux placements comparés (${nameA} et ${nameB}) aboutissent pour vous à un capital net final comparable, une fois frais et fiscalité de sortie déduits. Votre décision se jouera donc surtout sur des critères non chiffrés : liquidité du placement, votre appétence au risque, et la cohérence avec le reste de votre patrimoine.${entry.note ? ` ${entry.note.trim()}` : ""}`;
      }
      const winnerName = w === "a" ? nameA : nameB;
      const loserName = w === "a" ? nameB : nameA;
      const winnerNet = w === "a" ? aNet : bNet;
      const loserNet = w === "a" ? bNet : aNet;
      const pctTxt = pct ? ` (soit +${formatPct(pct)})` : "";
      return `Sur ${years || "l'horizon retenu"} an${(years || 0) > 1 ? "s" : ""}, ${winnerName} vous dégage un capital net de ${formatCHF(winnerNet)} contre ${formatCHF(loserNet)} pour ${loserName}, un avantage net de ${formatCHF(diff)}${pctTxt} en faveur de ${winnerName}. Cette comparaison intègre les frais de gestion annuels et l'imposition à la sortie, et reste exprimée en valeurs nominales, sans effet de l'inflation.${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "health_insurance_france": {
      const reco = str(s.recommended);
      const cot = num(s.recommendedAnnualCHF);
      const sav = num(s.savingsCHF);
      if (!reco) return entry.note?.trim() || null;
      const recoLabel = reco === "LAMAL" ? "LAMal (Suisse)" : "CMU (France, gérée par le CNTFS via l'URSSAF)";
      const otherLabel = reco === "LAMAL" ? "CMU" : "LAMal";
      const savTxt = sav > 0 ? ` Cela représente pour vous une économie annuelle de ${formatCHF(sav)} par rapport à l'option ${otherLabel}.` : "";
      return `Pour votre profil de frontalier, l'affiliation ${recoLabel} ressort comme la plus avantageuse, avec une cotisation annuelle estimée à ${formatCHF(cot)}.${savTxt} Ce calcul s'appuie sur les barèmes 2026 (PASS 47'100 EUR, taux CMU 8 %, abattement individuel de 25 % du PASS). Point de vigilance : le choix entre CMU et LAMal vous engage sur une période donnée et a des conséquences sur la couverture maladie de toute votre famille, à valider au cas par cas.${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "overtime": {
      const net = num(s.netOvertimeCHF);
      const sav = num(s.taxSavings);
      const total = num(s.totalTaxOnOvertime);
      const brut = num(s.overtimeCHF);
      if (!has(s.overtimeCHF)) return entry.note?.trim() || null;
      const savTxt = sav > 0 ? ` L'exonération partielle côté français sur vos heures supplémentaires vous fait économiser ${formatCHF(sav)}.` : " Aucune exonération n'a été appliquée dans ce scénario, le statut fiscal retenu n'y ouvrant pas droit ou le seuil d'heures minimal n'étant pas atteint.";
      return `Sur ${formatCHF(brut)} d'heures supplémentaires brutes, l'imposition combinée Suisse/France atteint ${formatCHF(total)}, pour un montant net que vous percevez effectivement de ${formatCHF(net)}.${savTxt}${entry.note ? ` ${entry.note.trim()}` : ""}`;
    }
    case "avs_ai": {
      const monthly = num(s.monthlyPension);
      const annual = num(s.annualPension);
      const theoretical = num(s.theoreticalAnnualPension);
      const missing = num(s.missingYears);
      const isCouple = Boolean(s.isCouple);
      const combined = num(s.combinedAnnualPension);
      if (!has(s.annualPension)) return null;
      const missingTxt =
        missing > 0
          ? ` Il vous manque actuellement ${missing} année${missing > 1 ? "s" : ""} de cotisation pour atteindre la rente complète (${formatCHF(theoretical)} par an), chaque année manquante réduisant votre rente d'environ 1/44e.`
          : ` Votre carrière de cotisation est complète (échelle 44), votre rente correspond donc au maximum atteignable pour ce revenu déterminant.`;
      const coupleTxt = isCouple && combined > 0 ? ` En couple, votre rente combinée plafonnée s'élève à ${formatCHF(combined)} par an (plafond légal de 150 % de la rente maximale individuelle).` : "";
      return `Votre rente AVS/AI projetée s'élève à ${formatCHF(monthly)} par mois, soit ${formatCHF(annual)} par an.${missingTxt}${coupleTxt} Cette estimation reste indicative : votre rente définitive sera arrêtée par votre caisse de compensation cantonale sur la base de votre Extrait de Compte Individuel (CI) officiel, à demander gratuitement avant tout engagement définitif sur cette base.`;
    }
    case "tax_global": {
      const total = num(s.totalTaxCHF);
      const net = num(s.netAnnualCHF);
      const eff = num(s.effectiveRate);
      const marg = num(s.marginalRate);
      const regimeLabel = str(s.regimeLabel);
      const foreignShare = num(s.foreignShareCHF);
      if (!has(s.totalTaxCHF)) return null;
      const regimeTxt = regimeLabel ? ` selon le régime fiscal détecté pour votre situation : ${regimeLabel}` : "";
      const foreignTxt = foreignShare > 0 ? ` Une part de ${formatCHF(foreignShare)} relève d'un revenu de source étrangère, prise en compte uniquement pour déterminer votre taux d'imposition applicable (méthode d'exemption avec réserve de progressivité), sans être elle-même imposée en Suisse.` : "";
      return `Votre charge fiscale totale estimée s'élève à ${formatCHF(total)} par an${regimeTxt}, pour un revenu net disponible de ${formatCHF(net)}. Votre taux effectif ressort à ${formatPct(eff)} de votre revenu brut, tandis que votre taux marginal de ${formatPct(marg)} indique la charge fiscale sur le prochain franc que vous gagnez, un repère utile pour évaluer l'intérêt d'une déduction supplémentaire (3a, rachat LPP).${foreignTxt} Cette estimation se base sur les barèmes 2026 et votre situation déclarée ; elle doit être confirmée par votre déclaration fiscale officielle.`;
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
  spreadPairs: Map<SimulationKind, { baseline: HistoryEntry; projected: HistoryEntry }>,
) {
  pdf.section("Synthèse globale · Situation avant et après optimisation");
  pdf.paragraph(
    "Ce tableau agrège les résultats de l'ensemble des simulations sélectionnées et chiffre l'impact global des optimisations identifiées pour ce client. Chaque ligne compare la situation de départ (avant toute action) à la situation projetée une fois l'optimisation mise en oeuvre.",
    { muted: true, italic: true },
  );

  const rows: Array<[string, string, string, string]> = [];

  // Capital LPP — utilise la paire actuelle/projetée explicite si le
  // courtier en a marqué une (voir spreadPairs), pour ne jamais afficher un
  // écart différent de celui déjà détaillé sur la page de comparaison du
  // calculateur. À défaut, retombe sur l'ancien calcul (solde LPP actuel de
  // la fiche client vs la première simulation LPP incluse).
  const lppPair = spreadPairs.get("lpp");
  const lpp = lppPair?.projected ?? entries.find((e) => e.kind === "lpp");
  if (lpp) {
    const before = lppPair
      ? num(lppPair.baseline.summary?.projectedBalance)
      : num(pension?.lpp_current_balance);
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
    const proj = num(p3a.summary?.finalBalance);
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
    pdf.spacer(2);
    pdf.paragraph(
      "La colonne « Delta » indique le gain net apporté par chaque optimisation, ponctuel pour un rachat ou un retrait, récurrent lorsqu'il s'agit d'une économie annuelle. Ces montants sont ensuite consolidés ci-dessous.",
      { muted: true, italic: true },
    );
  }

  // Bloc "Gain total identifié"
  const totals = computeTotals(entries);
  pdf.spacer(4);
  drawGainHighlight(pdf, totals);

  if (totals.oneTime > 0 || totals.annual > 0) {
    pdf.spacer(3);
    pdf.paragraph(
      "Ce total combine les gains ponctuels (rachats, retraits optimisés) et les économies récurrentes projetées sur 10 ans, à situation constante. Il s'agit d'un ordre de grandeur destiné à objectiver la conversation avec le client, pas d'un engagement contractuel : chaque optimisation nécessite une mise en oeuvre concrète et un suivi dans le temps.",
      { muted: true, italic: true },
    );
  }
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
  const gains = entries
    .map((e) => ({ entry: e, gain: extractGain(e) }))
    .filter((x) => x.gain.type !== "none")
    .sort((a, b) => b.gain.amount - a.gain.amount);

  if (entries.length === 0) {
    pdf.paragraph("Aucune recommandation : effectuez d'abord des simulations depuis la fiche client.", {
      italic: true,
      muted: true,
    });
  } else if (gains.length === 0) {
    pdf.paragraph(
      "Les simulations réalisées documentent la situation du client mais n'ont pas fait ressortir de gain chiffrable direct. Elles restent néanmoins utiles pour objectiver les choix à venir.",
      { italic: true, muted: true },
    );
  } else {
    pdf.paragraph(
      `${gains.length} optimisation${gains.length > 1 ? "s ont" : " a"} été identifiée${gains.length > 1 ? "s" : ""} sur la base des simulations réalisées avec ce client, classées ci-dessous par ordre d'impact financier décroissant.`,
    );
    pdf.spacer(2);
    let n = 1;
    for (const { gain: g } of gains) {
      const amount =
        g.type === "annual" ? `${formatCHF(g.amount)} par an` : `${formatCHF(g.amount)}, gain ponctuel`;
      pdf.paragraph(`${n}. ${g.label}. Gain estimé : ${amount}.${g.details ? ` ${g.details}.` : ""}`);
      n++;
    }
  }

  pdf.spacer(4);
  pdf.section("Prochaines étapes");
  pdf.paragraph(
    "Prenez rendez-vous avec votre courtier pour mettre en oeuvre ces optimisations. Les démarches administratives (rachat LPP, ouverture d'un 3e pilier, changement de canton, restructuration de la rémunération dirigeant) peuvent être accompagnées par votre conseiller, qui reste votre interlocuteur privilégié pour toute question complémentaire.",
  );

  pdf.spacer(4);
  pdf.section("Avertissement");
  pdf.paragraph(
    `Les projections présentées dans ce document sont des estimations basées sur les paramètres fiscaux et sociaux en vigueur en ${new Date().getFullYear()}. Elles ne constituent ni un conseil fiscal ni un engagement contractuel. Les barèmes peuvent évoluer et les hypothèses retenues (rendement, durée, revenu, stabilité de la situation personnelle) peuvent ne pas se réaliser telles quelles. Une analyse personnalisée auprès d'un fiduciaire ou d'un fiscaliste est recommandée avant toute décision définitive.`,
    { muted: true },
  );
}
export { makeFilename };
