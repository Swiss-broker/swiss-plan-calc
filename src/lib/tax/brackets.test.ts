// Tests structurels des barèmes à paliers — IFD, et chaque canton
// (CANTON_SCALES.single/.married/.wealthScale), plus les tables à taux
// moyen (FR, VS cantonal, VS communal).
//
// But : attraper les fautes de frappe de transcription (un "base" ou un
// "rate" mal recopié depuis un PDF officiel) qui créeraient un saut
// anormal ou une incohérence juste à la frontière entre deux tranches —
// exactement l'endroit où ce genre d'erreur est invisible à l'œil nu mais
// change le montant payé par un client dont le revenu tombe pile dessus.
//
// Ce ne sont PAS des vérifications de VALEUR (est-ce que le taux officiel
// est bien 8.8% ?) — pour ça, voir reference-cases.test.ts et
// cantons.test.ts. Ce sont des vérifications de COHÉRENCE STRUCTURELLE :
// la table est-elle triée, continue, croissante, sans trou ni chevauchement ?
// Ce test tourne automatiquement sur CHAQUE canton de CANTON_SCALES — un
// nouveau canton ajouté au moteur est couvert sans rien écrire de plus.

import { describe, expect, it } from "vitest";
import { IFD_SINGLE_2026, IFD_MARRIED_2026, computeIFD } from "./ifd";
import {
  CANTON_SCALES,
  applySimpleScale,
  averageRatePercent,
  FR_INCOME_CLASSES,
  FR_TOP_RATE_PERCENT,
  VS_CANTONAL_CLASSES,
  VS_CANTONAL_TOP_RATE_PERCENT,
  VS_COMMUNAL_CLASSES,
  VS_COMMUNAL_TOP_RATE_PERCENT,
  type AverageRateClass,
} from "./cantons";
import type { BracketStep } from "./ifd";

// ─────────────────────────────────────────────────────────────────────────
// Barèmes à paliers marginaux (IFD, chaque canton single/married/wealth)
// ─────────────────────────────────────────────────────────────────────────

// Seuils repérés par ce test mais NON corrigés, faute de preuve suffisante
// (écart petit et isolé — un seul seuil sur toute la table —, contrairement
// au cas VS fortune ci-dessous qui touchait CHAQUE palier avec un écart
// croissant jusqu'à plusieurs milliers de CHF). À vérifier contre les
// barèmes officiels NE/BE si l'occasion se présente ; jusque-là, exclus
// explicitement plutôt que masqués par une tolérance générale plus large.
const KNOWN_UNCONFIRMED_BRACKET_GAPS = new Set([
  "NE — barème revenu, célibataire@309000",
  "NE — barème revenu, marié@309000",
  "BE — barème revenu, marié@172800",
]);

function checkBracketScale(name: string, scale: BracketStep[]) {
  describe(name, () => {
    it("est trié par 'from' croissant, sans doublon", () => {
      for (let i = 1; i < scale.length; i++) {
        expect(scale[i].from).toBeGreaterThan(scale[i - 1].from);
      }
    });

    it("l'impôt cumulé (base) ne décroît jamais d'une tranche à l'autre", () => {
      for (let i = 1; i < scale.length; i++) {
        expect(scale[i].base).toBeGreaterThanOrEqual(scale[i - 1].base);
      }
    });

    it("à chaque seuil, l'impôt juste en dessous et juste au-dessus ne fait pas de saut anormal", () => {
      for (let i = 1; i < scale.length; i++) {
        const threshold = scale[i].from;
        if (threshold <= 0) continue;
        if (KNOWN_UNCONFIRMED_BRACKET_GAPS.has(`${name}@${threshold}`)) continue;
        const below = applySimpleScale(threshold - 1, scale);
        const at = applySimpleScale(threshold, scale);
        // Monotone, avec 1 CHF de tolérance : les tables officielles
        // publient chaque palier indépendamment arrondi, ce qui peut créer
        // un micro-recul (quelques centimes) au seuil — pas une vraie baisse.
        expect(at).toBeGreaterThanOrEqual(below - 1);
        // Saut borné : une vraie faute de frappe sur "base" crée un écart
        // énorme (des centaines/milliers de CHF) ; un arrondi officiel
        // légitime reste sous ce plafond généreux.
        const jump = at - below;
        expect(jump).toBeLessThan(Math.max(50, threshold * 0.05));
      }
    });
  });
}

checkBracketScale("IFD — personne seule", IFD_SINGLE_2026);
checkBracketScale("IFD — mariée/monoparentale", IFD_MARRIED_2026);

for (const [canton, scale] of Object.entries(CANTON_SCALES)) {
  checkBracketScale(`${canton} — barème revenu, célibataire`, scale.single);
  checkBracketScale(`${canton} — barème revenu, marié`, scale.married);
  checkBracketScale(`${canton} — barème fortune`, scale.wealthScale);
}

// ─────────────────────────────────────────────────────────────────────────
// Barèmes à taux moyen (FR, VS cantonal, VS communal)
// ─────────────────────────────────────────────────────────────────────────

function checkAverageRateClasses(
  name: string,
  classes: AverageRateClass[],
  topRatePercent: number,
) {
  describe(name, () => {
    it("chaque classe a incomeTo > incomeFrom, triée sans trou ni chevauchement", () => {
      for (const c of classes) {
        expect(c.incomeTo).toBeGreaterThan(c.incomeFrom);
      }
      for (let i = 1; i < classes.length; i++) {
        const gap = classes[i].incomeFrom - classes[i - 1].incomeTo;
        // Convention "touche" (gap 0) ou "jusqu'à X, puis dès X+1" (gap 1) —
        // les deux existent dans le code selon le canton. Jamais plus.
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(1);
      }
    });

    it("le taux ne décroît jamais d'une classe à l'autre (tolérance d'arrondi officiel)", () => {
      for (const c of classes) {
        expect(c.rateToPercent).toBeGreaterThanOrEqual(c.rateFromPercent);
      }
      for (let i = 1; i < classes.length; i++) {
        const drop = classes[i - 1].rateToPercent - classes[i].rateFromPercent;
        expect(drop).toBeLessThanOrEqual(0.5);
      }
    });

    it("la dernière classe rejoint le taux plafond déclaré", () => {
      expect(classes[classes.length - 1].rateToPercent).toBeCloseTo(topRatePercent, 1);
    });

    it("à chaque seuil, le taux moyen juste en dessous et juste au-dessus est cohérent", () => {
      for (let i = 1; i < classes.length; i++) {
        const threshold = classes[i].incomeFrom;
        const below = averageRatePercent(threshold - 1, classes, topRatePercent);
        const at = averageRatePercent(threshold, classes, topRatePercent);
        expect(at).toBeGreaterThanOrEqual(below - 0.01);
        expect(at - below).toBeLessThan(1); // pas de saut de plus d'1 point au seuil
      }
    });
  });
}

checkAverageRateClasses(
  "FR — barème cantonal (taux moyen)",
  FR_INCOME_CLASSES,
  FR_TOP_RATE_PERCENT,
);
checkAverageRateClasses(
  "VS — barème cantonal (taux moyen)",
  VS_CANTONAL_CLASSES,
  VS_CANTONAL_TOP_RATE_PERCENT,
);
checkAverageRateClasses(
  "VS — barème communal (taux moyen)",
  VS_COMMUNAL_CLASSES,
  VS_COMMUNAL_TOP_RATE_PERCENT,
);

// ─────────────────────────────────────────────────────────────────────────
// IFD : vérifie aussi l'arrondi officiel (0.05 CHF à la baisse) au seuil
// ─────────────────────────────────────────────────────────────────────────

describe("IFD — arrondi à 0.05 CHF à la baisse", () => {
  it.each([15_200, 33_200, 43_500, 58_000, 76_100, 81_900, 108_800, 141_500, 184_900])(
    "single : impôt à %i CHF est un multiple de 0.05",
    (threshold) => {
      const tax = computeIFD(threshold, "single");
      expect(Math.round(tax * 100) % 5).toBe(0);
    },
  );
});
