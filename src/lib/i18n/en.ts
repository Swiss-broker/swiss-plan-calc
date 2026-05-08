// Dictionnaire anglais · ÉTAPE 1 — placeholders préfixés [EN].
// Étape 3 : remplacement par traductions officielles (BVG/OASI/Withholding tax…).

import { fr } from "./fr";

const PRESERVE_PREFIX = new Set([
  "canton.",
  "lang.",
  "wiki.translation_pending",
]);

function placeholder(key: string, value: string): string {
  if (key === "wiki.translation_pending") {
    return "📚 This content is currently available in French only. Translations are in progress.";
  }
  if (key === "lang.fr") return "French";
  if (key === "lang.de") return "German";
  if (key === "lang.en") return "English";
  if (key === "lang.it") return "Italian";
  if (key === "lang.label") return "Language";
  for (const p of PRESERVE_PREFIX) {
    if (key === p || key.startsWith(p)) return value;
  }
  return `[EN] ${value}`;
}

export const en: Record<string, string> = Object.fromEntries(
  Object.entries(fr).map(([k, v]) => [k, placeholder(k, v)]),
);
