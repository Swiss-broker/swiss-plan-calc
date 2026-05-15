// Référence des cantons suisses (code ISO 3166-2:CH + nom français)
//
// === SCOPE V1 · Suisse romande ===
//
// La v1 du produit cible exclusivement la Suisse romande. Pour préserver
// l'architecture multi-cantons (extension v1.5/v2 sans refonte), tous les
// 26 cantons restent listés dans CANTONS, mais deux flags contrôlent leur
// disponibilité dans l'application :
//
//   - `selectable`  : le canton apparaît dans les sélecteurs de canton
//                     de domicile / canton de travail.
//   - `comparable`  : le canton apparaît dans le comparateur cantonal.
//
// Pour ajouter un canton en v1.5+ : voir docs/SCOPE.md (procédure complète).

export interface Canton {
  code: string;
  name: string;
  /** Sélectionnable comme canton de domicile/travail (v1 = 6 romands). */
  selectable: boolean;
  /** Affichable dans le comparateur cantonal (v1 = 6 romands + ZG). */
  comparable: boolean;
}

export const CANTONS: Canton[] = [
  // === Cantons romands · selectable + comparable (v1) ===
  { code: "GE", name: "Genève", selectable: true, comparable: true },
  { code: "VD", name: "Vaud", selectable: true, comparable: true },
  { code: "VS", name: "Valais", selectable: true, comparable: true },
  { code: "FR", name: "Fribourg", selectable: true, comparable: true },
  { code: "NE", name: "Neuchâtel", selectable: true, comparable: true },
  { code: "JU", name: "Jura", selectable: true, comparable: true },

  // === Référence comparateur · comparable seulement (v1) ===
  { code: "ZG", name: "Zoug", selectable: false, comparable: true },
  { code: "SZ", name: "Schwyz", selectable: false, comparable: true },

  // === Cantons hors scope v1 (prévus v1.5+) ===
  { code: "AG", name: "Argovie", selectable: false, comparable: false },
  { code: "AI", name: "Appenzell Rhodes-Intérieures", selectable: false, comparable: false },
  { code: "AR", name: "Appenzell Rhodes-Extérieures", selectable: false, comparable: false },
  { code: "BE", name: "Berne", selectable: false, comparable: false },
  { code: "BL", name: "Bâle-Campagne", selectable: false, comparable: false },
  { code: "BS", name: "Bâle-Ville", selectable: false, comparable: false },
  { code: "GL", name: "Glaris", selectable: false, comparable: false },
  { code: "GR", name: "Grisons", selectable: false, comparable: false },
  { code: "LU", name: "Lucerne", selectable: false, comparable: false },
  { code: "NW", name: "Nidwald", selectable: false, comparable: false },
  { code: "OW", name: "Obwald", selectable: false, comparable: false },
  { code: "SG", name: "Saint-Gall", selectable: false, comparable: false },
  { code: "SH", name: "Schaffhouse", selectable: false, comparable: false },
  { code: "SO", name: "Soleure", selectable: false, comparable: false },
  { code: "TG", name: "Thurgovie", selectable: false, comparable: false },
  { code: "TI", name: "Tessin", selectable: false, comparable: false },
  { code: "UR", name: "Uri", selectable: false, comparable: false },
  { code: "ZH", name: "Zurich", selectable: false, comparable: false },
];

export const CANTON_BY_CODE: Record<string, Canton> = Object.fromEntries(
  CANTONS.map((c) => [c.code, c]),
);

// =====================================================================
//  Helpers
// =====================================================================

/** Cantons sélectionnables comme canton de domicile / travail. */
export function getSelectableCantons(): Canton[] {
  return CANTONS.filter((c) => c.selectable);
}

/** Cantons disponibles dans le comparateur cantonal. */
export function getComparableCantons(): Canton[] {
  return CANTONS.filter((c) => c.comparable);
}

/**
 * Cantons utilisables comme **canton de retrait** d'un capital de prévoyance
 * (LPP, libre passage, 3a). Décorrélé du canton de domicile : un client peut
 * transférer son avoir dans une institution sise dans un canton à fiscalité
 * favorable (ex. Zoug) avant le retrait. v1 = romands + ZG.
 */
export function getWithdrawalCantons(): Canton[] {
  return getComparableCantons();
}

/** Vrai si le canton (code ISO) peut être sélectionné comme domicile/travail. */
export function isSelectableCanton(code: string): boolean {
  return CANTON_BY_CODE[code]?.selectable === true;
}

/** Vrai si le canton (code ISO) peut figurer dans le comparateur. */
export function isComparableCanton(code: string): boolean {
  return CANTON_BY_CODE[code]?.comparable === true;
}

// =====================================================================
//  Types stricts (garde-fou compile-time)
// =====================================================================
//
// Ces tableaux figés permettent à TypeScript de dériver des types
// littéraux pour empêcher tout hardcode d'un canton non-selectable
// dans un sélecteur de domicile/travail.
//
// Ils DOIVENT rester synchronisés avec les flags `selectable` ci-dessus.
// La cohérence est vérifiée à l'import du module (assertion runtime ci-dessous)
// ET dans le test src/lib/swiss/cantons.test.ts.

export const SELECTABLE_CANTON_CODES = [
  "GE",
  "VD",
  "VS",
  "FR",
  "NE",
  "JU",
] as const;

export const COMPARABLE_CANTON_CODES = [
  ...SELECTABLE_CANTON_CODES,
  "ZG",
  "SZ",
] as const;

/** Code canton sélectionnable (domicile/travail). */
export type SelectableCantonCode = (typeof SELECTABLE_CANTON_CODES)[number];

/** Code canton affichable dans le comparateur cantonal. */
export type ComparableCantonCode = (typeof COMPARABLE_CANTON_CODES)[number];

// =====================================================================
//  Garde-fou runtime (cohérence flags ↔ codes typés)
// =====================================================================
//
// Si un dev change un flag sans mettre à jour SELECTABLE_CANTON_CODES
// (ou vice versa), l'app crashe au boot avec un message explicite.
// Mieux vaut ça qu'une régression silencieuse en prod.

(function assertCantonFlagsConsistency() {
  const selectableFromFlags = CANTONS.filter((c) => c.selectable).map((c) => c.code).sort();
  const selectableFromTyped = [...SELECTABLE_CANTON_CODES].sort();
  if (JSON.stringify(selectableFromFlags) !== JSON.stringify(selectableFromTyped)) {
    throw new Error(
      `[cantons] Incohérence selectable : flags=[${selectableFromFlags.join(",")}] ` +
        `vs SELECTABLE_CANTON_CODES=[${selectableFromTyped.join(",")}]. ` +
        `Synchroniser src/lib/swiss/cantons.ts.`,
    );
  }
  const comparableFromFlags = CANTONS.filter((c) => c.comparable).map((c) => c.code).sort();
  const comparableFromTyped = [...COMPARABLE_CANTON_CODES].sort();
  if (JSON.stringify(comparableFromFlags) !== JSON.stringify(comparableFromTyped)) {
    throw new Error(
      `[cantons] Incohérence comparable : flags=[${comparableFromFlags.join(",")}] ` +
        `vs COMPARABLE_CANTON_CODES=[${comparableFromTyped.join(",")}]. ` +
        `Synchroniser src/lib/swiss/cantons.ts.`,
    );
  }
})();

// =====================================================================
//  Compat (ancienne API)
// =====================================================================

/**
 * Cantons romands ayant un accord d'imposition spécial pour frontaliers
 * français (rétrocession 4.5 % au pays de résidence).
 *
 * Note v1 : la liste fédérale complète est ["BE","BL","BS","JU","NE","SO","VD","VS"].
 * Hors scope v1 : BE, BL, BS, SO. Sera réintroduit en v1.5+ quand ces
 * cantons deviendront `selectable`.
 */
export const CROSS_BORDER_FR_CANTONS: readonly string[] = ["JU", "NE", "VD", "VS", "FR"];

// Genève applique son régime d'imposition à la source classique (pas la
// rétrocession 4.5 %).
export const GENEVA_CODE = "GE";
