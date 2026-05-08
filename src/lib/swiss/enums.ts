// Libellés FR pour les enums DB — utilisés dans les formulaires & fiches.
import type { Database } from "@/integrations/supabase/types";

export type CivilStatus = Database["public"]["Enums"]["civil_status"];
export type Confession = Database["public"]["Enums"]["confession"];
export type Permit = Database["public"]["Enums"]["permit_type"];
export type TaxStatus = Database["public"]["Enums"]["tax_status"];
export type WorkStatus = Database["public"]["Enums"]["work_status"];
export type LppPlan = Database["public"]["Enums"]["lpp_plan_type"];
export type Gender = Database["public"]["Enums"]["gender"];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Homme",
  female: "Femme",
  other: "Autre / Non binaire",
};

export const CIVIL_STATUS_LABELS: Record<CivilStatus, string> = {
  single: "Célibataire",
  married: "Marié(e)",
  registered_partnership: "Partenariat enregistré",
  divorced: "Divorcé(e)",
  widowed: "Veuf / Veuve",
  separated: "Séparé(e)",
};

export const CONFESSION_LABELS: Record<Confession, string> = {
  none: "Sans confession",
  roman_catholic: "Catholique romain",
  protestant: "Protestant / Réformé",
  christian_catholic: "Catholique chrétien",
  jewish: "Israélite",
  other: "Autre",
};

export const PERMIT_LABELS: Record<Permit, string> = {
  swiss: "Suisse",
  C: "Permis C (établissement)",
  B: "Permis B (séjour)",
  L: "Permis L (courte durée)",
  Ci: "Permis Ci (regroupement)",
  F: "Permis F (admission provisoire)",
  G: "Permis G (frontalier)",
  none: "Aucun",
};

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  ordinary_resident: "Résident — imposition ordinaire",
  source_taxed: "Imposé(e) à la source (permis B/L)",
  cross_border_g: "Frontalier(ère) — permis G (générique)",
  cross_border_fr_1983: "Frontalier(ère) français(e) — accord 1983",
  cross_border_ge: "Frontalier(ère) Genève (IS au barème normal)",
  quasi_resident: "Quasi-résident(e)",
  tou: "TOU — Taxation Ordinaire Ultérieure",
  non_taxable: "Non imposable",
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  employee: "Salarié",
  self_employed: "Indépendant",
  director: "Dirigeant de société",
  mixed: "Mixte (salarié + indépendant)",
  retired: "Retraité",
  unemployed: "Sans emploi",
  student: "Étudiant",
};

export const LPP_PLAN_LABELS: Record<LppPlan, string> = {
  mandatory: "LPP obligatoire",
  extra_mandatory: "Sur-obligatoire",
  executive: "Plan cadres / 1e",
  mixed: "Mixte",
};

export const SOURCE_TAX_SCALES = ["A", "B", "C", "H", "L", "M", "N", "P", "Q", "R", "S", "T"] as const;
export type SourceTaxScale = (typeof SOURCE_TAX_SCALES)[number];

export const SOURCE_TAX_SCALE_LABELS: Record<SourceTaxScale, string> = {
  A: "A — Célibataire sans enfant",
  B: "B — Marié, un seul revenu",
  C: "C — Marié, double revenu",
  H: "H — Famille monoparentale",
  L: "L — Frontalier célibataire (DE)",
  M: "M — Frontalier marié 1 revenu (DE)",
  N: "N — Frontalier marié 2 revenus (DE)",
  P: "P — Frontalier monoparental (DE)",
  Q: "Q — Frontalier C/D (DE)",
  R: "R — Acteur / artiste",
  S: "S — Sportif",
  T: "T — Conférencier",
};
