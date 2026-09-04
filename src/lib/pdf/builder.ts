// Builder PDF générique pour les rapports de simulation SwissBroker Pro.
// Ajoute en-tête, pied de page paginé, sections titrées, tableaux, blocs explicatifs.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatCHF } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getActiveLocale } from "@/lib/i18n/format";

// ---------------------------------------------------------------------------
// Sanitisation Unicode -> WinAnsi (CP1252) pour la police Helvetica par défaut
// de jsPDF. Tout caractère non supporté provoque un rendu erratique :
// soit un glyphe absent (Ã pour σ), soit un cascade d'espaces parasites
// dans la même cellule de tableau (« C H F  0 »). On remplace donc en amont
// les caractères problématiques par leur équivalent ASCII / texte court.
const PDF_CHAR_MAP: Record<string, string> = {
  // séparateurs invisibles -> apostrophe suisse
  "\u00A0": " ",
  "\u202F": "'",
  "\u2009": "'",
  "\u2007": "'",
  // tirets typographiques -> tiret ASCII
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2012": "-", // figure dash
  "\u2013": "-", // en-dash
  "\u2014": "-", // em-dash
  "\u2015": "-", // horizontal bar
  "\u2212": "-", // minus sign
  // guillemets typographiques -> ASCII
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u201F": '"',
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  // ellipses
  "\u2026": "...",
  // marques diverses
  "\u00AB": '"', // « guillemet français ouvrant -> "
  "\u00BB": '"', // » guillemet français fermant -> "
  // grec (statistiques) -> texte
  "σ": "sigma",
  "Σ": "Sigma",
  "α": "alpha",
  "β": "beta",
  "γ": "gamma",
  "δ": "delta",
  "π": "pi",
  "λ": "lambda",
  "μ": "µ", // µ existe en WinAnsi (0xB5)
  "Δ": "Delta",
  "Ω": "Ohm",
  // mathématiques absents de WinAnsi
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "⇒": "=>",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "≈": "~",
  "√": "racine",
  "∞": "inf",
  "✓": "OK",
  "✗": "X",
  "•": "·", // · existe en WinAnsi (0xB7)
  "⁰": "0",
  "¹": "1",
  // ² ³ existent (0xB2 0xB3) -> on garde
  "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/**
 * Convertit un texte arbitraire en chaîne sûre pour jsPDF (Helvetica WinAnsi).
 * - Remplace les caractères non WinAnsi par un équivalent ASCII / texte.
 * - Tout codepoint > 0xFF restant est remplacé par "?" pour éviter les Ã.
 */
export function sanitizePdfText(input: unknown): string {
  if (input === null || input === undefined) return "";
  const raw = typeof input === "string" ? input : String(input);
  let out = "";
  for (const ch of raw) {
    const mapped = PDF_CHAR_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    // ASCII + Latin-1 supplément couvrent l'essentiel de WinAnsi
    if (cp <= 0xff) {
      out += ch;
    } else {
      out += "?";
    }
  }
  return out;
}

function sanitizeCell(v: unknown): string {
  return sanitizePdfText(v);
}

export interface BrokerHeader {
  brokerName?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  brokerageName?: string;
  primaryColor?: string; // hex
  accentColor?: string; // hex
  footerNote?: string;
  logoDataUrl?: string; // base64 data URL du logo cabinet (PNG/JPG)
}

export interface PdfHeaderInfo extends BrokerHeader {
  title: string;
  subtitle?: string;
}

function hex(h: string | undefined, fb: [number, number, number]): [number, number, number] {
  if (!h) return fb;
  const s = h.replace("#", "").trim();
  if (s.length !== 6) return fb;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return [r, g, b].some(Number.isNaN) ? fb : [r, g, b];
}

// Éclaircit/assombrit une couleur vers le blanc/noir. Sert à dériver les
// fonds pastel (callouts, cellules mises en évidence) et les bandeaux
// foncés directement depuis la couleur du courtier (primaryColor/accentColor),
// au lieu de teintes fixes qui ne juraient qu'avec le bleu par défaut.
export function tint(c: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(c[0] + (255 - c[0]) * amount),
    Math.round(c[1] + (255 - c[1]) * amount),
    Math.round(c[2] + (255 - c[2]) * amount),
  ];
}
export function shade(c: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(c[0] * (1 - amount)),
    Math.round(c[1] * (1 - amount)),
    Math.round(c[2] * (1 - amount)),
  ];
}

// Arrondit au palier supérieur "lisible" (ex. 187'400 -> 200'000 plutôt que
// 206'140) pour les graduations d'axe des graphiques natifs ci-dessous.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = NICE_STEPS.find((s) => s >= norm) ?? 10;
  return step * mag;
}

// Couleurs sémantiques "actuel" (rouge) / "projeté" (vert), identiques à la
// convention déjà utilisée à l'écran (SplitCompareLayout : destructive/success).
export const COMPARE_RED: [number, number, number] = [220, 38, 38];
const RED = COMPARE_RED;
const RED_BG: [number, number, number] = [254, 242, 242];
const RED_BORDER: [number, number, number] = [252, 165, 165];
export const COMPARE_GREEN: [number, number, number] = [5, 150, 105];
const GREEN = COMPARE_GREEN;
const GREEN_BG: [number, number, number] = [236, 253, 245];
const GREEN_BORDER: [number, number, number] = [110, 231, 183];

export class ReportPdf {
  private footerDrawnPages = new Set<number>();
  doc: jsPDF;
  cursorY = 0;
  margin = 15;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  primary: [number, number, number];
  accent: [number, number, number];
  muted = [100, 116, 139] as [number, number, number];
  ink = [15, 23, 42] as [number, number, number];
  border = [226, 232, 240] as [number, number, number];
  surface = [248, 250, 252] as [number, number, number];

  // Géométrie en-tête
  private readonly bandH = 14;
  private readonly headerH = 40;
  private readonly logoBoxW = 26;
  private readonly logoBoxH = 18;

  constructor(public header: PdfHeaderInfo) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    // Monkey-patch doc.text pour sanitiser TOUT texte écrit dans le PDF
    // (y compris via jspdf-autotable). Garantit l'absence de glyphes
    // manquants (Ã pour σ) et d'artefacts d'espacement liés à l'encodage
    // UTF-16 fallback de jsPDF lorsqu'un caractère hors WinAnsi est rencontré.
    const origText = this.doc.text.bind(this.doc);
    (this.doc as unknown as { text: (...a: unknown[]) => jsPDF }).text = (
      ...args: unknown[]
    ) => {
      const t = args[0];
      if (typeof t === "string") {
        args[0] = sanitizePdfText(t);
      } else if (Array.isArray(t)) {
        args[0] = t.map((s) => (typeof s === "string" ? sanitizePdfText(s) : s));
      }
      return (origText as (...a: unknown[]) => jsPDF)(...args);
    };
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.primary = hex(header.primaryColor, [0, 143, 131]);
    this.accent = hex(header.accentColor, [247, 162, 36]);
    this.drawHeader();
    this.cursorY = this.headerH + 10;
  }

  private drawHeader() {
    const { doc, margin, pageWidth, primary, bandH, headerH, logoBoxW, logoBoxH } = this;

    // 1. Bandeau couleur fin (date à droite, mention barèmes à gauche)
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, bandH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t("pdf.chrome.scales", undefined, "BARÈMES 2026"), margin, bandH / 2 + 1.5);
    doc.setFontSize(8.5);
    const dateStr = new Date().toLocaleDateString(getActiveLocale(), {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    doc.text(dateStr.toUpperCase(), pageWidth - margin, bandH / 2 + 1.5, { align: "right" });

    // 2. Zone identité + titre (fond blanc)
    const zoneTop = bandH + 4;
    let textX = margin;

    // Logo dans une box adaptative (object-fit: contain)
    if (this.header.logoDataUrl) {
      try {
        const props = doc.getImageProperties(this.header.logoDataUrl);
        const fmt =
          /jpe?g/i.test(props.fileType || "") || /jpe?g|jpeg/i.test(this.header.logoDataUrl)
            ? "JPEG"
            : "PNG";
        const ratio = (props.width || 1) / (props.height || 1);
        let drawW = logoBoxW;
        let drawH = logoBoxW / ratio;
        if (drawH > logoBoxH) {
          drawH = logoBoxH;
          drawW = logoBoxH * ratio;
        }
        const dx = margin + (logoBoxW - drawW) / 2;
        const dy = zoneTop + (logoBoxH - drawH) / 2;
        doc.addImage(this.header.logoDataUrl, fmt, dx, dy, drawW, drawH, undefined, "FAST");
        textX = margin + logoBoxW + 6;
      } catch {
        // logo illisible : on ignore
      }
    }

    // Zone titre droite réserve 70 mm · la zone identité prend ce qui reste
    const titleZoneW = 70;
    // Ni le cabinet, ni l'email, ni le telephone ne sont repetes a cote du logo :
    // deja visibles sur la couverture et dans le pied de page de chaque page.

    // 3. Zone titre rapport à droite (right-aligned)
    const rightX = pageWidth - margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...this.muted);
    doc.text(t("pdf.chrome.report", undefined, "RAPPORT"), rightX, zoneTop + 4, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...this.muted);
    const titleLines = doc.splitTextToSize(this.header.title, titleZoneW) as string[];
    doc.text(titleLines.slice(0, 2), rightX, zoneTop + 10, { align: "right" });

    // 4. Filet séparateur fin couleur primaire
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.5);
    doc.line(margin, headerH - 2, pageWidth - margin, headerH - 2);

   // Sous-titre volontairement retire de l'en-tete repete : redondant avec le nom
    // du client deja visible dans chaque section, et provoquait un chevauchement
    // avec le bandeau colore des titres de page.
  }

  ensureSpace(needed: number) {
    if (this.cursorY + needed > this.pageHeight - 18) {
      this.doc.addPage();
      // On redessine l'en-tête (bandeau, logo, titre) à chaque nouvelle page
      // créée automatiquement par débordement, exactement comme le fait déjà
      // newPage(). Sans ça, une page ajoutée automatiquement (par exemple
      // quand deux simulations s'enchaînent sur la même page puis débordent)
      // se retrouvait sans en-tête du tout.
      this.drawHeader();
      this.cursorY = this.headerH + 10;
    }
  }
/** Titre principal d'une page de calculateur (ex. "Pilier 3a"), visuellement
   * distinct des sous-titres de section (Paramètres, Résultats, Analyse...) :
   * bandeau plus haut, police plus grande, nom de la simulation intégré en
   * sous-ligne. Sert de repère immédiat pour savoir "où on en est" dans le
   * dossier, sans confusion avec les sous-sections qui suivent.
   */
  calculatorTitle(title: string, subtitle?: string) {
    title = sanitizePdfText(title);
    const safeSubtitle = subtitle && subtitle.trim() ? sanitizePdfText(subtitle.trim()) : undefined;
    const { doc, margin, contentWidth, primary } = this;
    const barH = safeSubtitle ? 22 : 15;
    this.ensureSpace(barH + 15);
    const top = this.cursorY - 6;
    doc.setFillColor(...primary);
    doc.roundedRect(margin, top, contentWidth, barH, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 5, top + 10);
    if (safeSubtitle) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(226, 232, 245);
      const subtitleLines = doc.splitTextToSize(safeSubtitle, contentWidth - 10) as string[];
      doc.text(subtitleLines.slice(0, 1), margin + 5, top + 17);
    }
    this.cursorY = top + barH + 8;
    return this;
  }

  section(title: string) {
    title = sanitizePdfText(title);
    // On réserve la place du bandeau ET d'un minimum de contenu qui doit
    // suivre (au moins 2-3 lignes de texte ou une tuile). Avant ce correctif,
    // seule la hauteur du bandeau était vérifiée : un titre de section
    // pouvait donc s'afficher tout seul en bas de page, avec son contenu
    // rejeté sur la page suivante (ex. "Analyse" orphelin, texte séparé).
    this.ensureSpace(35);
    const { doc, margin, contentWidth, primary } = this;
    // Bandeau colore pleine largeur : rend le titre de la page (ex. "Fiscal global")
    // immediatement identifiable, plus visible que l'en-tete repete en haut de chaque page.
    const barH = 9;
    doc.setFillColor(...primary);
    doc.rect(margin, this.cursorY - 6, contentWidth, barH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin + 4, this.cursorY);
    this.cursorY += 10;
    return this;
  }

  paragraph(text: string, opts?: { italic?: boolean; muted?: boolean }) {
    text = sanitizePdfText(text);
    const { doc, margin, contentWidth } = this;
    doc.setFont("helvetica", opts?.italic ? "italic" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(...(opts?.muted ? this.muted : this.ink));
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    this.ensureSpace(lines.length * 4.5 + 2);
    doc.text(lines, margin, this.cursorY);
    this.cursorY += lines.length * 4.6 + 3;
    return this;
  }

  callout(text: string, tone: "info" | "success" | "warning" | "accent" = "info") {
    text = sanitizePdfText(text);
    const colors = {
      info: { bg: tint(this.primary, 0.92), border: this.primary },
      accent: { bg: tint(this.accent, 0.86), border: this.accent },
      success: { bg: [236, 253, 245] as [number, number, number], border: [16, 185, 129] as [number, number, number] },
      warning: { bg: [254, 252, 232] as [number, number, number], border: [202, 138, 4] as [number, number, number] },
    }[tone];
    const { doc, margin, contentWidth } = this;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentWidth - 8) as string[];
    const h = lines.length * 4.6 + 6;
    this.ensureSpace(h + 4);
    doc.setFillColor(...colors.bg);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, this.cursorY, contentWidth, h, 1.5, 1.5, "FD");
    doc.setTextColor(...this.ink);
    doc.text(lines, margin + 4, this.cursorY + 5);
    this.cursorY += h + 4;
    return this;
  }

  kvTable(rows: Array<[string, string]>) {
    const safeRows = rows.map(([k, v]) => [sanitizeCell(k), sanitizeCell(v)] as [string, string]);
    autoTable(this.doc, {
      startY: this.cursorY,
      margin: { left: this.margin, right: this.margin },
      head: [],
      body: safeRows as RowInput[],
      theme: "plain",
      styles: { fontSize: 10, cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 0 } },
      columnStyles: {
        0: { textColor: this.muted, cellWidth: this.contentWidth * 0.55 },
        1: { halign: "right", fontStyle: "bold", textColor: this.ink },
      },
      didDrawPage: () => this.drawFooter(),
    });
    this.cursorY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    return this;
  }

  table(
    head: string[],
    body: Array<Array<string | number>>,
    opts?: {
      highlightLast?: boolean;
      deltaCol?: number;
      // Sens réel de chaque ligne (true = favorable, false = défavorable),
      // pour les colonnes où "plus petit" est parfois le bon sens (ex. une
      // charge fiscale) : sans ça, la coloration par simple signe du texte
      // afficherait en rouge une baisse d'impôt, qui est pourtant favorable.
      // Une entrée undefined retombe sur la coloration par signe.
      deltaGoodness?: Array<boolean | undefined>;
    },
  ) {
    const safeHead = head.map(sanitizeCell);
    const safeBody = body.map((row) => row.map(sanitizeCell));
    autoTable(this.doc, {
      startY: this.cursorY,
      margin: { left: this.margin, right: this.margin },
      head: [safeHead],
      body: safeBody as RowInput[],
      theme: "striped",
      headStyles: { fillColor: this.primary, textColor: 255, fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 9.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      didParseCell: (data) => {
        if (opts?.highlightLast && data.section === "body" && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = tint(this.primary, 0.82);
        }
        // Colore une colonne d'écart (+X en vert, -X en rouge) selon le seul
        // signe déjà présent dans le texte formaté en amont (formatDelta) :
        // aucune interprétation "bon/mauvais" refaite ici. Le signe n'est pas
        // forcément en tête de chaîne : formatCHF() écrit "CHF -11'818" (le
        // préfixe CHF précède le signe), donc on cherche un "-"/"−" n'importe
        // où plutôt qu'un startsWith, qui ratait tout delta négatif chiffré.
        if (opts?.deltaCol !== undefined && data.section === "body" && data.column.index === opts.deltaCol) {
          const raw = String(data.cell.raw ?? "");
          const explicitGood = opts.deltaGoodness?.[data.row.index];
          if (explicitGood !== undefined) {
            if (raw !== "—" && raw.trim() !== "") {
              data.cell.styles.textColor = explicitGood ? GREEN : RED;
            }
          } else if (raw.includes("-") || raw.includes("−")) {
            data.cell.styles.textColor = RED;
          } else if (raw.startsWith("+")) {
            data.cell.styles.textColor = GREEN;
          }
        }
      },
      didDrawPage: () => this.drawFooter(),
    });
    this.cursorY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    return this;
  }

  /** Paire de cartes "Situation actuelle" (rouge) / "Situation projetée"
   *  (verte), ligne par ligne avec pastille d'écart — reprend exactement les
   *  couleurs et la structure du comparatif affiché à l'écran dans les
   *  calculateurs (SplitCompareLayout). Ne recalcule rien : les valeurs déjà
   *  formatées (current/projected/delta) sont fournies par l'appelant à
   *  partir des données réellement sauvegardées. */
  comparisonCards(opts: {
    currentLabel?: string;
    currentBadge?: string;
    currentNote?: string;
    projectedLabel?: string;
    projectedBadge?: string;
    projectedNote?: string;
    rows: Array<{ label: string; current: string; projected: string; delta?: string; deltaGood?: boolean }>;
  }) {
    const { doc, margin, contentWidth } = this;
    const currentLabel = sanitizePdfText(opts.currentLabel ?? "Situation actuelle");
    const currentBadge = sanitizePdfText(opts.currentBadge ?? "Actuel");
    const currentNote = opts.currentNote ? sanitizePdfText(opts.currentNote) : undefined;
    const projectedLabel = sanitizePdfText(opts.projectedLabel ?? "Situation projetée");
    const projectedBadge = sanitizePdfText(opts.projectedBadge ?? "Optimisé");
    const projectedNote = opts.projectedNote ? sanitizePdfText(opts.projectedNote) : undefined;
    const rows = opts.rows;

    const gap = 6;
    const cardW = (contentWidth - gap) / 2;
    // Libellé au-dessus, valeur + pastille en dessous : avec des cartes de
    // ~90mm de large, un libellé long et une valeur à 6 chiffres + pastille
    // ne tiennent jamais sur la même ligne sans se chevaucher.
    const rowH = 11.5;
    const headH = currentNote || projectedNote ? 16 : 12;
    const cardH = headH + rows.length * rowH + 4;
    this.ensureSpace(cardH + 12);

    const leftX = margin;
    const rightX = margin + cardW + gap;
    const top = this.cursorY;

    doc.setFillColor(...RED_BG);
    doc.setDrawColor(...RED_BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(leftX, top, cardW, cardH, 2, 2, "FD");
    doc.setFillColor(...GREEN_BG);
    doc.setDrawColor(...GREEN_BORDER);
    doc.roundedRect(rightX, top, cardW, cardH, 2, 2, "FD");

    const cardHead = (x: number, dotColor: [number, number, number], label: string, badge: string, note?: string) => {
      doc.setFillColor(...dotColor);
      doc.circle(x + 5, top + 6.5, 1.3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...this.ink);
      doc.text(label, x + 8.5, top + 7.5);
      const isRed = dotColor === RED;
      doc.setFillColor(...(isRed ? RED_BORDER : GREEN_BORDER));
      const badgeW = doc.getTextWidth(badge) + 6;
      doc.roundedRect(x + cardW - badgeW - 4, top + 3.5, badgeW, 6, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...(isRed ? ([153, 27, 27] as [number, number, number]) : ([4, 120, 87] as [number, number, number])));
      doc.text(badge, x + cardW - badgeW / 2 - 4, top + 7.4, { align: "center" });
      if (note) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...this.muted);
        doc.text(note, x + 8.5, top + 12);
      }
    };
    cardHead(leftX, RED, currentLabel, currentBadge, currentNote);
    cardHead(rightX, GREEN, projectedLabel, projectedBadge, projectedNote);

    rows.forEach((r, i) => {
      const labelY = top + headH + i * rowH + 4;
      const valueY = labelY + 4.8;
      if (i > 0) {
        doc.setDrawColor(...this.border);
        doc.setLineWidth(0.2);
        doc.line(leftX + 4, labelY - 6.5, leftX + cardW - 4, labelY - 6.5);
        doc.line(rightX + 4, labelY - 6.5, rightX + cardW - 4, labelY - 6.5);
      }
      const label = sanitizePdfText(r.label);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...this.muted);
      doc.text(label, leftX + 4, labelY);
      doc.text(label, rightX + 4, labelY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...this.ink);
      doc.text(sanitizePdfText(r.current), leftX + cardW - 4, valueY, { align: "right" });
      const deltaTxt = r.delta ? sanitizePdfText(r.delta) : undefined;
      doc.setFontSize(9.5);
      doc.text(
        sanitizePdfText(r.projected),
        rightX + cardW - 4 - (deltaTxt ? doc.getTextWidth(deltaTxt) + 8 : 0),
        valueY,
        { align: "right" },
      );
      if (deltaTxt) {
        const bg: [number, number, number] = r.deltaGood ? [209, 250, 229] : [254, 226, 226];
        const fg: [number, number, number] = r.deltaGood ? [4, 120, 87] : [153, 27, 27];
        doc.setFillColor(...bg);
        const w = doc.getTextWidth(deltaTxt) + 4;
        doc.roundedRect(rightX + cardW - 4 - w, valueY - 3.3, w, 4.6, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(...fg);
        doc.text(deltaTxt, rightX + cardW - 4 - w / 2, valueY - 0.2, { align: "center" });
      }
    });
    this.cursorY = top + cardH + 6;
    return this;
  }

  /** Graphique en barres groupées natif (vectoriel, sans canvas) — sert à
   *  visualiser des paires de valeurs déjà calculées (ex. les mêmes lignes
   *  qu'un comparisonCards), jamais des données inventées pour l'occasion. */
  groupedBarChart(opts: {
    groups: Array<{ label: string; values: number[] }>;
    seriesLabels: string[];
    colors: [number, number, number][];
    height?: number;
  }) {
    const { doc, margin, contentWidth } = this;
    const height = opts.height ?? 40;
    this.ensureSpace(height + 15);
    const chartX = margin + 2;
    const chartW = contentWidth - 4;
    const chartY = this.cursorY;
    const chartH = height;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...this.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(chartX, chartY, chartW, chartH, 1.5, 1.5, "FD");

    const padL = 20, padR = 6, padT = 8, padB = 10;
    const plotX = chartX + padL, plotW = chartW - padL - padR;
    const plotY = chartY + padT, plotH = chartH - padT - padB;
    const maxRaw = Math.max(...opts.groups.flatMap((g) => g.values), 1);
    const maxV = niceCeil(maxRaw * 1.1);

    const gridN = 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    for (let g = 0; g <= gridN; g++) {
      const v = (maxV / gridN) * g;
      const gy = plotY + plotH - (v / maxV) * plotH;
      doc.setDrawColor(240, 242, 245);
      doc.setLineWidth(0.15);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setTextColor(...this.muted);
      doc.text(formatCHF(v).replace(/^CHF\s*/, ""), plotX - 2, gy + 1.2, { align: "right" });
    }

    const groupW = plotW / Math.max(1, opts.groups.length);
    const barGap = 1.5;
    const nSeries = opts.seriesLabels.length;
    const barW = (groupW - 8 - barGap * (nSeries - 1)) / nSeries;

    opts.groups.forEach((grp, gi) => {
      const gx = plotX + gi * groupW + 4;
      grp.values.forEach((v, si) => {
        const bh = maxV > 0 ? (v / maxV) * plotH : 0;
        const bx = gx + si * (barW + barGap);
        const by = plotY + plotH - bh;
        doc.setFillColor(...opts.colors[si % opts.colors.length]);
        doc.rect(bx, by, Math.max(0, barW), bh, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(...this.ink);
        doc.text(formatCHF(v).replace(/^CHF\s*/, ""), bx + barW / 2, by - 1.2, { align: "center" });
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...this.muted);
      const labelLines = doc.splitTextToSize(sanitizePdfText(grp.label), groupW) as string[];
      doc.text(labelLines.slice(0, 1), gx + (groupW - 8) / 2, chartY + chartH - 2, { align: "center" });
    });

    let lx = chartX + chartW - 2;
    [...opts.seriesLabels].reverse().forEach((lbl, i) => {
      const color = [...opts.colors].reverse()[i % opts.colors.length];
      const safeLbl = sanitizePdfText(lbl);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      const tw = doc.getTextWidth(safeLbl);
      lx -= tw;
      doc.setTextColor(...this.muted);
      doc.text(safeLbl, lx, chartY + 5);
      doc.setFillColor(...color);
      doc.rect(lx - 8, chartY + 2.2, 4, 3, "F");
      lx -= 12;
    });

    this.cursorY = chartY + chartH + 7;
    return this;
  }

  /** Courbe de trajectoire (ex. capital LPP/3a par âge, jusqu'à la retraite) :
   *  une ou deux séries tracées en ligne, avec zone teintée sous la courbe
   *  principale, grille de fond et repère de valeur finale. Contrairement à
   *  groupedBarChart (comparer QUELQUES chiffres), sert à montrer une
   *  évolution dans le temps à partir de la série "yearly" déjà calculée par
   *  le moteur du calculateur (aucune valeur recalculée ici). */
  trajectoryChart(opts: {
    series: Array<{ label: string; color: [number, number, number]; points: Array<{ x: number; y: number }> }>;
    height?: number;
    xLabel?: (x: number) => string;
  }) {
    const { doc, margin, contentWidth } = this;
    const height = opts.height ?? 48;
    this.ensureSpace(height + 15);
    const chartX = margin + 2;
    const chartW = contentWidth - 4;
    const chartY = this.cursorY;
    const chartH = height;
    const allPoints = opts.series.flatMap((s) => s.points);
    if (allPoints.length < 2) return this;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...this.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(chartX, chartY, chartW, chartH, 1.5, 1.5, "FD");

    const padL = 20, padR = 6, padT = 8, padB = 10;
    const plotX = chartX + padL, plotW = chartW - padL - padR;
    const plotY = chartY + padT, plotH = chartH - padT - padB;

    const xs = allPoints.map((p) => p.x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const maxY = niceCeil(Math.max(...allPoints.map((p) => p.y), 1) * 1.08);
    const xOf = (x: number) => plotX + (maxX > minX ? ((x - minX) / (maxX - minX)) * plotW : 0);
    const yOf = (y: number) => plotY + plotH - (maxY > 0 ? (y / maxY) * plotH : 0);

    // Grille horizontale + axe des valeurs (CHF)
    const gridN = 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    for (let g = 0; g <= gridN; g++) {
      const v = (maxY / gridN) * g;
      const gy = yOf(v);
      doc.setDrawColor(240, 242, 245);
      doc.setLineWidth(0.15);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setTextColor(...this.muted);
      doc.text(formatCHF(v).replace(/^CHF\s*/, ""), plotX - 2, gy + 1.2, { align: "right" });
    }

    // Axe des x (âge) : première, milieu, dernière valeur seulement, pour
    // rester lisible même avec 20-40 points.
    const xTicks = Array.from(new Set([minX, Math.round((minX + maxX) / 2), maxX]));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...this.muted);
    xTicks.forEach((x) => {
      const label = opts.xLabel ? opts.xLabel(x) : String(x);
      doc.text(label, xOf(x), chartY + chartH - 2, { align: "center" });
    });

    // Zone teintée sous la première série (la principale), puis toutes les
    // lignes par-dessus, la dernière tracée passant au-dessus des autres.
    const first = opts.series[0];
    if (first && first.points.length >= 2) {
      const areaColor = tint(first.color, 0.85);
      doc.setFillColor(...areaColor);
      const baseline = yOf(0);
      const pts = first.points;
      // Polygone : suit la courbe, puis referme le long de l'axe des x.
      const poly: [number, number][] = pts.map((p) => [xOf(p.x), yOf(p.y)]);
      poly.push([xOf(pts[pts.length - 1].x), baseline]);
      poly.push([xOf(pts[0].x), baseline]);
      doc.setDrawColor(...areaColor);
      doc.setLineWidth(0.1);
      // jsPDF lines() attend des segments delta [dx,dy] à partir du premier point.
      const start = poly[0];
      const deltas = poly.slice(1).map((p, i) => [p[0] - poly[i][0], p[1] - poly[i][1]] as [number, number]);
      doc.lines(deltas, start[0], start[1], [1, 1], "F", true);
    }

    opts.series.forEach((s) => {
      doc.setDrawColor(...s.color);
      doc.setLineWidth(0.6);
      for (let i = 1; i < s.points.length; i++) {
        const a = s.points[i - 1], b = s.points[i];
        doc.line(xOf(a.x), yOf(a.y), xOf(b.x), yOf(b.y));
      }
      const last = s.points[s.points.length - 1];
      doc.setFillColor(...s.color);
      doc.circle(xOf(last.x), yOf(last.y), 1, "F");
    });

    // Légende + valeur finale de la première série, en haut à droite.
    let lx = chartX + chartW - 2;
    [...opts.series].reverse().forEach((s) => {
      const safeLbl = sanitizePdfText(s.label);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      const tw = doc.getTextWidth(safeLbl);
      lx -= tw;
      doc.setTextColor(...this.muted);
      doc.text(safeLbl, lx, chartY + 5);
      doc.setFillColor(...s.color);
      doc.rect(lx - 8, chartY + 2.2, 4, 3, "F");
      lx -= 12;
    });

    this.cursorY = chartY + chartH + 7;
    return this;
  }

  /** Grille de tuiles : libellé + valeur (CHF) en grand, style "card" moderne.
   *  tone "accent" ressort du lot (fond teinté) — réservé au chiffre qui
   *  doit attirer l'œil en premier (ex. gain identifié), pas à toute la grille. */
  metricsGrid(items: Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" | "accent" }>) {
    const cols = items.length <= 2 ? items.length : items.length === 3 ? 3 : 2;
    const rows = Math.ceil(items.length / cols);
    const gap = 4;
    const tileW = (this.contentWidth - gap * (cols - 1)) / cols;
    const tileH = 26;
    this.ensureSpace(rows * (tileH + gap) + 2);
    items.forEach((it, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = this.margin + c * (tileW + gap);
      const y = this.cursorY + r * (tileH + gap);
      const accentColor: [number, number, number] =
        it.tone === "success"
          ? [16, 185, 129]
          : it.tone === "warning"
            ? [202, 138, 4]
            : it.tone === "accent"
              ? this.accent
              : this.primary;
      const tileFill: [number, number, number] = it.tone === "accent" ? tint(this.accent, 0.88) : [255, 255, 255];
      const tileBorder: [number, number, number] = it.tone === "accent" ? this.accent : this.border;
      this.doc.setFillColor(...tileFill);
      this.doc.setDrawColor(...tileBorder);
      this.doc.setLineWidth(0.25);
      this.doc.rect(x, y, tileW, tileH, "FD");
      this.doc.setFillColor(...accentColor);
      this.doc.rect(x, y, 1.5, tileH, "F");
      const maxTextW = tileW - 8;
      // Libelle sur 2 lignes max, pour ne jamais deborder sur la tuile voisine
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...this.muted);
      const labelLines = this.doc.splitTextToSize(it.label.toUpperCase(), maxTextW) as string[];
      this.doc.text(labelLines.slice(0, 2), x + 5, y + 6);
      // Valeur : taille de police reduite automatiquement si le texte est long
      // (ex. un nom de strategie personnalise), et repliee sur 2 lignes si besoin.
      const rawValue = typeof it.value === "number" ? formatCHF(it.value) : it.value;
      const valueFontSize = rawValue.length > 18 ? 10 : rawValue.length > 12 ? 12 : 14;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(valueFontSize);
      this.doc.setTextColor(...(it.tone === "accent" ? shade(this.accent, 0.35) : this.ink));
      const valueLines = this.doc.splitTextToSize(rawValue, maxTextW) as string[];
      const valueY = labelLines.length > 1 ? y + 20 : y + 17;
      this.doc.text(valueLines.slice(0, 2), x + 5, valueY);
    });
    this.cursorY += rows * (tileH + gap) + 4;
    return this;
  }

  spacer(mm = 4) {
    this.cursorY += mm;
    return this;
  }

  /** Force le passage à une nouvelle page en redessinant l'en-tête standard. */
  newPage() {
    this.doc.addPage();
    this.drawHeader();
    this.cursorY = this.headerH + 10;
    return this;
  }

  /** Bandeau "SITUATION ACTUELLE" · teinte foncée dérivée de la couleur
   *  primaire du courtier — grounded, sert de référence. */
  situationBanner(label?: string) {
    const text = label ?? t("pdf.banner.current", undefined, "SITUATION ACTUELLE");
    this.ensureSpace(10);
    const { doc, margin, contentWidth } = this;
    doc.setFillColor(...shade(this.primary, 0.55));
    doc.rect(margin, this.cursorY, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(text, margin + 4, this.cursorY + 4.8);
    this.cursorY += 10;
    return this;
  }

  /** Bandeau "PROJECTION" · couleur d'accent du courtier, plat — met en
   *  évidence la situation optimisée, symétrique de situationBanner. */
  projectionBanner(label?: string) {
    const text = label ?? t("pdf.banner.projection", undefined, "PROJECTION");
    this.ensureSpace(10);
    const { doc, margin, contentWidth, accent } = this;
    doc.setFillColor(...accent);
    doc.rect(margin, this.cursorY, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(text, margin + 4, this.cursorY + 4.8);
    this.cursorY += 10;
    return this;
  }

  private drawFooter() {
    const { doc, margin, pageWidth, pageHeight, muted, primary } = this;
    const current = doc.getCurrentPageInfo().pageNumber;
    if (this.footerDrawnPages.has(current)) return;
    this.footerDrawnPages.add(current);
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    const note =
      this.header.footerNote?.trim() ||
      t(
        "pdf.footer.default_note",
        undefined,
        "Document de travail · calculs basés sur les barèmes 2026 et les données saisies.",
      );
    const cabinetCenter = this.header.brokerageName?.trim() || this.header.brokerName?.trim() || "";
    const noteMaxW = pageWidth / 2 - margin - 20;
    const noteLines = doc.splitTextToSize(note, noteMaxW) as string[];
    doc.text(noteLines.slice(0, 2), margin, pageHeight - 7);
    if (cabinetCenter) {
      doc.text(cabinetCenter, pageWidth / 2, pageHeight - 7, { align: "center" });
    }
    // Le numero de page n'est PAS dessine ici : au moment ou didDrawPage declenche
    // ce footer sur une page, les pages suivantes n'existent pas encore, donc le
    // total serait faux (ex. "Page 7 / 7" au lieu de "Page 7 / 14"). Il est dessine
    // separement par drawPageNumber(), appele une seule fois a la toute fin sur
    // chaque page, quand le nombre total de pages est enfin connu.
  }
  /** Dessine le numero de page avec le total final. Appele uniquement depuis finalize(). */
  private drawPageNumber() {
    const { doc, margin, pageWidth, pageHeight, muted } = this;
    const pageCount = doc.getNumberOfPages();
    const current = doc.getCurrentPageInfo().pageNumber;
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - margin - 35, pageHeight - 11, 35, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(
      t("pdf.footer.page", { current, total: pageCount }, `Page ${current} / ${pageCount}`),
      pageWidth - margin,
      pageHeight - 7,
      { align: "right" },
    );
  }

  finalize() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.drawFooter();
      this.drawPageNumber();
    }
    return this;
  }

  save(filename: string) {
    this.finalize();
    this.doc.save(filename);
  }
}

export function makeFilename(prefix: string, suffix?: string) {
  const d = new Date().toISOString().slice(0, 10);
  const s = suffix ? `_${suffix.replace(/[^a-z0-9-_]/gi, "")}` : "";
  return `${prefix}${s}_${d}.pdf`;
}
