// Calcul de sensibilités champ par champ pour le comparateur fiscal global.
//
// Méthode : pour chaque champ modifié entre la base et la situation simulée,
// on relance computeTaxGlobal en n'appliquant QUE ce champ-là sur la base.
// On obtient ainsi l'impact isolé du champ sur chaque poste fiscal
// (IFD / cantonal+communal / fortune / charges santé / net / taux).
//
// Aucun moteur n'est réécrit : on réutilise computeTaxGlobal en boîte noire.

import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput, TaxGlobalResult } from "./types";

export interface PostBreakdown {
  ifd: number;
  cantonalCommunal: number;
  wealth: number;
  health: number;
  net: number;
  total: number;
  effectiveRate: number;
  marginalRate: number;
}

export interface FieldSensitivity {
  key: keyof TaxGlobalInput;
  /** Delta par poste (Après − Avant pour ce champ seul). */
  delta: PostBreakdown;
}

function snapshotPosts(r: TaxGlobalResult): PostBreakdown {
  const ifd = r.income
    ? r.income.ifd
    : r.crossBorder?.swissTax ?? r.source?.annualTax ?? 0;
  const cantonalCommunal = r.income ? r.income.cantonal + r.income.communal : 0;
  const wealth = r.income?.wealthTax ?? 0;
  return {
    ifd,
    cantonalCommunal,
    wealth,
    health: r.socialChargesCHF,
    net: r.netAnnualCHF,
    total: r.totalTaxCHF,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function diffPosts(after: PostBreakdown, before: PostBreakdown): PostBreakdown {
  return {
    ifd: after.ifd - before.ifd,
    cantonalCommunal: after.cantonalCommunal - before.cantonalCommunal,
    wealth: after.wealth - before.wealth,
    health: after.health - before.health,
    net: after.net - before.net,
    total: after.total - before.total,
    effectiveRate: after.effectiveRate - before.effectiveRate,
    marginalRate: after.marginalRate - before.marginalRate,
  };
}

/** Renvoie la sensibilité isolée de chaque champ modifié. */
export function computeFieldSensitivities(
  baseline: TaxGlobalInput,
  current: TaxGlobalInput,
  fields: Array<keyof TaxGlobalInput>,
): FieldSensitivity[] {
  const basePosts = snapshotPosts(computeTaxGlobal(baseline));
  const out: FieldSensitivity[] = [];
  for (const key of fields) {
    if (baseline[key] === current[key]) continue;
    const isolated: TaxGlobalInput = { ...baseline, [key]: current[key] };
    const posts = snapshotPosts(computeTaxGlobal(isolated));
    out.push({ key, delta: diffPosts(posts, basePosts) });
  }
  return out;
}
