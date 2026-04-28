// Système i18n maison · v1.
//
// Signature :
//   t(key, params?, fallback?)
//
// - `key`      : clé du dictionnaire (ex: "canton.GE", "lpp.rachat.suggestion")
// - `params`   : variables à interpoler dans la chaîne (ex: { montant: 47200 })
//                Les nombres sont automatiquement formatés au standard suisse
//                (apostrophe comme séparateur de milliers).
// - `fallback` : texte de secours si la clé est absente du dictionnaire.
//                À défaut, la clé elle-même est retournée (utile pour repérer
//                les manques en développement).
//
// Placeholders supportés dans le dictionnaire : `{nom}` (ex: "{montant} CHF").
//
// Migration vers DE/IT en v2 : ajouter src/lib/i18n/de.ts (mêmes clés) et
// remplacer la constante `dict` par un sélecteur conditionnel basé sur la
// langue active. Les call-sites `t(...)` n'ont pas à changer.

import { fr } from "./fr";
import { formatNumberCH } from "./format";

const dict = fr;

export type TranslationParams = Record<string, string | number>;

export function t(key: string, params?: TranslationParams, fallback?: string): string {
  const template = dict[key] ?? fallback ?? key;
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
