// Builder PDF générique pour les rapports de simulation SwissBroker Pro.
// Ajoute en-tête, pied de page paginé, sections titrées, tableaux, blocs explicatifs.
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatCHF } from "@/lib/format";

export interface BrokerHeader {
  brokerName?: string;
  brokerEmail?: string;
  brokerPhone?: string;
  brokerageName?: string;
  primaryColor?: string; // hex
  accentColor?: string; // hex
  footerNote?: string;
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

  constructor(public header: PdfHeaderInfo) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.primary = hex(header.primaryColor, [15, 76, 129]);
    this.accent = hex(header.accentColor, [59, 130, 246]);
    this.drawHeader();
    this.cursorY = 50;
  }

  private drawHeader() {
    const { doc, margin, pageWidth, primary, muted } = this;
    // Bandeau couleur charte courtier
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, 32, "F");

    // Cabinet (en gros) ou nom courtier
    const cabinet = this.header.brokerageName?.trim();
    const brokerName = this.header.brokerName?.trim();
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(cabinet || brokerName || "Rapport de simulation", margin, 11);

    // Ligne contact courtier
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const contactParts: string[] = [];
    if (cabinet && brokerName) contactParts.push(brokerName);
    if (this.header.brokerEmail) contactParts.push(this.header.brokerEmail);
    if (this.header.brokerPhone) contactParts.push(this.header.brokerPhone);
    if (contactParts.length) doc.text(contactParts.join(" · "), margin, 17);

    // Date à droite
    doc.setFontSize(9);
    doc.text(
      new Date().toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" }),
      pageWidth - margin,
      11,
      { align: "right" },
    );
    doc.setFontSize(8);
    doc.text("Barèmes 2026", pageWidth - margin, 17, { align: "right" });

    // Titre du rapport (sur fond couleur, bas du bandeau)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(this.header.title, margin, 27);

    // Sous-titre sous le bandeau
    if (this.header.subtitle) {
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(this.header.subtitle, margin, 40);
    }
  }

  private ensureSpace(needed: number) {
    if (this.cursorY + needed > this.pageHeight - 18) {
      this.doc.addPage();
      this.cursorY = this.margin + 5;
    }
  }

  section(title: string) {
    this.ensureSpace(14);
    const { doc, margin, primary } = this;
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.6);
    doc.line(margin, this.cursorY, margin + 6, this.cursorY);
    doc.setTextColor(...this.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin + 9, this.cursorY + 1);
    this.cursorY += 8;
    return this;
  }

  paragraph(text: string, opts?: { italic?: boolean; muted?: boolean }) {
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
    autoTable(this.doc, {
      startY: this.cursorY,
      margin: { left: this.margin, right: this.margin },
      head: [],
      body: rows as RowInput[],
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
    autoTable(this.doc, {
      startY: this.cursorY,
      margin: { left: this.margin, right: this.margin },
      head: [head],
      body: body as RowInput[],
      theme: "striped",
      headStyles: { fillColor: this.primary, textColor: 255, fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 9.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
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

  /** Grille de tuiles : libellé + valeur (CHF) en grand */
  metricsGrid(items: Array<{ label: string; value: number | string; tone?: "primary" | "success" | "warning" }>) {
    const cols = items.length <= 2 ? items.length : items.length === 3 ? 3 : 2;
    const rows = Math.ceil(items.length / cols);
    const gap = 3;
    const tileW = (this.contentWidth - gap * (cols - 1)) / cols;
    const tileH = 18;
    this.ensureSpace(rows * (tileH + gap) + 2);
    items.forEach((it, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const x = this.margin + c * (tileW + gap);
      const y = this.cursorY + r * (tileH + gap);
      const bg =
        it.tone === "primary"
          ? ([239, 246, 255] as [number, number, number])
          : it.tone === "success"
            ? ([236, 253, 245] as [number, number, number])
            : it.tone === "warning"
              ? ([254, 252, 232] as [number, number, number])
              : ([248, 250, 252] as [number, number, number]);
      const border =
        it.tone === "primary"
          ? this.primary
          : it.tone === "success"
            ? ([16, 185, 129] as [number, number, number])
            : it.tone === "warning"
              ? ([202, 138, 4] as [number, number, number])
              : ([226, 232, 240] as [number, number, number]);
      this.doc.setFillColor(...bg);
      this.doc.setDrawColor(...border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, y, tileW, tileH, 1.5, 1.5, "FD");
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...this.muted);
      this.doc.text(it.label.toUpperCase(), x + 3, y + 5);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(13);
      this.doc.setTextColor(...this.ink);
      const value = typeof it.value === "number" ? formatCHF(it.value) : it.value;
      this.doc.text(value, x + 3, y + 13);
    });
    this.cursorY += rows * (tileH + gap) + 3;
    return this;
  }

  spacer(mm = 4) {
    this.cursorY += mm;
    return this;
  }

  private drawFooter() {
    const { doc, margin, pageWidth, pageHeight, muted } = this;
    const pageCount = doc.getNumberOfPages();
    const current = doc.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(...muted);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      "Document de travail · calculs basés sur les barèmes 2026 et les données saisies.",
      margin,
      pageHeight - 7,
    );
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
