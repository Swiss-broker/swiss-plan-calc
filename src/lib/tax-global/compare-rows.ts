// Lignes de comparaison "Avant / Après" du calculateur fiscal global —
// partagées entre TaxGlobalCompareCard (affichage live, avec analyse des
// causes) et tax-global.tsx (sauvegarde dans simulation_history), pour que
// le PDF de synthèse reprenne EXACTEMENT le même comparatif que celui vu à
// l'écran, au lieu de ne sauvegarder que le résultat courant sans référence
// "avant" (l'ancien payload ne contenait aucun compareRows, contrairement à
// LPP et au 3e pilier).
import type { TaxGlobalResult } from "./types";

export interface TaxGlobalCompareRow {
  id: string;
  label: string;
  current: number;
  projected: number;
  format?: "pct";
  betterWhen: "lower" | "higher";
}

export const ifdRow = (r: TaxGlobalResult): number =>
  r.income ? r.income.ifd : (r.crossBorder?.swissTax ?? r.source?.annualTax ?? 0);
export const cantonalRow = (r: TaxGlobalResult): number =>
  r.income ? r.income.cantonal + r.income.communal : 0;
export const wealthRow = (r: TaxGlobalResult): number => r.income?.wealthTax ?? 0;

/** Base = situation figée ("avant"), current = formulaire en direct
 *  ("après" / résultat final de la simulation, optimisée ou non selon ce
 *  que le courtier a effectivement saisi). */
export function buildTaxGlobalCompareRows(
  base: TaxGlobalResult,
  current: TaxGlobalResult,
): TaxGlobalCompareRow[] {
  return [
    {
      id: "total",
      label: "Impôt total annuel",
      current: base.totalTaxCHF,
      projected: current.totalTaxCHF,
      betterWhen: "lower",
    },
    {
      id: "ifd",
      label: "Impôt fédéral / source CH",
      current: ifdRow(base),
      projected: ifdRow(current),
      betterWhen: "lower",
    },
    ...(cantonalRow(base) > 0 || cantonalRow(current) > 0
      ? [
          {
            id: "cantonalCommunal",
            label: "Cantonal + communal",
            current: cantonalRow(base),
            projected: cantonalRow(current),
            betterWhen: "lower" as const,
          },
        ]
      : []),
    ...(wealthRow(base) > 0 || wealthRow(current) > 0
      ? [
          {
            id: "wealth",
            label: "Impôt sur la fortune",
            current: wealthRow(base),
            projected: wealthRow(current),
            betterWhen: "lower" as const,
          },
        ]
      : []),
    ...(base.socialChargesCHF > 0 || current.socialChargesCHF > 0
      ? [
          {
            id: "health",
            label: "Charges santé (LAMal / CMU)",
            current: base.socialChargesCHF,
            projected: current.socialChargesCHF,
            betterWhen: "lower" as const,
          },
        ]
      : []),
    {
      id: "net",
      label: "Net annuel disponible",
      current: base.netAnnualCHF,
      projected: current.netAnnualCHF,
      betterWhen: "higher",
    },
    {
      id: "effectiveRate",
      label: "Taux effectif",
      current: base.effectiveRate,
      projected: current.effectiveRate,
      format: "pct",
      betterWhen: "lower",
    },
    {
      id: "marginalRate",
      label: "Taux marginal",
      current: base.marginalRate,
      projected: current.marginalRate,
      format: "pct",
      betterWhen: "lower",
    },
  ];
}
