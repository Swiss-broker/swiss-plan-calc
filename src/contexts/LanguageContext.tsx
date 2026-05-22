import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveLanguage,
  loadStoredLanguage,
  persistLanguage,
  setActiveLanguage,
  detectBrowserLanguage,
} from "@/lib/i18n/active";
import { t as translate, type TranslationParams } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/i18n/types";

interface LanguageState {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: string, params?: TranslationParams, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Hydratation synchrone depuis localStorage (évite tout flash).
  const [lang, setLangState] = useState<AppLanguage>(() => {
    const stored = loadStoredLanguage();
    if (stored) {
      setActiveLanguage(stored);
      return stored;
    }
    const browser = detectBrowserLanguage();
    if (browser) {
      setActiveLanguage(browser);
      return browser;
    }
    return getActiveLanguage();
  });

  const { user } = useAuth();

  // Reconciliation BDD au login : si la préférence cloud diffère, on l'applique.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || error || !data?.preferred_language) return;
      const remote = data.preferred_language as AppLanguage;
      if (remote !== lang && !loadStoredLanguage()) {
        // Pas de choix local explicite → on adopte la valeur BDD.
        setActiveLanguage(remote);
        persistLanguage(remote);
        setLangState(remote);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setLang = useCallback(
    (next: AppLanguage) => {
      setActiveLanguage(next);
      persistLanguage(next);
      setLangState(next);
      // Persistance BDD best-effort, non bloquante.
      if (user) {
        void supabase
          .from("profiles")
          .update({ preferred_language: next })
          .eq("id", user.id);
      }
    },
    [user],
  );

  const value = useMemo<LanguageState>(
    () => ({
      lang,
      setLang,
      t: (key, params, fallback) => translate(key, params, fallback),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Raccourci dans les composants React, re-rend automatiquement au changement de langue. */
export function useT() {
  return useLanguage().t;
}
