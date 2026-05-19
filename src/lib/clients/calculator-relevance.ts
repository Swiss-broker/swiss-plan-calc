// Source de vérité unique : un calculateur est-il pertinent pour ce client ?
// Utilisé par la barre des calculateurs (fiche client) pour griser
// les chips non applicables tout en les laissant cliquables (what-if).

import type { Client } from "./types";

export type CalcRoute =
  | "/calculators/income-tax"
  | "/calculators/source-tax"
  | "/calculators/cross-border"
  | "/calculators/tax-global"
  | "/calculators/pillar3a"
  | "/calculators/lpp"
  | "/calculators/vested-benefits"
  | "/calculators/retirement"
  | "/calculators/canton-compare"
  | "/calculators/avs-ai"
  | "/calculators/tou"
  | "/calculators/investment-compare"
  | "/calculators/director-compensation"
  | "/calculators/health-insurance-france"
  | "/calculators/overtime";

export interface Relevance {
  relevant: boolean;
  /** Raison du grisage (vide si pertinent). Affichée en tooltip. */
  reason: string;
}

const OK: Relevance = { relevant: true, reason: "" };

export function getCalculatorRelevance(c: Client, route: CalcRoute): Relevance {
  const ws = c.work_status;
  const ts = c.tax_status;

  switch (route) {
    case "/calculators/lpp":
      if (ws === "retired") return { relevant: false, reason: "Client retraité, plus de cotisation LPP." };
      if (ws === "unemployed") return { relevant: false, reason: "Client sans emploi, pas d'affiliation LPP active." };
      if (ws === "self_employed")
        return { relevant: false, reason: "Indépendant pur : affiliation LPP facultative, non obligatoire." };
      if (ws === "student")
        return { relevant: false, reason: "Étudiant : généralement sous le seuil LPP (CHF 22'680)." };
      return OK;

    case "/calculators/pillar3a":
      if (ws === "retired") return { relevant: false, reason: "Client retraité, plus de cotisation 3a possible." };
      if (ws === "unemployed")
        return { relevant: false, reason: "Sans revenu d'activité, pas de cotisation 3a déductible." };
      return OK;

    case "/calculators/source-tax":
      if (ts === "source_taxed" || ts === "tou") return OK;
      return { relevant: false, reason: "Le client n'est pas imposé à la source." };

    case "/calculators/cross-border":
      if (ts === "cross_border_fr_1983" || ts === "cross_border_ge") return OK;
      return { relevant: false, reason: "Le client n'est pas frontalier." };

    case "/calculators/director-compensation":
      if (ws !== "director") return { relevant: false, reason: "Réservé aux clients dirigeants de société." };
      if (!c.company_id)
        return { relevant: false, reason: "Aucune société rattachée à ce client : préfill impossible." };
      return OK;

    case "/calculators/tou":
      if (ts !== "source_taxed" && ts !== "tou")
        return { relevant: false, reason: "TOU pertinent uniquement pour les contribuables imposés à la source." };
      return OK;

    case "/calculators/vested-benefits":
      if (ws === "student" || ws === "unemployed")
        return { relevant: false, reason: "Pas de comptes de libre passage attendus pour ce profil." };
      return OK;

    case "/calculators/avs-ai":
    case "/calculators/income-tax":
    case "/calculators/tax-global":
    case "/calculators/retirement":
    case "/calculators/canton-compare":
    case "/calculators/investment-compare":
      return OK;

    case "/calculators/health-insurance-france":
      if (
        ts === "cross_border_fr_1983" ||
        (ts === "cross_border_ge" && c.country_of_residence === "FR")
      )
        return OK;
      return { relevant: false, reason: "Spécifique aux frontaliers résidents en France." };

    case "/calculators/overtime":
      if (
        ts === "cross_border_fr_1983" ||
        ts === "cross_border_ge" ||
        ts === "source_taxed" ||
        ts === "tou"
      )
        return OK;
      return { relevant: false, reason: "Pertinent pour frontaliers et imposés à la source." };
  }
}
