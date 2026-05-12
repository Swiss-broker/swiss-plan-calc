// Stockage module-level de la langue active.
// Lu par t() et formatNumberCH() à chaque appel · synchronisé par LanguageProvider.

import type { AppLanguage } from "./types";

let _activeLang: AppLanguage = "fr";

export function getActiveLanguage(): AppLanguage {
  return _activeLang;
}

export function setActiveLanguage(lang: AppLanguage): void {
  _activeLang = lang;
}

const STORAGE_KEY = "swissbroker.lang";

export function loadStoredLanguage(): AppLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "fr" || v === "de" || v === "en" || v === "it") return v;
  } catch {
    /* localStorage indisponible · ignore */
  }
  return null;
}

/** Détecte la langue du navigateur (navigator.language) parmi fr/de/en/it. */
export function detectBrowserLanguage(): AppLanguage | null {
  if (typeof navigator === "undefined") return null;
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const raw of langs) {
    if (!raw) continue;
    const code = raw.toLowerCase().slice(0, 2);
    if (code === "fr" || code === "de" || code === "en" || code === "it") return code;
  }
  return null;
}

export function persistLanguage(lang: AppLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}
