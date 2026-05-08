// Dictionnaire allemand · ÉTAPE 1 — placeholders préfixés [DE].
// Étape 2 : remplacement par traductions officielles (BVG/AHV/Quellensteuer…).

import { fr } from "./fr";

const PRESERVE_PREFIX = new Set([
  "canton.", // codes cantons
  "lang.",
  "wiki.translation_pending",
]);

function placeholder(key: string, value: string): string {
  if (key === "wiki.translation_pending") {
    return "📚 Dieser Inhalt ist derzeit nur auf Französisch verfügbar. Übersetzungen sind in Arbeit.";
  }
  if (key === "lang.fr") return "Französisch";
  if (key === "lang.de") return "Deutsch";
  if (key === "lang.en") return "Englisch";
  if (key === "lang.it") return "Italienisch";
  if (key === "lang.label") return "Sprache";
  for (const p of PRESERVE_PREFIX) {
    if (key === p || key.startsWith(p)) return value;
  }
  return `[DE] ${value}`;
}

export const de: Record<string, string> = Object.fromEntries(
  Object.entries(fr).map(([k, v]) => [k, placeholder(k, v)]),
);
