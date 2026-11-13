// Barèmes officiels de l'impôt à la source, par canton. Source unique pour
// l'impôt à la source des résidents (source.ts) et des frontaliers
// (cross-border.ts) : un même salaire dans un même canton donne le même taux
// dans tous les calculateurs.

import { GE_IS_RATES_2026 } from "./ge-source-2026";
import { VD_IS_RATES_2026 } from "./vd-source-2026";
import { FR_IS_RATES_2026 } from "./fr-source-2026";
import { JU_IS_RATES_2026 } from "./ju-source-2026";
import { VS_IS_RATES_2025 } from "./vs-source-2025";
import { NE_IS_RATES_2026 } from "./ne-source-2026";

interface OfficialSourceTable {
  rates: Record<string, [number, number][]>;
  /** Nombre maximal d'enfants couvert par le barème. */
  maxChildren: number;
}

export const OFFICIAL_SOURCE_TABLES: Record<string, OfficialSourceTable> = {
  GE: { rates: GE_IS_RATES_2026, maxChildren: 5 },
  VD: { rates: VD_IS_RATES_2026, maxChildren: 6 },
  FR: { rates: FR_IS_RATES_2026, maxChildren: 9 },
  NE: { rates: NE_IS_RATES_2026, maxChildren: 8 },
  // Jura : A0 et H1-H8 complets ; B et C seulement jusqu'à 2 enfants.
  JU: { rates: JU_IS_RATES_2026, maxChildren: 8 },
  // Valais : barèmes A et B seulement (édition 2025) ; C et H non fournis.
  VS: { rates: VS_IS_RATES_2025, maxChildren: 6 },
};

/** Taux (%) lu sur une table [revenu annuel, taux], interpolation linéaire. */
export function interpolateRate(points: [number, number][], annualGross: number): number {
  if (annualGross <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (annualGross >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (annualGross <= x1) return y0 + ((annualGross - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/**
 * Taux officiel (%) pour un canton, un barème (A, B, C, H) et un nombre
 * d'enfants. `null` si le canton n'a pas de barème officiel intégré.
 *  - A : toujours A0 ;
 *  - H sans enfant : n'existe pas, retombe sur A0 ;
 *  - au-delà du nombre d'enfants prévu : dernier sous-indice du barème ;
 *  - barème (lettre) absent pour ce canton : `null`.
 */
export function officialSourceRate(
  canton: string,
  annualGross: number,
  letter: string,
  children: number,
): number | null {
  const table = OFFICIAL_SOURCE_TABLES[canton];
  if (!table) return null;
  const n = Math.max(0, Math.min(table.maxChildren, Math.floor(children)));
  if (letter === "A" || (letter === "H" && n === 0)) {
    return interpolateRate(table.rates.A0, annualGross);
  }
  // Barème absent pour ce canton (ex. Valais C et H) : pas de taux officiel.
  // Sous-indice absent (ex. Jura B3) : dernier sous-indice disponible.
  for (let k = n; k >= 0; k--) {
    const points = table.rates[`${letter}${k}`];
    if (points) return interpolateRate(points, annualGross);
  }
  return null;
}
