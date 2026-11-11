// Extrait le gain chiffrable principal d'une simulation sauvegardée
// pour alimenter le bloc "Optimisations identifiées" de la fiche client.
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";

export type GainKind = "one_time" | "annual" | "none";

// Avant ce correctif : un horizon FIXE de 10 ans pour tout le monde, quel
// que soit l'âge réel du client — un gain annuel identifié à 60 ans était
// donc compté comme si le client travaillait encore 10 ans (souvent faux),
// et un gain identifié à 30 ans ignorait les 25+ années restantes avant la
// retraite (sous-estimation massive). Les appelants (fiche client ET PDF)
// passent maintenant le nombre d'années RÉEL jusqu'à la retraite du client
// (voir ageFromDob + Math.max(1, 65 - age), même calcul que les calculateurs
// retraite/LPP/3a) ; 10 reste la valeur de repli uniquement quand l'âge du
// client est inconnu, pour ne jamais planter sur un dossier incomplet.
export const GAIN_HORIZON_YEARS_FALLBACK = 10;

export function projectGainTotal(
  oneTime: number,
  annual: number,
  yearsToRetirement: number = GAIN_HORIZON_YEARS_FALLBACK,
): number {
  return oneTime + annual * yearsToRetirement;
}

export interface ExtractedGain {
  type: GainKind;
  amount: number;
  label: string;
  details?: string;
  /** Fiscal global uniquement : scénario simulé à l'origine du gain
   *  (pillar3a_max, lpp_buyback_trial, tou…), pour ne pas compter deux fois
   *  un levier déjà chiffré par son calculateur dédié. */
  scenarioId?: string;
}

/** Scénario Fiscal global à l'origine du gain : identifiant sauvegardé, ou
 *  déduit du libellé pour les simulations enregistrées avant son ajout. */
function taxGlobalScenarioId(summary: Record<string, unknown>): string | undefined {
  const id = s(summary.bestScenarioId);
  if (id) return id;
  const label = s(summary.bestScenarioLabel) ?? "";
  if (label.startsWith("+3a max")) return "pillar3a_max";
  if (label.startsWith("+Rachat LPP")) return "lpp_buyback_trial";
  if (label.startsWith("+Don")) return "donation_5k";
  if (label.startsWith("Passage permis C")) return "permit_c";
  if (label.startsWith("Demande TOU")) return "tou";
  if (label.startsWith("Bascule")) return "health_switch";
  return undefined;
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

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
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
    case "canton_compare":
      // Volontairement exclu du bloc "Optimisations identifiées", du total
      // "Gain identifié" et des "Recommandations chiffrées" : un changement
      // de canton de domicile n'est pas un levier actionnable au même titre
      // qu'un rachat LPP ou un versement 3a (déménager pour l'impôt n'est
      // en pratique jamais la décision d'un client). Ce comparateur reste
      // disponible et chiffré sur sa propre page du dossier, à titre
      // purement indicatif.
      return none();
    case "retirement": {
      const annuity = num(summary.netAnnuity);
      const lump = num(summary.netLumpSum);
      const diff = Math.abs(annuity - lump);
      if (diff <= 0) return none();
      const reco = s(summary.recommendation);
      // Traduit le code technique en texte lisible pour le client
      const recoLabel =
        reco === "annuity" ? "la rente viagère" : reco === "lump_sum" ? "le retrait en capital" : "une solution mixte";
      return {
        type: "one_time",
        amount: diff,
        label: "Stratégie rente vs capital",
        details: reco ? `Option recommandée : ${recoLabel}` : "Différence entre stratégies",
      };
    }
    case "investment_compare": {
      const amount = Math.abs(num(summary.netDifference));
      if (amount <= 0) return none();
      const inputs = (entry.inputs ?? {}) as Record<string, unknown>;
      const a = (inputs.a ?? {}) as Record<string, unknown>;
      const b = (inputs.b ?? {}) as Record<string, unknown>;
      const winner = s(summary.winner);
      // Traduit "a"/"b" en le vrai nom de l'investissement saisi par le courtier
      const winnerName = winner === "a" ? (s(a.name) || "Investissement A") : winner === "b" ? (s(b.name) || "Investissement B") : undefined;
      return {
        type: "one_time",
        amount,
        label: "Comparateur d'investissements",
        details: winnerName ? `Option la plus avantageuse : ${winnerName}` : undefined,
      };
    }
    case "avs_ai": {
      // Volontairement exclu du bloc "Optimisations identifiées" : l'AVS ne
      // permet pas de racheter des années manquantes au-delà de 5 ans en
      // arrière (art. 16 LAVS, cf. AVS_2026.retroactiveContributionYears).
      // L'écart théorique/réel affiché ici n'était donc pas une action
      // proposable au client, contrairement aux autres gains de cette liste
      // (rachat LPP, 3a, etc.) qui sont tous de vrais leviers actionnables.
      return none();
    }
    case "vested_benefits": {
      const reco = num(summary.recommendedFinalBalance);
      const sec = num(summary.securityFinalBalance);
      const amount = Math.max(0, reco - sec);
      if (amount <= 0) return none();
      const strategyLabels: Record<string, string> = {
        security: "Sécurité",
        balanced: "Équilibré",
        dynamic: "Dynamique",
      };
      const stratRaw = s(summary.recommendedStrategy);
      const strat = (stratRaw && strategyLabels[stratRaw]) || "recommandée";
      return {
        type: "one_time",
        amount: Math.round(amount),
        label: `Optimisation libre passage (stratégie ${strat})`,
        details: "Gain projeté à la retraite, hors fiscalité au retrait",
      };
    }
    case "cross_border":
      // Le régime frontalier découle du canton de travail (accord de 1983,
      // Genève, Fribourg) : le client ne peut pas en changer. L'écart avec
      // un autre régime est un repère, pas un gain à réaliser.
      return none();
    case "tou": {
      const eligible = bool(summary.eligibleForTOU);
      const share = num(summary.swissShare);
      if (!eligible || share < 90) return none();
      const amount = num(summary.touSaving);
      if (amount <= 0) return none();
      return {
        type: "one_time",
        amount: Math.round(amount),
        label: "Bascule TOU (Taxation Ordinaire Ultérieure)",
        details: "Économie d'impôt pour l'année simulée, si la demande est déposée avant le 31 mars de l'année suivante",
      };
    }
    case "director_compensation": {
      const reco = num(summary.recommendedDirectorNet);
      const cur = num(summary.currentDirectorNet);
      const gain = num(summary.gainAnnual) || (cur > 0 ? reco - cur : 0);
      if (gain <= 0) return none();
      const strat = s(summary.recommendedLabel) ?? "optimale";
      return {
        type: "annual",
        amount: Math.round(gain),
        label: `Optimisation rémunération dirigeant (${strat})`,
        details: "Gain annuel sur revenu net",
      };
    }
    case "health_insurance_france": {
      // Un vrai gain "à saisir" suppose de savoir que le client n'est PAS
      // déjà sur la meilleure option — sans régime actuel connu, ou si le
      // client y est déjà, il n'y a rien à recommander ici (cahier des
      // charges point 5 : jamais présumer un changement non avéré).
      const current = s(summary.currentRegime);
      if (current !== "CMU" && current !== "LAMAL") return none();
      if (summary.isCurrentOptimal !== false) return none();
      const amount = num(summary.savingsCHF);
      if (amount <= 0) return none();
      const alternativeLabel = current === "CMU" ? "LAMal" : "CMU";
      return {
        type: "annual",
        amount: Math.round(amount),
        label: `Droit d'option santé : passage à ${alternativeLabel}`,
        details: `Économie annuelle vs ${current === "CMU" ? "CMU" : "LAMal"} actuel`,
      };
    }
    case "health_insurance_resident": {
      const amount = num(summary.annualSavingsCHF);
      if (amount <= 0) return none();
      return {
        type: "annual",
        amount: Math.round(amount),
        label: "Optimisation caisse maladie",
        details: "Économie annuelle vs situation actuelle",
      };
    }
    case "overtime": {
      const amount = num(summary.taxSavings);
      if (amount <= 0) return none();
      return {
        type: "annual",
        amount: Math.round(amount),
        label: "Heures sup · exonération France",
        details: "Économie fiscale annuelle (régime frontalier 1983)",
      };
    }
    case "tax_global": {
      const amount = num(summary.bestScenarioSavings);
      if (amount <= 0) return none();
      const label = s(summary.bestScenarioLabel) ?? "Optimisation fiscale globale";
      const scenarioId = taxGlobalScenarioId(summary);
      // Un don (on dépense plus qu'on n'économise), un changement de permis
      // ou la bascule CMU/LAMal (chiffrée par son propre calculateur) ne
      // sont pas des économies d'impôt à additionner.
      if (scenarioId === "donation_5k" || scenarioId === "permit_c" || scenarioId === "health_switch") {
        return none();
      }
      if (scenarioId === "lpp_buyback_trial") {
        // Un rachat LPP se déduit l'année du versement : économie ponctuelle,
        // pas un gain qui se répète chaque année jusqu'à la retraite.
        return {
          type: "one_time",
          amount: Math.round(amount),
          label,
          details: "Économie fiscale l'année du rachat (scénario simulé)",
          scenarioId,
        };
      }
      return {
        type: "annual",
        amount: Math.round(amount),
        label,
        details: "Économie fiscale annuelle (meilleur scénario simulé)",
        scenarioId,
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

export type GainItem = ExtractedGain & { entryId: string; kind: SimulationKind; createdAt: string };

/** Calculateur dédié qui chiffre déjà le même levier qu'un scénario de
 *  Fiscal global. */
const DEDICATED_KIND_BY_SCENARIO: Record<string, SimulationKind> = {
  pillar3a_max: "pillar3a",
  lpp_buyback_trial: "lpp",
};

/**
 * true si le gain de cette simulation Fiscal global porte sur un levier
 * (3e pilier A, rachat LPP) déjà chiffré par son calculateur dédié parmi
 * `peers` (les simulations retenues pour le même total) : l'additionner
 * compterait deux fois la même économie d'impôt.
 */
export function isRedundantGain(
  entry: HistoryEntry,
  gain: ExtractedGain,
  peers: HistoryEntry[],
): boolean {
  if (entry.kind !== "tax_global" || !gain.scenarioId) return false;
  const dedicated = DEDICATED_KIND_BY_SCENARIO[gain.scenarioId];
  if (!dedicated) return false;
  return peers.some((p) => p.kind === dedicated && extractGain(p).type !== "none");
}

/**
 * Pour chaque kind présent, la simulation la plus récente (toutes dates
 * confondues, archivée ou non) — un seul candidat par kind. Utilisé par
 * selectGains ci-dessous.
 */
function latestPerKind(entries: HistoryEntry[]): Map<SimulationKind, HistoryEntry> {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = new Map<SimulationKind, HistoryEntry>();
  for (const e of sorted) {
    if (!latest.has(e.kind)) latest.set(e.kind, e);
  }
  return latest;
}

/**
 * Sélectionne, pour chaque kind, la simulation la plus récente qui satisfait
 * `wantDismissed` (true = uniquement les gains archivés, false = uniquement
 * les actifs). Un kind dont la dernière simulation est archivée ne "retombe"
 * pas sur une simulation plus ancienne : archiver un gain vaut pour ce kind
 * tant qu'aucune nouvelle simulation n'est sauvegardée.
 */
function selectGains(entries: HistoryEntry[], wantDismissed: boolean): GainItem[] {
  const items: GainItem[] = [];
  const candidates = [...latestPerKind(entries).values()].filter(
    (e) => Boolean(e.gain_dismissed) === wantDismissed,
  );
  for (const e of candidates) {
    const g = extractGain(e);
    if (g.type === "none") continue;
    if (isRedundantGain(e, g, candidates)) continue;
    items.push({ ...g, entryId: e.id, kind: e.kind, createdAt: e.created_at });
  }
  return items;
}

/**
 * Simulation la plus récente d'un kind donné, parmi celles qui ne sont PAS
 * archivées (gain_dismissed) — une éventuelle simulation archivée plus
 * récente du même kind n'empêche pas de retomber sur une plus ancienne
 * encore active. Si aucune simulation active de ce kind n'existe, retourne
 * undefined.
 *
 * Volontairement distinct de selectGains (qui ne regarde que la toute
 * dernière simulation, dismissed ou non, et ne retombe jamais sur une plus
 * ancienne) : "Recommandations chiffrées" et "Gain total identifié" dans ce
 * PDF (computeTotals / drawConclusionPage, plus bas) ne passent pas par
 * selectGains — ils retiennent simplement toute simulation active, sans
 * dédoublonnage par kind. pickLatestNonDismissed reproduit ce même critère
 * ("active" = non archivée) en ne gardant que la plus récente pour donner
 * une ligne unique par catégorie dans "Résumé par catégorie" et "Synthèse
 * globale", qui doivent donc afficher la même simulation que ces deux
 * sections.
 */
export function pickLatestNonDismissed(entries: HistoryEntry[], kind: SimulationKind): HistoryEntry | undefined {
  let best: HistoryEntry | undefined;
  for (const e of entries) {
    if (e.kind !== kind || e.gain_dismissed) continue;
    if (!best || new Date(e.created_at).getTime() > new Date(best.created_at).getTime()) best = e;
  }
  return best;
}

/**
 * Agrège les gains actifs (non archivés) à partir d'une liste de simulations.
 * Pour chaque kind, on ne conserve que la simulation la plus récente.
 *
 * @param yearsToRetirement Nombre d'années réel jusqu'à la retraite du
 *   client (ex. Math.max(1, 65 - age), voir ageFromDob) — utilisé pour
 *   cumuler les gains annuels (3a, droit d'option santé, etc.) sur TOUTE la
 *   vie active restante, pas sur un horizon fixe arbitraire.
 */
export function aggregateGains(
  entries: HistoryEntry[],
  yearsToRetirement: number = GAIN_HORIZON_YEARS_FALLBACK,
): {
  items: GainItem[];
  totalOneTime: number;
  totalAnnual: number;
  yearsToRetirement: number;
  /** Gains cumulés PENDANT la vie active : tous les gains annuels × années
   *  restantes jusqu'à la retraite, + tous les gains ponctuels SAUF celui du
   *  calculateur "Rente vs capital" (voir postRetirementGain ci-dessous). */
  preRetirementTotal: number;
  /** Gain du calculateur "Rente vs capital" (différence rente/capital) —
   *  déjà un cumul sur l'espérance de vie résiduelle réglée dans CE
   *  calculateur (ex. 20 ans), jamais mélangé aux gains "pendant la vie
   *  active" : ce sont deux périodes de la vie du client, pas la même chose. */
  postRetirementGain: number;
  /** Somme des deux ci-dessus, pour une vue d'ensemble globale. */
  totalProjected: number;
} {
  const items = selectGains(entries, false);
  const totalOneTime = items.filter((i) => i.type === "one_time").reduce((s, i) => s + i.amount, 0);
  const totalAnnual = items.filter((i) => i.type === "annual").reduce((s, i) => s + i.amount, 0);
  const postRetirementGain = items.find((i) => i.kind === "retirement")?.amount ?? 0;
  const preRetirementOneTime = totalOneTime - postRetirementGain;
  // Même formule que "Gain total identifié" dans le PDF (computeTotals +
  // drawGainHighlight) : sans ça, la fiche client et le PDF affichaient deux
  // totaux différents pour la même notion ("gain identifié").
  const preRetirementTotal = projectGainTotal(preRetirementOneTime, totalAnnual, yearsToRetirement);
  const totalProjected = preRetirementTotal + postRetirementGain;
  return {
    items,
    totalOneTime,
    totalAnnual,
    yearsToRetirement,
    preRetirementTotal,
    postRetirementGain,
    totalProjected,
  };
}

/** Gains archivés (masqués de la synthèse), pour l'affichage "Restaurer". */
export function listDismissedGains(entries: HistoryEntry[]): GainItem[] {
  return selectGains(entries, true);
}
