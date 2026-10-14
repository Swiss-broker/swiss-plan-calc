// src/lib/consent.ts
// Stockage local du consentement cookies (bandeau RGPD/nLPD). Les cookies
// strictement nécessaires (session Supabase Auth) ne demandent pas de
// consentement et restent toujours actifs ; seules les catégories
// analytics/marketing sont soumises au choix de l'utilisateur, conformément
// à ce que décrit déjà /legal/cookies.

export type ConsentCategories = {
  analytics: boolean;
  marketing: boolean;
};

export type ConsentRecord = ConsentCategories & {
  necessary: true;
  decidedAt: string;
};

const STORAGE_KEY = "sbp_cookie_consent";

export function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics !== "boolean" || typeof parsed?.marketing !== "boolean") return null;
    return {
      necessary: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    // Stockage indisponible (navigation privée stricte, etc.) : on traite
    // comme "aucun choix enregistré", le bandeau réapparaît simplement.
    return null;
  }
}

export function saveConsent(categories: ConsentCategories): ConsentRecord {
  const record: ConsentRecord = { necessary: true, ...categories, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Non bloquant : le choix ne sera simplement pas mémorisé.
  }
  return record;
}

// Événement DOM global permettant à n'importe quel composant (ex. le lien
// "Préférences cookies" du footer) de rouvrir le bandeau sans avoir besoin
// d'un contexte React partagé jusqu'à la racine.
export const OPEN_COOKIE_PREFERENCES_EVENT = "sbp:open-cookie-preferences";

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}
