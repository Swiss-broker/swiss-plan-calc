// Dictionnaire italien · ÉTAPE 1 — placeholders préfixés [IT].
// Étape 3 : remplacement par traductions officielles (LPP/AVS/Imposta alla fonte…).

import { fr } from "./fr";

const PRESERVE_PREFIX = new Set([
  "canton.",
  "lang.",
  "wiki.translation_pending",
]);

function placeholder(key: string, value: string): string {
  if (key === "wiki.translation_pending") {
    return "📚 Questo contenuto è attualmente disponibile solo in francese. Le traduzioni sono in corso.";
  }
  if (key === "lang.fr") return "Francese";
  if (key === "lang.de") return "Tedesco";
  if (key === "lang.en") return "Inglese";
  if (key === "lang.it") return "Italiano";
  if (key === "lang.label") return "Lingua";
  for (const p of PRESERVE_PREFIX) {
    if (key === p || key.startsWith(p)) return value;
  }
  return `[IT] ${value}`;
}

export const it: Record<string, string> = Object.fromEntries(
  Object.entries(fr).map(([k, v]) => [k, placeholder(k, v)]),
);
