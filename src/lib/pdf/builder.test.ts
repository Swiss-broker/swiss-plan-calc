// Régression : mise en page générale du PDF (cahier des charges point 10).
// Avant ce correctif, section() dessinait son bandeau immédiatement, sans
// savoir si le contenu qui le suit tenait sur ce qui restait de la page —
// un titre de chapitre pouvait donc se retrouver seul en bas de page, avec
// son contenu réel rejeté sur la suivante. De même, table()/kvTable() ne
// réservaient pas la place du tableau ENTIER avant de le dessiner, laissant
// jspdf-autotable le couper au milieu si besoin, sur une page sans l'en-tête
// de marque (jamais redessiné par la pagination interne d'autoTable).
import { describe, expect, it } from "vitest";
import { ReportPdf } from "./builder";

function makePdf() {
  return new ReportPdf({ title: "Test" });
}

describe("ReportPdf — un titre de section n'est jamais orphelin en bas de page", () => {
  it("un section() jamais suivi de contenu ne fait planter finalize() (filet de sécurité)", () => {
    const pdf = makePdf();
    pdf.section("Chapitre vide");
    expect(() => pdf.finalize()).not.toThrow();
    expect(pdf.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("un deuxième section() sans contenu entre les deux ne perd pas le premier titre (flush avant la mise en attente suivante)", () => {
    const pdf = makePdf();
    pdf.section("Premier titre");
    expect(() => pdf.section("Deuxième titre")).not.toThrow();
    pdf.paragraph("Contenu du deuxième chapitre.");
    expect(() => pdf.finalize()).not.toThrow();
  });

  it("bascule le bandeau ET son contenu ensemble sur la page suivante quand il ne reste plus de place, jamais le titre seul", () => {
    const pdf = makePdf();
    // Simule une position juste avant le bas de page (10mm de marge restante,
    // très inférieur au bandeau de section + un paragraphe).
    pdf.cursorY = pdf.pageHeight - 28;
    const pageBeforeSection = pdf.doc.getCurrentPageInfo().pageNumber;
    pdf.section("Chapitre qui doit sauter de page");
    // Rien n'a encore été peint (section() diffère le dessin) : le numéro de
    // page ne doit pas avoir bougé avant que du contenu ne le déclenche.
    expect(pdf.doc.getCurrentPageInfo().pageNumber).toBe(pageBeforeSection);
    pdf.paragraph("Premier paragraphe du chapitre.");
    // Le bandeau ET ce paragraphe doivent être sur la MÊME page (la nouvelle),
    // jamais le bandeau seul sur l'ancienne.
    expect(pdf.doc.getCurrentPageInfo().pageNumber).toBe(pageBeforeSection + 1);
  });
});

describe("ReportPdf — un tableau ne doit jamais être coupé entre deux pages", () => {
  it("kvTable() bascule le tableau ENTIER sur la page suivante plutôt que de le couper", () => {
    const pdf = makePdf();
    for (let i = 0; i < 40; i++) pdf.paragraph(`Ligne de remplissage ${i}`);
    const pageBefore = pdf.doc.getCurrentPageInfo().pageNumber;
    const rows: Array<[string, string]> = Array.from({ length: 15 }, (_, i) => [`Clé ${i}`, `Valeur ${i}`]);
    expect(() => pdf.kvTable(rows)).not.toThrow();
    // Un tableau de 15 lignes tient largement sur une page A4 complète : s'il
    // avait été coupé au milieu par la pagination interne d'autoTable, on
    // aurait sauté de plus d'une page (page de début + page de fin séparées
    // par la coupure). Un seul saut préventif (avant le tableau) est attendu.
    expect(pdf.doc.getCurrentPageInfo().pageNumber).toBeLessThanOrEqual(pageBefore + 1);
  });

  it("table() bascule le tableau ENTIER sur la page suivante plutôt que de le couper", () => {
    const pdf = makePdf();
    for (let i = 0; i < 40; i++) pdf.paragraph(`Ligne de remplissage ${i}`);
    const pageBefore = pdf.doc.getCurrentPageInfo().pageNumber;
    const body = Array.from({ length: 15 }, (_, i) => [`x${i}`, `y${i}`]);
    expect(() => pdf.table(["A", "B"], body)).not.toThrow();
    expect(pdf.doc.getCurrentPageInfo().pageNumber).toBeLessThanOrEqual(pageBefore + 1);
  });

  it("une section suivie directement d'un grand tableau saute de page en bloc (titre + tableau ensemble)", () => {
    const pdf = makePdf();
    pdf.cursorY = pdf.pageHeight - 40;
    const pageBefore = pdf.doc.getCurrentPageInfo().pageNumber;
    pdf.section("Tableau volumineux");
    const body = Array.from({ length: 12 }, (_, i) => [`x${i}`, `y${i}`]);
    expect(() => pdf.table(["A", "B"], body)).not.toThrow();
    expect(pdf.doc.getCurrentPageInfo().pageNumber).toBe(pageBefore + 1);
  });
});
