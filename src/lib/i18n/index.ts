// Système i18n · v2 (4 langues, fallback FR).
//
// API :
//   t(key, params?, fallback?)             · utilisable hors composant React
//   useT() / useLanguage()                 · hooks réactifs (depuis LanguageContext)
//
// Architecture : la langue active est stockée dans `active.ts` (module-level),
// synchronisée par <LanguageProvider>. La fonction `t()` lit cette valeur à
// chaque appel ; le re-rendu réactif est assuré par re-mount via `key={lang}`
// dans le RootComponent.

import { fr } from "./fr";
import { de } from "./de";
import { en } from "./en";
import { it } from "./it";
import { formatNumberCH } from "./format";
import { getActiveLanguage } from "./active";
import type { AppLanguage } from "./types";

const DICTS: Record<AppLanguage, Record<string, string>> = { fr, de, en, it };

export type TranslationParams = Record<string, string | number>;

export function t(key: string, params?: TranslationParams, fallback?: string): string {
  const lang = getActiveLanguage();
  const template =
    DICTS[lang][key] ??
    DICTS.fr[key] ?? // fallback FR (source de vérité)
    fallback ??
    key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) return `{${name}}`;
    return typeof value === "number" ? formatNumberCH(value) : String(value);
  });
}

/** Helper raccourci pour les noms de cantons. */
export function tCanton(code: string): string {
  return t(`canton.${code}`, undefined, code);
}

export type { AppLanguage } from "./types";
export { SUPPORTED_LANGUAGES, LANGUAGE_META } from "./types";
