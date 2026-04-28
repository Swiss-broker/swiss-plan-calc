// Liste des 26 cantons suisses (code ISO 3166-2:CH + nom français)
export interface Canton {
  code: string;
  name: string;
}

export const CANTONS: Canton[] = [
  { code: "AG", name: "Argovie" },
  { code: "AI", name: "Appenzell Rhodes-Intérieures" },
  { code: "AR", name: "Appenzell Rhodes-Extérieures" },
  { code: "BE", name: "Berne" },
  { code: "BL", name: "Bâle-Campagne" },
  { code: "BS", name: "Bâle-Ville" },
  { code: "FR", name: "Fribourg" },
  { code: "GE", name: "Genève" },
  { code: "GL", name: "Glaris" },
  { code: "GR", name: "Grisons" },
  { code: "JU", name: "Jura" },
  { code: "LU", name: "Lucerne" },
  { code: "NE", name: "Neuchâtel" },
  { code: "NW", name: "Nidwald" },
  { code: "OW", name: "Obwald" },
  { code: "SG", name: "Saint-Gall" },
  { code: "SH", name: "Schaffhouse" },
  { code: "SO", name: "Soleure" },
  { code: "SZ", name: "Schwytz" },
  { code: "TG", name: "Thurgovie" },
  { code: "TI", name: "Tessin" },
  { code: "UR", name: "Uri" },
  { code: "VD", name: "Vaud" },
  { code: "VS", name: "Valais" },
  { code: "ZG", name: "Zoug" },
  { code: "ZH", name: "Zurich" },
];

export const CANTON_BY_CODE: Record<string, Canton> = Object.fromEntries(
  CANTONS.map((c) => [c.code, c]),
);

// Cantons ayant un accord d'imposition spécial pour frontaliers français
// (rétrocession 4.5% au pays de résidence)
export const CROSS_BORDER_FR_CANTONS = ["BE", "BL", "BS", "JU", "NE", "SO", "VD", "VS"];
// Genève applique son régime d'imposition à la source classique (pas la rétrocession 4.5%)
export const GENEVA_CODE = "GE";
