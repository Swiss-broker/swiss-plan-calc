// Contrôle de cohérence avant génération du PDF de synthèse (audit point 9).
//
// Depuis le refactor "source de données unique" (pension-consolidation,
// canton-compare, rente vs capital), la plupart des chiffres ne PEUVENT plus
// diverger entre les pages du même PDF : ils viennent tous de la même
// sélection (pickLatestNonDismissed / pickConsolidationReferences) sur la
// liste de simulations incluses. Ce module vérifie les cas qui restent
// possibles malgré ça — sélection ambiguë par le courtier, ou simulation
// sauvegardée avant la mise à jour de l'outil — et retourne des messages
// d'alerte à afficher avant de générer le PDF.
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";
import { KIND_LABELS } from "@/lib/history/types";
import { pickLatestNonDismissed } from "@/lib/simulations/extract-gain";
import { pickConsolidationReferences } from "@/lib/pension-consolidation";

const PENSION_KINDS: SimulationKind[] = ["avs_ai", "lpp", "pillar3a"];

export function checkSynthesisConsistency(entries: HistoryEntry[]): string[] {
  const warnings: string[] = [];

  // 1. Plusieurs simulations actives du même pilier sélectionnées, sans
  // qu'aucune ne soit marquée "Situation actuelle" : le PDF retient quand
  // même la plus récente (pickLatestNonDismissed), mais ce n'est peut-être
  // pas celle que le courtier avait en tête.
  for (const kind of PENSION_KINDS) {
    const active = entries.filter((e) => e.kind === kind && !e.gain_dismissed);
    if (active.length >= 2 && !active.some((e) => e.is_baseline)) {
      warnings.push(
        `Plusieurs simulations « ${KIND_LABELS[kind]} » sont sélectionnées pour ce dossier, mais aucune n'est marquée « Situation actuelle ». Le PDF retiendra la plus récente (${active.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0].title}). Marquez la bonne comme référence depuis l'historique des simulations si ce n'est pas celle voulue.`,
      );
    }
  }

  // 2. Fiscal global sauvegardé avant la mise à jour de l'outil (pas de
  // comparatif avant/après enregistré) : le PDF n'affichera que le résultat
  // courant, sans référence "avant optimisation".
  const taxGlobal = pickLatestNonDismissed(entries, "tax_global");
  if (taxGlobal) {
    const rows = (taxGlobal.summary as Record<string, unknown> | undefined)?.compareRows;
    if (!Array.isArray(rows) || rows.length === 0) {
      warnings.push(
        `La simulation « Fiscal global » sélectionnée (${taxGlobal.title}) ne contient pas de comparatif avant/après enregistré. Ouvrez-la et cliquez de nouveau sur « Sauvegarder » pour que le PDF puisse afficher le résultat avant et après optimisation.`,
      );
    }
  }

  // 3. Comparateur cantonal (mode capital) : le capital LPP+3a utilisé doit
  // provenir de la même simulation LPP/3a que celle retenue pour
  // "Prestations consolidées" — sinon deux pages du même PDF afficheraient
  // deux capitaux différents pour le même pilier.
  const cantonCompare = pickLatestNonDismissed(entries, "canton_compare");
  if (cantonCompare) {
    const ccSummary = cantonCompare.summary as Record<string, unknown> | undefined;
    const lumpSumCapital = Number(ccSummary?.lumpSumProjectedCapital ?? 0);
    if (lumpSumCapital > 0) {
      const refs = pickConsolidationReferences(entries);
      const lppRefBalance = Number(
        (refs.lpp?.summary as Record<string, unknown> | undefined)?.projectedBalance ?? 0,
      );
      const p3aRefBalance = Number(
        (refs.pillar3a?.summary as Record<string, unknown> | undefined)?.finalBalance ?? 0,
      );
      const expected = lppRefBalance + p3aRefBalance;
      if (expected > 0 && Math.abs(expected - lumpSumCapital) > 1) {
        warnings.push(
          `Le Comparateur cantonal (${cantonCompare.title}) utilise un capital LPP + 3e pilier de ${lumpSumCapital.toLocaleString("fr-CH")} CHF, différent de celui des simulations LPP/3a actuellement retenues pour ce dossier (${expected.toLocaleString("fr-CH")} CHF). Vérifiez laquelle est à jour avant de générer le PDF.`,
        );
      }
    }
  }

  // 4. Budget potentiellement obsolète : une autre simulation sélectionnée
  // pour ce dossier est plus récente que la dernière sauvegarde Budget
  // retenue. Le budget optimisé affiché dans ce PDF reste celui figé au
  // moment de cette sauvegarde, donc n'inclut pas forcément les gains des
  // simulations faites depuis (cahier des charges point 9a) — rouvrir puis
  // ressauvegarder Budget suffit à le remettre à jour (salaire net et
  // optimisations s'y recalculent automatiquement, voir toBudgetInput /
  // computeBudget).
  const budget = pickLatestNonDismissed(entries, "budget");
  if (budget) {
    const budgetDate = new Date(budget.created_at).getTime();
    const isNewerThanBudget = (e: HistoryEntry) =>
      e.kind !== "budget" && !e.gain_dismissed && new Date(e.created_at).getTime() > budgetDate;
    const newer = entries.filter(isNewerThanBudget);
    if (newer.length > 0) {
      const newerLabel =
        newer.length === 1 ? `« ${KIND_LABELS[newer[0].kind]} »` : "plusieurs autres simulations";
      warnings.push(
        `La simulation « Budget » sélectionnée (${budget.title}) a été sauvegardée avant ${newerLabel} de ce dossier. Son budget optimisé risque de ne pas inclure ce(s) gain(s). Rouvrez puis ressauvegardez Budget avant de générer ce dossier.`,
      );
    }
  }

  return warnings;
}
