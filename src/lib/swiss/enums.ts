// Libellés FR pour les enums DB · utilisés dans les formulaires & fiches.
//
// ⚠️ V2 · Multilingue : ces objets sont désormais des Proxy qui résolvent
// chaque libellé via `t('enum.<categorie>.<valeur>')` à l'accès. Les
// call-sites existants `LABELS[value]` continuent de fonctionner sans
// modification, et basculent automatiquement de langue.
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/i18n";

export type CivilStatus = Database["public"]["Enums"]["civil_status"];
export type Confession = Database["public"]["Enums"]["confession"];
export type Permit = Database["public"]["Enums"]["permit_type"];
export type TaxStatus = Database["public"]["Enums"]["tax_status"];
export type WorkStatus = Database["public"]["Enums"]["work_status"];
export type LppPlan = Database["public"]["Enums"]["lpp_plan_type"];
export type Gender = Database["public"]["Enums"]["gender"];

function makeI18nLabels<T extends string>(
  category: string,
  fallback: Record<T, string>,
): Record<T, string> {
  return new Proxy(fallback, {
    get(target, prop: string) {
      if (!(prop in target)) return (target as Record<string, string>)[prop];
      return t(`enum.${category}.${prop}`, undefined, (target as Record<string, string>)[prop]);
    },
  }) as Record<T, string>;
}

export const GENDER_LABELS = makeI18nLabels<Gender>("gender", {
  male: "Homme",
  female: "Femme",
  other: "Autre / Non binaire",
});

export const CIVIL_STATUS_LABELS = makeI18nLabels<CivilStatus>("civil_status", {
  single: "Célibataire",
  married: "Marié(e)",
  registered_partnership: "Partenariat enregistré",
  divorced: "Divorcé(e)",
  widowed: "Veuf / Veuve",
  separated: "Séparé(e)",
} as Record<CivilStatus, string>);

// Concubinage : non persisté en DB, libellé exposé via i18n pour le calculateur Global.
export const COHABITING_LABEL_FALLBACK = "Concubinage";

export const CONFESSION_LABELS = makeI18nLabels<Confession>("confession", {
  none: "Sans confession",
  roman_catholic: "Catholique romain",
  protestant: "Protestant / Réformé",
  christian_catholic: "Catholique chrétien",
  jewish: "Israélite",
  other: "Autre",
});

export const PERMIT_LABELS = makeI18nLabels<Permit>("permit", {
  swiss: "Suisse",
  C: "Permis C (établissement)",
  B: "Permis B (séjour)",
  L: "Permis L (courte durée)",
  Ci: "Permis Ci (regroupement)",
  F: "Permis F (admission provisoire)",
  G: "Permis G (frontalier)",
  none: "Aucun",
});

export const TAX_STATUS_LABELS = makeI18nLabels<TaxStatus>("tax_status", {
  resident: "Résident(e) · taxation ordinaire",
  source_taxed: "Imposé(e) à la source (permis B/L)",
  cross_border_fr_1983: "Frontalier(ère) français(e) · accord 1983",
  cross_border_ge: "Frontalier(ère) Genève (IS au barème normal)",
  tou: "TOU · Taxation Ordinaire Ultérieure",
});

export const WORK_STATUS_LABELS = makeI18nLabels<WorkStatus>("work_status", {
  employee: "Salarié",
  self_employed: "Indépendant",
  director: "Dirigeant de société",
  mixed: "Mixte (salarié + indépendant)",
  retired: "Retraité",
  unemployed: "Sans emploi",
  student: "Étudiant",
});

export const LPP_PLAN_LABELS = makeI18nLabels<LppPlan>("lpp_plan", {
  mandatory: "LPP obligatoire",
  extra_mandatory: "Sur-obligatoire",
  executive: "Plan cadres / 1e",
  mixed: "Mixte",
});

export const SOURCE_TAX_SCALES = ["A", "B", "C", "H", "L", "M", "N", "P", "Q", "R", "S", "T"] as const;
export type SourceTaxScale = (typeof SOURCE_TAX_SCALES)[number];

export const SOURCE_TAX_SCALE_LABELS: Record<SourceTaxScale, string> = {
  A: "A · Célibataire sans enfant",
  B: "B · Marié, un seul revenu",
  C: "C · Marié, double revenu",
  H: "H · Famille monoparentale",
  L: "L · Frontalier célibataire (DE)",
  M: "M · Frontalier marié 1 revenu (DE)",
  N: "N · Frontalier marié 2 revenus (DE)",
  P: "P · Frontalier monoparental (DE)",
  Q: "Q · Frontalier C/D (DE)",
  R: "R · Acteur / artiste",
  S: "S · Sportif",
  T: "T · Conférencier",
};
