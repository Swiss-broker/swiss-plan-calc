// Types pour l'historique des simulations sauvegardées.
export type SimulationKind =
  | "income_tax"
  | "source_tax"
  | "lpp"
  | "pillar3a"
  | "retirement"
  | "canton_compare"
  | "investment_compare"
  | "avs_ai"
  | "vested_benefits"
  | "cross_border"
  | "tou"
  | "director_compensation"
  | "health_insurance_france"
  | "overtime";

export interface HistoryEntry {
  id: string;
  broker_id: string;
  client_id: string | null;
  kind: SimulationKind;
  title: string;
  note: string | null;
  inputs: Record<string, unknown>;
  summary: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface HistoryKpi {
  label: string;
  value: number | string;
  unit?: "CHF" | "%" | null;
}

import { t } from "@/lib/i18n";

const KIND_LABELS_FR: Record<SimulationKind, string> = {
  income_tax: "Impôt revenu & fortune",
  source_tax: "Impôt à la source",
  lpp: "LPP & rachats",
  pillar3a: "Pilier 3a",
  retirement: "Rente vs capital",
  canton_compare: "Comparateur cantonal",
  investment_compare: "Comparateur d'investissements",
  avs_ai: "Rente AVS/AI (1er pilier)",
  vested_benefits: "Libre passage",
  cross_border: "Frontaliers",
  tou: "TOU / Quasi-résident",
  director_compensation: "Rémunération dirigeant",
  health_insurance_france: "Assurance santé frontaliers (CMU/CNTFS)",
  overtime: "Heures supplémentaires frontaliers",
};

// Proxy i18n : `KIND_LABELS[k]` reste valide partout, mais résout via t() au runtime.
export const KIND_LABELS: Record<SimulationKind, string> = new Proxy(KIND_LABELS_FR, {
  get(target, prop: string) {
    if (!(prop in target)) return (target as Record<string, string>)[prop];
    return t(`history.kind.${prop}`, undefined, (target as Record<string, string>)[prop]);
  },
}) as Record<SimulationKind, string>;

export const KIND_ROUTES: Record<SimulationKind, string> = {
  income_tax: "/calculators/income-tax",
  source_tax: "/calculators/source-tax",
  lpp: "/calculators/lpp",
  pillar3a: "/calculators/pillar3a",
  retirement: "/calculators/retirement",
  canton_compare: "/calculators/canton-compare",
  investment_compare: "/calculators/investment-compare",
  avs_ai: "/calculators/avs-ai",
  vested_benefits: "/calculators/vested-benefits",
  cross_border: "/calculators/cross-border",
  tou: "/calculators/tou",
  director_compensation: "/calculators/director-compensation",
  health_insurance_france: "/calculators/health-insurance-france",
  overtime: "/calculators/overtime",
};
