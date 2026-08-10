// Moteur de scénarios "what if" pour la fiche client.
// Construit un IncomeTaxInput baseline depuis le client et applique des variantes.

import type { Client, ClientPension, ClientAssets } from "@/lib/clients/types";
import { parseChildren } from "@/lib/clients/types";
import type { IncomeTaxInput } from "@/lib/tax/income";
import { PILLAR_3A_MAX_2026_LPP } from "@/lib/tax/income";
import { t } from "@/lib/i18n";


export type ScenarioId =
  | "baseline"
  | "marriage"
  | "divorce"
  | "new_child"
  | "max_3a"
  | "lpp_buyback_full"
  | "retirement_65"
  | "move_zg"
  | "move_sz"
  | "move_ge"
  | "move_vd"
  | "raise_10"
  | "part_time_80";

export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  description: string;
  category: "vie" | "fiscal" | "prevoyance" | "geo" | "carriere";
  apply: (base: IncomeTaxInput) => IncomeTaxInput;
}

export function clientToTaxInput(
  client: Client,
  pension: ClientPension | null,
  assets: ClientAssets | null,
): IncomeTaxInput {
  const children = parseChildren(client.children);
  const fortune =
    Number(assets?.bank_accounts ?? 0) +
    Number(assets?.securities ?? 0) +
    Number(assets?.real_estate_value ?? 0) -
    Number(assets?.mortgage_debt ?? 0);

  return {
    canton: client.canton ?? "VD",
    status:
      client.civil_status === "married" || client.civil_status === "registered_partnership"
        ? "married"
        : children.length > 0
          ? "single_with_children"
          : "single",
    confession:
      client.confession === "roman_catholic" || client.confession === "christian_catholic"
        ? "catholic"
        : client.confession === "protestant"
          ? "protestant"
          : client.confession === "none"
            ? "none"
            : "other",
    children: children.length,
    grossSalary: Number(client.gross_annual_salary ?? 0),
    spouseGrossSalary: Number(client.spouse_gross_annual_salary ?? 0),
    bonus: Number(client.bonus ?? 0),
    otherIncome: Number(client.other_income ?? 0),
    pillar3aContributions: Number(pension?.pillar_3a_annual_contribution ?? 0),
    mortgageInterest: Number(assets?.mortgage_interest ?? 0),
    realEstateMaintenance: Number(assets?.real_estate_maintenance ?? 0),
    netWealth: fortune,
  };
}

// Helpers : labels/descriptions résolus dynamiquement via i18n.
function L(id: ScenarioId, frLabel: string, frDesc: string, category: ScenarioDef["category"], apply: ScenarioDef["apply"]): ScenarioDef {
  return {
    id,
    category,
    apply,
    get label() { return t(`scenario.${id}.label`, undefined, frLabel); },
    get description() { return t(`scenario.${id}.desc`, undefined, frDesc); },
  } as ScenarioDef;
}

export const SCENARIO_PRESETS: ScenarioDef[] = [
  L("baseline", "Situation actuelle", "Référence · paramètres tels que dans la fiche client.", "vie", (b) => ({ ...b })),
  L("marriage", "Mariage", "Passage en imposition couple (splitting selon barème cantonal).", "vie", (b) => ({ ...b, status: "married" })),
  L("divorce", "Divorce", "Retour en célibataire, conjoint retiré.", "vie", (b) => ({
    ...b,
    status: (b.children ?? 0) > 0 ? "single_with_children" : "single",
    spouseGrossSalary: 0,
  })),
  L("new_child", "Naissance d'un enfant", "Ajout d'un enfant à charge (déduction sociale + barème famille).", "vie", (b) => ({ ...b, children: (b.children ?? 0) + 1 })),
  L("max_3a", "Versement 3a au plafond", `Cotisation portée à CHF ${PILLAR_3A_MAX_2026_LPP.toLocaleString("fr-CH")} (affilié LPP).`, "prevoyance", (b) => ({ ...b, pillar3aContributions: PILLAR_3A_MAX_2026_LPP })),
  L("lpp_buyback_full", "Rachat LPP (lacune complète)", "Versement de la capacité de rachat LPP en une fois.", "prevoyance", (b) => ({ ...b, lppBuyback: Math.max(0, b.lppBuyback ?? 0) })),
  L("retirement_65", "Départ retraite ordinaire", "Salaire à 0, revenu rente AVS+LPP estimé à 60 % du dernier salaire.", "carriere", (b) => {
    const lastSalary = (b.grossSalary ?? 0) + (b.bonus ?? 0);
    return { ...b, grossSalary: 0, bonus: 0, otherIncome: Math.round(lastSalary * 0.6), pillar3aContributions: 0, lppBuyback: 0 };
  }),
  L("move_zg", "Déménagement → Zoug", "Canton fiscalement parmi les plus avantageux de Suisse.", "geo", (b) => ({ ...b, canton: "ZG", communalMultiplier: undefined, cantonalMultiplier: undefined })),
  L("move_sz", "Déménagement → Schwytz", "Faible fiscalité cantonale, proche de Zurich.", "geo", (b) => ({ ...b, canton: "SZ", communalMultiplier: undefined, cantonalMultiplier: undefined })),
  L("move_ge", "Déménagement → Genève", "Comparatif avec un canton à fiscalité élevée.", "geo", (b) => ({ ...b, canton: "GE", communalMultiplier: undefined, cantonalMultiplier: undefined })),
  L("move_vd", "Déménagement → Vaud", "Lausanne et arc lémanique.", "geo", (b) => ({ ...b, canton: "VD", communalMultiplier: undefined, cantonalMultiplier: undefined })),
  L("raise_10", "Augmentation salaire +10 %", "Impact sur progressivité et taux marginal.", "carriere", (b) => ({
    ...b, grossSalary: Math.round((b.grossSalary ?? 0) * 1.1), bonus: Math.round((b.bonus ?? 0) * 1.1),
  })),
  L("part_time_80", "Passage à 80 %", "Réduction du salaire à 80 % du brut actuel.", "carriere", (b) => ({
    ...b, grossSalary: Math.round((b.grossSalary ?? 0) * 0.8), bonus: Math.round((b.bonus ?? 0) * 0.8),
  })),
];

export const SCENARIO_BY_ID: Record<ScenarioId, ScenarioDef> = Object.fromEntries(
  SCENARIO_PRESETS.map((s) => [s.id, s]),
) as Record<ScenarioId, ScenarioDef>;

const CATEGORY_FR: Record<ScenarioDef["category"], string> = {
  vie: "Événements de vie",
  fiscal: "Fiscalité",
  prevoyance: "Prévoyance",
  geo: "Géographie",
  carriere: "Carrière",
};

export const CATEGORY_LABELS: Record<ScenarioDef["category"], string> = new Proxy(CATEGORY_FR, {
  get(target, prop: string) {
    if (!(prop in target)) return (target as Record<string, string>)[prop];
    return t(`scenario.cat.${prop}`, undefined, (target as Record<string, string>)[prop]);
  },
}) as Record<ScenarioDef["category"], string>;