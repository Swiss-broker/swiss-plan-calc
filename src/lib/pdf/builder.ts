// Builder PDF générique pour les rapports de simulation SwissBroker Pro.
// Ajoute en-tête, pied de page paginé, sections titrées, tableaux, blocs explicatifs.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatCHF } from "@/lib/format";

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

export class ReportPdf {
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
    this.primary = hex(header.primaryColor, [15, 76, 129]);
    this.accent = hex(header.accentColor, [59, 130, 246]);
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
    doc.text("BARÈMES 2026", margin, bandH / 2 + 1.5);
    doc.setFontSize(8.5);
    const dateStr = new Date().toLocaleDateString("fr-CH", {
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

    const cabinet = this.header.brokerageName?.trim();
    const brokerName = this.header.brokerName?.trim();
    const primaryLine = cabinet || brokerName || "Rapport de simulation";
    const secondaryLine = cabinet && brokerName ? brokerName : undefined;
    const contactParts: string[] = [];
    if (this.header.brokerEmail) contactParts.push(this.header.brokerEmail);
    if (this.header.brokerPhone) contactParts.push(this.header.brokerPhone);

    // Zone titre droite réserve 70 mm — la zone identité prend ce qui reste
    const titleZoneW = 70;
    const identityMaxW = Math.max(40, pageWidth - margin - textX - titleZoneW - 6);

    // Ligne 1 : cabinet (ou nom courtier en fallback)
    doc.setTextColor(...this.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const primaryLines = doc.splitTextToSize(primaryLine, identityMaxW) as string[];
    doc.text(primaryLines[0], textX, zoneTop + 5);

    let yCursor = zoneTop + 10.5;
    if (secondaryLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...this.ink);
      const sLines = doc.splitTextToSize(secondaryLine, identityMaxW) as string[];
      doc.text(sLines[0], textX, yCursor);
      yCursor += 4.5;
    }

    if (contactParts.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...this.muted);
      const contactLines = doc.splitTextToSize(contactParts.join("  ·  "), identityMaxW) as string[];
      doc.text(contactLines[0], textX, yCursor);
    }

    // 3. Zone titre rapport à droite (right-aligned)
    const rightX = pageWidth - margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...this.muted);
    doc.text("RAPPORT", rightX, zoneTop + 4, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...this.primary);
    const titleLines = doc.splitTextToSize(this.header.title, titleZoneW) as string[];
    doc.text(titleLines.slice(0, 2), rightX, zoneTop + 10, { align: "right" });

    // 4. Filet séparateur fin couleur primaire
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.5);
    doc.line(margin, headerH - 2, pageWidth - margin, headerH - 2);

    // 5. Sous-titre sous l'en-tête
    if (this.header.subtitle) {
      doc.setTextColor(...this.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(this.header.subtitle, margin, headerH + 5);
    }
  }

  private ensureSpace(needed: number) {
    if (this.cursorY + needed > this.pageHeight - 18) {
      this.doc.addPage();
      this.cursorY = this.margin + 5;
    }
  }

  section(title: string) {
    title = sanitizePdfText(title);
    this.ensureSpace(14);
    const { doc, margin, primary } = this;
    // Petit carré couleur primaire à gauche du titre
    doc.setFillColor(...primary);
    doc.rect(margin, this.cursorY - 3, 2.5, 2.5, "F");
    doc.setTextColor(...this.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin + 5, this.cursorY);
    // Filet fin sous le titre
    doc.setDrawColor(...this.border);
    doc.setLineWidth(0.2);
    doc.line(margin, this.cursorY + 2.5, this.pageWidth - margin, this.cursorY + 2.5);
    this.cursorY += 8;
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

  callout(text: string, tone: "info" | "success" | "warning" = "info") {
    text = sanitizePdfText(text);
    const colors = {
      info: { bg: [239, 246, 255] as [number, number, number], border: this.primary },
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

  table(head: string[], body: Array<Array<string | number>>, opts?: { highlightLast?: boolean }) {
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
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
      didDrawPage: () => this.drawFooter(),
    });
    this.cursorY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    return this;
  }

  /** Grille de tuiles : libellé + valeur (CHF) en grand, style "card" moderne */
  metricsGrid(items: Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" }>) {
    const cols = items.length <= 2 ? items.length : items.length === 3 ? 3 : 2;
    const rows = Math.ceil(items.length / cols);
    const gap = 4;
    const tileW = (this.contentWidth - gap * (cols - 1)) / cols;
    const tileH = 22;
    this.ensureSpace(rows * (tileH + gap) + 2);
    items.forEach((it, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = this.margin + c * (tileW + gap);
      const y = this.cursorY + r * (tileH + gap);
      const accent: [number, number, number] =
        it.tone === "success"
          ? [16, 185, 129]
          : it.tone === "warning"
            ? [202, 138, 4]
            : this.primary;
      this.doc.setFillColor(255, 255, 255);
      this.doc.setDrawColor(...this.border);
      this.doc.setLineWidth(0.25);
      this.doc.rect(x, y, tileW, tileH, "FD");
      this.doc.setFillColor(...accent);
      this.doc.rect(x, y, 1.5, tileH, "F");
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...this.muted);
      this.doc.text(it.label.toUpperCase(), x + 5, y + 6);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(...this.ink);
      const value = typeof it.value === "number" ? formatCHF(it.value) : it.value;
      this.doc.text(value, x + 5, y + 16);
    });
    this.cursorY += rows * (tileH + gap) + 4;
    return this;
  }

  spacer(mm = 4) {
    this.cursorY += mm;
    return this;
  }

  /** Bandeau "SITUATION ACTUELLE" — fond gris clair, filet vertical. */
  situationBanner(label = "SITUATION ACTUELLE") {
    this.ensureSpace(10);
    const { doc, margin, contentWidth } = this;
    doc.setFillColor(...this.surface);
    doc.rect(margin, this.cursorY, contentWidth, 7, "F");
    doc.setFillColor(148, 163, 184);
    doc.rect(margin, this.cursorY, 1.5, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...this.ink);
    doc.text(label, margin + 4, this.cursorY + 4.8);
    this.cursorY += 10;
    return this;
  }

  /** Bandeau "PROJECTION" — fond couleur primaire, plat. */
  projectionBanner(label = "PROJECTION") {
    this.ensureSpace(10);
    const { doc, margin, contentWidth, primary } = this;
    doc.setFillColor(...primary);
    doc.rect(margin, this.cursorY, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, margin + 4, this.cursorY + 4.8);
    this.cursorY += 10;
    return this;
  }

  private drawFooter() {
    const { doc, margin, pageWidth, pageHeight, muted, primary } = this;
    const pageCount = doc.getNumberOfPages();
    const current = doc.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    const note =
      this.header.footerNote?.trim() ||
      "Document de travail · calculs basés sur les barèmes 2026 et les données saisies.";
    const cabinetCenter = this.header.brokerageName?.trim() || this.header.brokerName?.trim() || "";
    const noteMaxW = pageWidth / 2 - margin - 20;
    const noteLines = doc.splitTextToSize(note, noteMaxW) as string[];
    doc.text(noteLines.slice(0, 2), margin, pageHeight - 7);
    if (cabinetCenter) {
      doc.text(cabinetCenter, pageWidth / 2, pageHeight - 7, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${current} / ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  finalize() {
    // Footer sur toutes les pages déjà dessiné via didDrawPage des tableaux,
    // mais on s'assure qu'au moins la première page (sans tableau) ait un footer.
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.drawFooter();
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
