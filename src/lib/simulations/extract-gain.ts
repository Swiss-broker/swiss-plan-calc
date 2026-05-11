// Extrait le gain chiffrable principal d'une simulation sauvegardée
// pour alimenter le bloc "Optimisations identifiées" de la fiche client.
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";

export type GainKind = "one_time" | "annual" | "none";

export interface ExtractedGain {
  type: GainKind;
  amount: number;
  label: string;
  details?: string;
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

function s(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v;
  return undefined;
}

export function extractGain(entry: HistoryEntry): ExtractedGain {
  const summary = (entry.summary ?? {}) as Record<string, unknown>;
  const inputs = (entry.inputs ?? {}) as Record<string, unknown>;

  switch (entry.kind) {
    case "lpp": {
      const amount = num(summary.totalTaxSavings);
      if (amount <= 0) return none();
      const cap = num(inputs.buybackCapacity);
      const years = Math.max(1, num(inputs.buybackYears));
      return {
        type: "one_time",
        amount,
        label: cap > 0 ? `Rachat LPP ${formatInt(cap)} CHF` : "Économie rachats LPP",
        details: `Économie fiscale sur ${years} an${years > 1 ? "s" : ""}`,
      };
    }
    case "pillar3a": {
      const amount = num(summary.taxSavings);
      if (amount <= 0) return none();
      const contrib = num(inputs.contribution);
      return {
        type: "annual",
        amount,
        label: contrib > 0 ? `Versement 3a ${formatInt(contrib)} CHF` : "Versement 3a",
        details: "Économie fiscale annuelle",
      };
    }
    case "canton_compare": {
      const amount = num(summary.maxSavings);
      if (amount <= 0) return none();
      const cheap = s(summary.cheapestCanton);
      const ref = s(summary.referenceCanton);
      return {
        type: "annual",
        amount,
        label: ref && cheap ? `Déménagement ${ref} → ${cheap}` : "Optimisation cantonale",
        details: "Économie annuelle si déménagement",
      };
    }
    case "retirement": {
      const annuity = num(summary.netAnnuity);
      const lump = num(summary.netLumpSum);
      const diff = Math.abs(annuity - lump);
      if (diff <= 0) return none();
      const reco = s(summary.recommendation);
      return {
        type: "one_time",
        amount: diff,
        label: "Stratégie rente vs capital",
        details: reco ? `Recommandation : ${reco}` : "Différence entre stratégies",
      };
    }
    case "investment_compare": {
      const amount = Math.abs(num(summary.netDifference));
      if (amount <= 0) return none();
      return {
        type: "one_time",
        amount,
        label: "Comparateur d'investissements",
        details: s(summary.winner) ? `Avantage : ${s(summary.winner)}` : undefined,
      };
    }
    default:
      return none();
  }
}

function none(): ExtractedGain {
  return { type: "none", amount: 0, label: "" };
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("fr-CH");
}

/**
 * Agrège les gains à partir d'une liste de simulations.
 * Pour chaque kind, on ne conserve que la simulation la plus récente.
 */
export function aggregateGains(entries: HistoryEntry[]): {
  items: Array<ExtractedGain & { entryId: string; kind: SimulationKind; createdAt: string }>;
  totalOneTime: number;
  totalAnnual: number;
} {
  // Grouper par kind, prendre la plus récente
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const seen = new Set<SimulationKind>();
  const items: Array<ExtractedGain & { entryId: string; kind: SimulationKind; createdAt: string }> = [];
  for (const e of sorted) {
    if (seen.has(e.kind)) continue;
    seen.add(e.kind);
    const g = extractGain(e);
    if (g.type === "none") continue;
    items.push({ ...g, entryId: e.id, kind: e.kind, createdAt: e.created_at });
  }
  const totalOneTime = items.filter((i) => i.type === "one_time").reduce((s, i) => s + i.amount, 0);
  const totalAnnual = items.filter((i) => i.type === "annual").reduce((s, i) => s + i.amount, 0);
  return { items, totalOneTime, totalAnnual };
}
