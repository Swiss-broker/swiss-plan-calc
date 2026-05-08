// Formatage numérique multilingue.
//
// Convention CH (FR/DE/IT) : apostrophe comme séparateur de milliers ("47'200").
// Convention EN (anglais) : virgule comme séparateur de milliers ("47,200").

import type { AppLanguage } from "./types";
import { getActiveLanguage } from "./active";

const CACHE = new Map<string, Intl.NumberFormat>();

function localeFor(lang: AppLanguage): string {
  switch (lang) {
    case "en":
      return "en-CH"; // virgule séparateur, francs suisses
    case "de":
      return "de-CH";
    case "it":
      return "it-CH";
    case "fr":
    default:
      return "fr-CH";
  }
}

function fmt(lang: AppLanguage, decimals: number): Intl.NumberFormat {
  const key = `${lang}:${decimals}`;
  let f = CACHE.get(key);
  if (!f) {
    f = new Intl.NumberFormat(localeFor(lang), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    CACHE.set(key, f);
  }
  return f;
}

/** Formate un nombre selon la langue active (ou la langue passée). */
export function formatNumberCH(value: number, decimals = 0, lang?: AppLanguage): string {
  if (!Number.isFinite(value)) return "—";
  return fmt(lang ?? getActiveLanguage(), decimals).format(value);
}

/** Formate un montant en CHF (ex FR/DE/IT: "47'200 CHF"; EN: "47,200 CHF"). */
export function formatCHF(
  value: number | null | undefined,
  decimals = 0,
  lang?: AppLanguage,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumberCH(value, decimals, lang)} CHF`;
}
