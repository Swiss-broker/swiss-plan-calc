// Test de non-régression : cohérence inter-sections du PDF de synthèse.
//
// Contexte : plusieurs bugs corrigés dans ce chantier ("zéro bug PDF")
// avaient la même signature — une même simulation affichait des chiffres
// différents selon la section du PDF où on la lisait (page 3 "Résumé par
// catégorie", page de détail, "Synthèse globale", "Recommandations
// chiffrées") parce que chaque section recalculait ou relisait la valeur
// à sa manière plutôt que de partager une source unique. Ce fichier fige,
// pour chaque indicateur concerné, l'invariant "toutes les sections qui
// affichent cet indicateur doivent afficher EXACTEMENT le même nombre" —
// avec une fixture aux montants tous distincts, pour qu'un mélange entre
// deux indicateurs (ex: cotisations vs capital) ou une mauvaise base de
// calcul (ex: ÷100 en trop) saute immédiatement aux yeux dans le message
// d'échec plutôt que de se noyer dans des montants qui se ressemblent.
//
// IMPORTANT — limite assumée de ce test : les sondes ("probes") ci-dessous
// pour "Synthèse globale" / "Résumé page 3" sont des transcriptions
// fidèles du code réel de drawComparisonPage / drawOverviewPage dans
// synthesis-report.ts (ces fonctions dessinent directement dans un
// contexte jsPDF et ne sont pas exportées, cf. rapport de diagnostic).
// Si ce code change de logique un jour, LES SONDES CI-DESSOUS DOIVENT
// ÊTRE MISES À JOUR EN PARALLÈLE, sinon ce test perd sa valeur de
// garde-fou (il resterait vert alors que le vrai PDF a changé). C'est un
// compromis accepté plutôt qu'un export des fonctions de dessin
// elles-mêmes (hors périmètre demandé). Chaque probe cite la ligne du
// code qu'elle reproduit.

import { describe, expect, it } from "vitest";
import { formatCHF, formatPct } from "@/lib/format";
import type { HistoryEntry, SimulationKind } from "@/lib/history/types";
import { extractGain, pickLatestNonDismissed } from "@/lib/simulations/extract-gain";
import {
  buildDerivedComparison,
  cantonCompareSummaryRow,
  computeTotals,
  describeCompareFigures,
  extractSavedCompareRows,
  formatDelta,
  formatMetrics,
} from "./synthesis-report";

// ============================================================================
// FIXTURE — un HistoryEntry synthétique par kind actif (les 12 calculateurs
// proposés depuis la page d'accueil des calculateurs, hors kinds hérités
// income_tax/source_tax/cross_border/tou qui ne sont plus proposés à la
// sauvegarde mais restent affichables pour d'anciens dossiers). Montants
// tous distincts et arrondis pour qu'une divergence soit immédiatement
// identifiable dans le message d'échec (pas de coïncidence possible entre
// deux indicateurs différents).
// ============================================================================
function makeEntry(kind: SimulationKind, summary: Record<string, unknown>, inputs: Record<string, unknown> = {}): HistoryEntry {
  return {
    id: `fixture-${kind}`,
    broker_id: "broker-fixture",
    client_id: "client-fixture",
    kind,
    title: `Fixture ${kind}`,
    note: null,
    inputs,
    summary,
    tags: [],
    is_baseline: false,
    gain_dismissed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const FIXTURE_ENTRIES: HistoryEntry[] = [
  makeEntry("lpp", {
    projectedBalance: 415_000,
    totalTaxSavings: 8_200,
    annualPension: 24_000,
    monthlyPension: 2_000,
    totalBuybacks: 45_000,
    compareRows: [
      { label: "Capital LPP projeté à la retraite", current: 333_000, projected: 415_000, betterWhen: "higher" },
      { label: "Rachats cumulés", current: 0, projected: 45_000, betterWhen: "higher" },
    ],
  }),
  makeEntry("pillar3a", {
    taxSavings: 1_234,
    finalBalance: 91_234,
    effectiveCost: 987,
    marginalRate: 18.5,
    totalContributions: 45_000,
    compareRows: [
      { label: "Cotisation annuelle 3a", current: 2_400, projected: 7_258, betterWhen: "higher" },
      { label: "Capital 3a à la retraite (20 ans)", current: 55_555, projected: 66_666, betterWhen: "higher" },
    ],
  }),
  makeEntry("canton_compare", {
    referenceTax: 12_000,
    cheapestTax: 3_000,
    maxSavings: 9_000, // = referenceTax − cheapestTax, par construction
    cheapestCanton: "ZG",
    referenceCanton: "VD",
  }),
  makeEntry("director_compensation", {
    currentDirectorNet: 70_000,
    recommendedDirectorNet: 95_000,
    gainAnnual: 25_000, // = recommendedDirectorNet − currentDirectorNet, par construction
    recommendedLabel: "30/70",
    recommendedTotalCharges: 40_000,
  }),
  makeEntry("tax_global", {
    totalTaxCHF: 15_000,
    netAnnualCHF: 60_000,
    effectiveRate: 18.5,
    marginalRate: 27,
    regimeLabel: "Résident",
    bestScenarioSavings: 1_500,
    bestScenarioLabel: "+3a max",
  }),
  makeEntry("retirement", {
    netAnnuity: 280_000,
    netLumpSum: 320_000,
    lumpTaxTotal: 15_000,
    recommendation: "lump_sum",
  }),
  makeEntry("vested_benefits", {
    securityFinalBalance: 120_000,
    recommendedFinalBalance: 180_000,
    recommendedStrategy: "dynamic",
  }),
  makeEntry("avs_ai", {
    annualPension: 28_000,
    monthlyPension: 2_333,
    missingYears: 2,
  }),
  makeEntry(
    "investment_compare",
    { aFinalNet: 100_000, bFinalNet: 145_000, netDifference: 45_000, pctAdvantage: 45, winner: "b" },
    { a: { name: "Fonds A" }, b: { name: "Fonds B" } },
  ),
  makeEntry("health_insurance_france", {
    recommended: "CMU",
    recommendedAnnualCHF: 3_200,
    savingsCHF: 800,
    cmuAnnualCHF: 3_200,
    lamalAnnualCHF: 4_000,
  }),
  makeEntry("overtime", {
    netOvertimeCHF: 5_000,
    taxSavings: 900,
    totalTaxOnOvertime: 100,
    overtimeCHF: 6_000,
  }),
  makeEntry("fx_claim", {
    totalChfAfc: 20_000,
    totalChfMarket: 20_700,
    totalDeltaChf: 700,
    estimatedTaxRefund: 300,
  }),
];

const FIXTURE_BY_KIND = new Map(FIXTURE_ENTRIES.map((e) => [e.kind, e]));
function fixture(kind: SimulationKind): HistoryEntry {
  const e = FIXTURE_BY_KIND.get(kind);
  if (!e) throw new Error(`Pas de fixture pour le kind "${kind}"`);
  return e;
}

// ============================================================================
// Helpers de lecture — mêmes fonctions que celles utilisées par le PDF, pas
// de recalcul indépendant.
// ============================================================================
function metricValue(entry: HistoryEntry, label: string): number {
  const metrics = formatMetrics(entry);
  const m = metrics.find((x) => x.label === label);
  if (!m) {
    throw new Error(
      `Aucune métrique "${label}" pour ${entry.kind} (labels disponibles : ${metrics.map((x) => x.label).join(", ") || "aucun"}).`,
    );
  }
  if (typeof m.value !== "number") {
    throw new Error(`Métrique "${label}" de ${entry.kind} n'est pas numérique (valeur : ${JSON.stringify(m.value)}).`);
  }
  return m.value;
}
function findCompareRow(entry: HistoryEntry, labelPrefix: string) {
  const row = extractSavedCompareRows(entry).rows.find((r) => r.label.startsWith(labelPrefix));
  if (!row) {
    throw new Error(
      `Aucune ligne "${labelPrefix}…" dans compareRows pour ${entry.kind} (labels : ${extractSavedCompareRows(entry).rows.map((r) => r.label).join(", ")}).`,
    );
  }
  return row;
}

// ============================================================================
// CONSISTENCY_RULES — table déclarative : pour chaque indicateur affiché
// dans plusieurs sections du PDF, une sonde par section. Le test vérifie
// que toutes les sondes d'une même règle renvoient EXACTEMENT le même
// nombre.
// ============================================================================
interface ConsistencyProbe {
  section: string;
  value: (entry: HistoryEntry, all: HistoryEntry[]) => number;
}
interface ConsistencyRule {
  kind: SimulationKind;
  indicator: string;
  probes: ConsistencyProbe[];
}

const CONSISTENCY_RULES: ConsistencyRule[] = [
  // ── canton_compare ─────────────────────────────────────────────────────
  // Bug historique (commit d776f95) : la page 3 et describeCompareFigures
  // affichaient le comparatif secondaire "vs Zoug" (compareRows) tandis que
  // la Synthèse globale affichait le comparatif "canton le moins cher de
  // Suisse romande" (referenceTax/cheapestTax) — deux écarts différents
  // pour la même ligne "Comparateur cantonal". cantonCompareSummaryRow a
  // été introduit pour que page 3 et describeCompareFigures utilisent
  // désormais la même base que la Synthèse globale.
  {
    kind: "canton_compare",
    indicator: "Charge fiscale actuelle (canton de référence)",
    probes: [
      // Résumé page 3 : drawOverviewPage → cantonCompareSummaryRow(e).current
      { section: "Résumé page 3 (cantonCompareSummaryRow)", value: (e) => cantonCompareSummaryRow(e)!.current as number },
      // Synthèse globale : drawComparisonPage → num(cc.summary?.referenceTax)
      { section: "Synthèse globale (referenceTax)", value: (e) => Number(e.summary.referenceTax) },
      // Détail · Résultats clés : formatMetrics → "Charge fiscale actuelle"
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Charge fiscale actuelle") },
    ],
  },
  {
    kind: "canton_compare",
    indicator: "Charge fiscale la plus basse (canton optimisé)",
    probes: [
      { section: "Résumé page 3 (cantonCompareSummaryRow)", value: (e) => cantonCompareSummaryRow(e)!.projected as number },
      { section: "Synthèse globale (cheapestTax)", value: (e) => Number(e.summary.cheapestTax) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Charge fiscale la plus basse") },
    ],
  },
  {
    kind: "canton_compare",
    indicator: "Économie identifiée (maxSavings vs écart réel)",
    probes: [
      // Recommandations chiffrées / Gain total : extractGain → summary.maxSavings
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Économie max annuelle") },
      {
        section: "Écart réel (référence − moins cher, cantonCompareSummaryRow)",
        value: (e) => {
          const r = cantonCompareSummaryRow(e)!;
          return (r.current as number) - (r.projected as number);
        },
      },
    ],
  },

  // ── pillar3a ───────────────────────────────────────────────────────────
  // Bug historique (commit d776f95) : la Synthèse globale comparait les
  // cotisations versées (totalContributions) au capital actuel NON
  // optimisé (finalBalance) — deux métriques sans rapport avec le delta
  // "Capital 3a à la retraite" affiché sur la page de détail. Corrigé pour
  // relire la même ligne de compareRows que le détail.
  {
    kind: "pillar3a",
    indicator: "Capital 3a actuel — avant optimisation",
    probes: [
      // Détail · Actuel vs Projeté : drawSimulationPage → toutes les lignes de compareRows
      { section: "Détail · Actuel vs Projeté (compareRows complet)", value: (e) => findCompareRow(e, "Capital 3a à la retraite").current as number },
      // Synthèse globale : drawComparisonPage → rows.find(label.startsWith("Capital 3a à la retraite"))
      {
        section: "Synthèse globale (find par préfixe de libellé)",
        value: (e) => extractSavedCompareRows(e).rows.find((r) => r.label.startsWith("Capital 3a à la retraite"))!.current as number,
      },
    ],
  },
  {
    kind: "pillar3a",
    indicator: "Capital 3a optimisé — après optimisation",
    probes: [
      { section: "Détail · Actuel vs Projeté (compareRows complet)", value: (e) => findCompareRow(e, "Capital 3a à la retraite").projected as number },
      {
        section: "Synthèse globale (find par préfixe de libellé)",
        value: (e) => extractSavedCompareRows(e).rows.find((r) => r.label.startsWith("Capital 3a à la retraite"))!.projected as number,
      },
    ],
  },

  // ── lpp ────────────────────────────────────────────────────────────────
  // Risque analogue à pillar3a : page 3 (générique, rows[0]) et Synthèse
  // globale (find par libellé exact) lisent le même compareRows par deux
  // chemins différents — un futur ajout de ligne avant "Capital LPP
  // projeté à la retraite" romprait le rows[0] de la page 3 sans toucher
  // au find() de la Synthèse globale.
  {
    kind: "lpp",
    indicator: "Capital LPP actuel — sans rachat",
    probes: [
      // Résumé page 3 : drawOverviewPage, chemin générique → rows[0]
      { section: "Résumé page 3 (rows[0] générique)", value: (e) => extractSavedCompareRows(e).rows[0].current as number },
      // Synthèse globale : drawComparisonPage → find(label === "Capital LPP projeté à la retraite")
      {
        section: "Synthèse globale (find par libellé exact)",
        value: (e) => extractSavedCompareRows(e).rows.find((r) => r.label === "Capital LPP projeté à la retraite")!.current as number,
      },
    ],
  },
  {
    kind: "lpp",
    indicator: "Capital LPP projeté — avec rachat",
    probes: [
      { section: "Résumé page 3 (rows[0] générique)", value: (e) => extractSavedCompareRows(e).rows[0].projected as number },
      // Synthèse globale : drawComparisonPage → num(lpp.summary?.projectedBalance)
      { section: "Synthèse globale (summary.projectedBalance)", value: (e) => Number(e.summary.projectedBalance) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Capital projeté") },
    ],
  },
  {
    kind: "lpp",
    indicator: "Économie fiscale rachats",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Économie fiscale rachats") },
    ],
  },

  // ── director_compensation ────────────────────────────────────────────
  // Bug corrigé cette session : gainAnnual pouvait diverger de
  // recommendedDirectorNet − currentDirectorNet (delta négatif clampé à 0
  // par Math.max(0, …) côté calculateur) — la Synthèse globale affichait
  // alors un écart réel négatif tandis que les Recommandations n'affichaient
  // rien. Cette règle fige l'invariant directement sur la donnée
  // sauvegardée : si un futur enregistrement viole encore cette égalité,
  // le test le détecte sans dépendre du calculateur qui l'a produit.
  {
    kind: "director_compensation",
    indicator: "Net dirigeant actuel",
    probes: [
      { section: "Résumé page 3 (buildDerivedComparison)", value: (e) => buildDerivedComparison(e)!.rows[0].current as number },
      { section: "Synthèse globale (currentDirectorNet)", value: (e) => Number(e.summary.currentDirectorNet) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Net dirigeant actuel") },
    ],
  },
  {
    kind: "director_compensation",
    indicator: "Net dirigeant recommandé",
    probes: [
      { section: "Résumé page 3 (buildDerivedComparison)", value: (e) => buildDerivedComparison(e)!.rows[0].projected as number },
      { section: "Synthèse globale (recommendedDirectorNet)", value: (e) => Number(e.summary.recommendedDirectorNet) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Net dirigeant optimisé") },
    ],
  },
  {
    kind: "director_compensation",
    indicator: "Gain annuel (gainAnnual vs écart réel recommandé − actuel)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics, gainAnnual)", value: (e) => metricValue(e, "Gain annuel") },
      {
        section: "Écart réel (recommendedDirectorNet − currentDirectorNet)",
        value: (e) => Number(e.summary.recommendedDirectorNet) - Number(e.summary.currentDirectorNet),
      },
    ],
  },

  // ── tax_global ─────────────────────────────────────────────────────────
  // Bug corrigé cette session : bestScenarioSavings/bestScenarioLabel
  // n'étaient jamais écrits, donc toujours 0 → aucune section ne pouvait
  // afficher "Fiscal global" en Recommandations/Synthèse. Les trois lectures
  // ci-dessous passent toutes par extractGain/computeTotals : elles restent
  // consistantes PAR CONSTRUCTION tant que personne ne spécialise l'une
  // sans l'autre — cette règle verrouille cet état.
  {
    kind: "tax_global",
    indicator: "Meilleur scénario d'optimisation (bestScenarioSavings)",
    probes: [
      { section: "Recommandations chiffrées (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Synthèse globale · gains agrégés (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Gain total identifié (computeTotals)", value: (e) => computeTotals([e]).annual },
    ],
  },

  // ── retirement ─────────────────────────────────────────────────────────
  {
    kind: "retirement",
    indicator: "Rente viagère nette",
    probes: [
      { section: "Synthèse globale (netAnnuity)", value: (e) => Number(e.summary.netAnnuity) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Net rente") },
    ],
  },
  {
    kind: "retirement",
    indicator: "Capital net (retrait)",
    probes: [
      { section: "Synthèse globale (netLumpSum)", value: (e) => Number(e.summary.netLumpSum) },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Net capital") },
    ],
  },
  {
    kind: "retirement",
    indicator: "Écart rente vs capital (gain identifié)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      {
        section: "Écart réel (|netLumpSum − netAnnuity|)",
        value: (e) => Math.abs(Number(e.summary.netLumpSum) - Number(e.summary.netAnnuity)),
      },
    ],
  },

  // ── vested_benefits ────────────────────────────────────────────────────
  {
    kind: "vested_benefits",
    indicator: "Capital de libre passage — stratégie sécurité",
    probes: [
      { section: "Résumé page 3 / Détail (buildDerivedComparison)", value: (e) => buildDerivedComparison(e)!.rows[0].current as number },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Capital projeté (sécurité)") },
    ],
  },
  {
    kind: "vested_benefits",
    indicator: "Capital de libre passage — stratégie recommandée",
    probes: [
      { section: "Résumé page 3 / Détail (buildDerivedComparison)", value: (e) => buildDerivedComparison(e)!.rows[0].projected as number },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Capital projeté (recommandé)") },
    ],
  },
  {
    kind: "vested_benefits",
    indicator: "Gain projeté (recommandée − sécurité)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      {
        section: "Écart réel (recommendedFinalBalance − securityFinalBalance)",
        value: (e) => Number(e.summary.recommendedFinalBalance) - Number(e.summary.securityFinalBalance),
      },
    ],
  },

  // ── investment_compare / health_insurance_france / overtime / fx_claim ─
  // Ces 4 kinds n'ont pas de ligne dédiée dans "Résumé par catégorie" ni de
  // buildDerivedComparison (pas de compareRows sauvegardé) : leur seule
  // section chiffrée hors détail est le bloc générique "Tous gains
  // agrégés" de la Synthèse globale et les Recommandations/Gain total, qui
  // appellent tous deux extractGain(e) directement sur le MÊME champ que
  // formatMetrics affiche sur la page de détail. Risque réel : un
  // renommage de champ mis à jour d'un côté (formatMetrics) mais pas de
  // l'autre (extractGain), ou l'inverse.
  {
    kind: "investment_compare",
    indicator: "Différence nette (gain identifié)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Différence nette") },
    ],
  },
  {
    kind: "health_insurance_france",
    indicator: "Économie annuelle (savingsCHF)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Économie vs autre option") },
    ],
  },
  {
    kind: "overtime",
    indicator: "Économie fiscale annuelle (taxSavings)",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Économie fiscale (exonération FR)") },
    ],
  },
  {
    kind: "fx_claim",
    indicator: "Économie d'impôt estimée",
    probes: [
      { section: "Recommandations / Gain total (extractGain)", value: (e) => extractGain(e).amount },
      { section: "Détail · Résultats clés (formatMetrics)", value: (e) => metricValue(e, "Économie d'impôt estimée") },
    ],
  },

  // ── avs_ai ─────────────────────────────────────────────────────────────
  // Volontairement absent de cette table : extractGain retourne toujours
  // "none" pour avs_ai (l'AVS ne permet pas de racheter des années
  // manquantes au-delà de 5 ans en arrière, voir extract-gain.ts), et ce
  // kind n'a ni compareRows ni buildDerivedComparison → sa seule apparition
  // chiffrée dans tout le PDF est la page de détail (formatMetrics). Une
  // seule vue = aucune incohérence inter-sections possible par construction.
];

describe("Cohérence inter-sections du PDF de synthèse (CONSISTENCY_RULES)", () => {
  for (const rule of CONSISTENCY_RULES) {
    it(`${rule.kind} — ${rule.indicator}`, () => {
      const entry = fixture(rule.kind);
      const results = rule.probes.map((p) => ({ section: p.section, value: p.value(entry, FIXTURE_ENTRIES) }));
      const reference = results[0];
      const mismatches = results
        .slice(1)
        .filter((r) => r.value !== reference.value)
        .map((r) => `  - "${r.section}" = ${r.value}  (écart de ${r.value - reference.value} vs "${reference.section}" = ${reference.value})`);

      if (mismatches.length > 0) {
        const detail = results.map((r) => `  - "${r.section}" = ${r.value}`).join("\n");
        throw new Error(
          `Incohérence détectée pour ${rule.kind} / "${rule.indicator}" :\n${detail}\n\nDivergences :\n${mismatches.join("\n")}`,
        );
      }
      expect(mismatches).toHaveLength(0);
    });
  }

  it("couvre bien les 4 kinds corrigés cette session (canton_compare, pillar3a, director_compensation, tax_global)", () => {
    const covered = new Set(CONSISTENCY_RULES.map((r) => r.kind));
    for (const k of ["canton_compare", "pillar3a", "director_compensation", "tax_global"] as SimulationKind[]) {
      expect(covered.has(k)).toBe(true);
    }
  });
});

// ============================================================================
// pickLatestNonDismissed — régression directe du chantier gain_dismissed :
// une simulation archivée plus récente ne doit jamais masquer une
// simulation active plus ancienne du même kind, et un kind entièrement
// archivé ne doit renvoyer aucune simulation (pas de repli).
// ============================================================================
describe("pickLatestNonDismissed — cohérence avec gain_dismissed", () => {
  it("retombe sur la simulation active la plus ancienne quand la plus récente du même kind est archivée", () => {
    const older = { ...fixture("canton_compare"), id: "cc-old", created_at: "2026-01-01T00:00:00Z", gain_dismissed: false };
    const newer = {
      ...fixture("canton_compare"),
      id: "cc-new",
      created_at: "2026-06-01T00:00:00Z",
      gain_dismissed: true,
      summary: { ...fixture("canton_compare").summary, maxSavings: 999_999 },
    };
    const picked = pickLatestNonDismissed([older, newer], "canton_compare");
    expect(picked?.id).toBe("cc-old");
  });

  it("ne renvoie rien si toutes les simulations du kind sont archivées (pas de ligne fantôme en page 3 / Synthèse globale)", () => {
    const onlyDismissed = { ...fixture("director_compensation"), gain_dismissed: true };
    expect(pickLatestNonDismissed([onlyDismissed], "director_compensation")).toBeUndefined();
  });

  it("reste cohérent avec la sélection utilisée par les Recommandations chiffrées (une seule simulation active par kind)", () => {
    const active = fixture("director_compensation");
    const dismissedOther = {
      ...fixture("director_compensation"),
      id: "dc-dismissed",
      created_at: "2026-09-01T00:00:00Z",
      gain_dismissed: true,
      summary: { ...fixture("director_compensation").summary, gainAnnual: 1 },
    };
    const all = [active, dismissedOther];
    const picked = pickLatestNonDismissed(all, "director_compensation");
    // Recommandations chiffrées / Gain total : entries.filter(!gain_dismissed) → une seule entrée active ici.
    const activeInRecommandations = all.filter((e) => !e.gain_dismissed);
    expect(activeInRecommandations).toHaveLength(1);
    expect(picked?.id).toBe(activeInRecommandations[0].id);
  });
});

// ============================================================================
// describeCompareFigures (canton_compare) — doit citer les mêmes montants
// que cantonCompareSummaryRow / page 3, pas le comparatif secondaire "vs
// Zoug" du compareRows sauvegardé (bug historique commit d776f95).
// ============================================================================
describe("describeCompareFigures — canton_compare", () => {
  it("reprend les mêmes montants que le résumé page 3 (cantonCompareSummaryRow)", () => {
    const entry = fixture("canton_compare");
    const row = cantonCompareSummaryRow(entry)!;
    const text = describeCompareFigures(entry)!;
    expect(text).toContain(formatCHF(row.current as number));
    expect(text).toContain(formatCHF(row.projected as number));
  });
});

// ============================================================================
// formatDelta — régression directe du chantier "Taux effectif" : un delta
// de ligne "pct" doit s'afficher en points de pourcentage, un delta
// "chf_per_month" en CHF/mois, jamais en CHF brut par défaut. Avant ce
// correctif, certains appels de formatDelta (drawSimulationPage,
// Synthèse globale) omettaient le paramètre `format` et retombaient
// systématiquement sur du CHF, y compris pour des lignes "pct" — ce n'est
// pas une divergence de VALEUR entre sections (la valeur numérique du
// delta était la même partout) mais une divergence de FORMAT, donc hors
// périmètre de CONSISTENCY_RULES (qui compare des nombres, pas des
// libellés) : ce bloc la couvre séparément.
// ============================================================================
describe("formatDelta — respect du format de la ligne (chantier Taux effectif)", () => {
  it("affiche un delta 'pct' en points de pourcentage, jamais en CHF", () => {
    const text = formatDelta(-10.3, "pct");
    expect(text).toBe(`-${formatPct(10.3)}`);
    expect(text).not.toContain("CHF");
  });

  it("affiche un delta 'chf_per_month' en CHF/mois", () => {
    const text = formatDelta(250, "chf_per_month");
    expect(text).toContain("/ mois");
    expect(text).toContain(formatCHF(250));
  });

  it("retombe sur du CHF brut seulement quand aucun format n'est fourni", () => {
    const text = formatDelta(1000);
    expect(text).toBe(`+${formatCHF(1000)}`);
  });
});
