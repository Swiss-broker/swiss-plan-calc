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
        `Plusieurs simulations « ${KIND_LABELS[kind]} » sont sélectionnées pour ce dossier, mais aucune n'est marquée « Situation actuelle ». Le PDF retiendra la plus récente (${active.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0].title}) — marquez la bonne comme référence depuis l'historique des simulations si ce n'est pas celle voulue.`,
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
        `La simulation « Fiscal global » sélectionnée (${taxGlobal.title}) ne contient pas de comparatif avant/après enregistré — ouvrez-la et cliquez de nouveau sur « Sauvegarder » pour que le PDF puisse afficher le résultat avant et après optimisation.`,
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

  return warnings;
}
