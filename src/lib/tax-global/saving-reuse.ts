// Que faire de l'économie d'impôt ? Le Fiscal global chiffre l'impôt
// d'aujourd'hui et l'impôt après démarche (rectification du barème ou TOU).
// Ce module reprend cette économie annuelle et compare ce qu'elle rapporte
// selon l'endroit où le client la place : 3e pilier A, 3e pilier B, compte
// d'épargne. Une seule fonction, utilisée par le Fiscal global, le
// calculateur 3e pilier et le PDF, pour que les montants concordent.
import { computeTaxGlobal } from "./engine";
import { createDefaultInput, toTaxStatus } from "./profile";
import type { TaxGlobalInput } from "./types";
import { PILLAR_3A_MAX_2026_LPP, PILLAR_3A_MAX_2026_NO_LPP } from "@/lib/tax/income";
import { capitalWithdrawalTax } from "@/lib/lpp";
import {
  toTaxGlobalInput,
  stripUndefined,
  type ClientBundle,
} from "@/lib/clients/to-calculator-input";

export const SAVING_REUSE_RETIREMENT_AGE = 65;
/** Rendements nets par défaut, alignés sur le calculateur 3e pilier. */
export const SAVING_REUSE_RETURNS = { pillar3a: 2.5, pillar3b: 2.0, savings: 0.5 } as const;

export type SavingOrigin = "tou" | "rectification" | "none";

export interface SavingPlacement {
  id: "pillar3a" | "pillar3b" | "savings";
  label: string;
  /** Montant placé chaque année (CHF). */
  yearlyAmount: number;
  /** Option 3a : part au-delà du plafond 3a, placée en 3e pilier B. */
  leftover: number;
  /** Économie d'impôt supplémentaire obtenue chaque année grâce au placement. */
  extraTaxSavingPerYear: number;
  returnRate: number;
  /** Capital à la retraite, net de l'impôt de sortie (3a uniquement). */
  capitalAtRetirement: number;
  exitTax: number;
  /** Capital + économies d'impôt cumulées − versements. */
  netGain: number;
  note: string;
}

export interface SavingReuse {
  /** Impôt d'aujourd'hui (CHF/an). */
  todayTax: number;
  /** Impôt après la meilleure démarche disponible (CHF/an). */
  afterTax: number;
  /** todayTax − afterTax, jamais négatif. */
  annualSaving: number;
  origin: SavingOrigin;
  originLabel: string;
  years: number;
  /** Marge restante sous le plafond 3a (CHF/an). */
  room3a: number;
  placements: SavingPlacement[];
  /** Placement au gain net le plus élevé. */
  bestId: SavingPlacement["id"] | null;
}

function futureValue(yearly: number, years: number, ratePercent: number): number {
  const r = ratePercent / 100;
  let balance = 0;
  for (let i = 0; i < years; i++) balance = balance * (1 + r) + yearly;
  return balance;
}

/** Plafond 3a du client : petit 3a pour un salarié affilié à une caisse de
 *  pension, grand 3a (20 % du revenu) pour un indépendant sans LPP. */
export function pillar3aCeiling(g: TaxGlobalInput): number {
  if (g.workStatus && g.workStatus !== "employee") {
    return Math.min(PILLAR_3A_MAX_2026_NO_LPP, Math.round((g.grossSalary + g.bonus) * 0.2));
  }
  return PILLAR_3A_MAX_2026_LPP;
}

export function computeSavingReuse(
  g: TaxGlobalInput,
  opts: { annualSavingOverride?: number } = {},
): SavingReuse {
  const today = computeTaxGlobal({ ...g, assumeTou: false });
  const afterTou = computeTaxGlobal({ ...g, assumeTou: true });
  const todayTax = Math.round(today.totalTaxCHF);

  // Meilleure démarche disponible : TOU (si le client y a droit) ou simple
  // rectification du barème d'impôt à la source.
  let afterTax = todayTax;
  let origin: SavingOrigin = "none";
  const touAvailable = today.touEligibility ? today.touEligibility.eligibleForTOU : true;
  if (touAvailable && Math.round(afterTou.totalTaxCHF) < afterTax) {
    afterTax = Math.round(afterTou.totalTaxCHF);
    origin = "tou";
  }
  const rect = today.sourceRectification;
  if (rect?.applicable) {
    const rectified = Math.round(todayTax + rect.delta);
    if (rectified < afterTax) {
      afterTax = rectified;
      origin = "rectification";
    }
  }
  const annualSaving = Math.max(0, opts.annualSavingOverride ?? todayTax - afterTax);
  const originLabel =
    origin === "tou"
      ? "demande de taxation ordinaire (TOU)"
      : origin === "rectification"
        ? `rectification du barème (${rect?.defaultScaleCode} → ${rect?.rectifiedScaleCode})`
        : "aucune démarche";

  const years = Math.max(1, SAVING_REUSE_RETIREMENT_AGE - (g.age ?? 40));
  const room3a = Math.max(0, pillar3aCeiling(g) - (g.pillar3aContributions || 0));
  const status = toTaxStatus(g.civilStatus, g.children);

  // Économie d'impôt supplémentaire d'une déduction : toujours chiffrée
  // après TOU, comme partout ailleurs (3e pilier, LPP).
  const extraSaving = (field: "pillar3aContributions" | "pillar3bContributions", add: number) => {
    if (add <= 0) return 0;
    const base = computeTaxGlobal({ ...g, assumeTou: true }).totalTaxCHF;
    const withIt = computeTaxGlobal({
      ...g,
      assumeTou: true,
      [field]: (g[field] || 0) + add,
    }).totalTaxCHF;
    return Math.max(0, Math.round(base - withIt));
  };

  const placements: SavingPlacement[] = [];
  if (annualSaving > 0) {
    // Option 3a : jusqu'au plafond légal, le solde éventuel en 3e pilier B
    // pour que les options portent toutes sur le même montant annuel.
    const a3 = Math.min(annualSaving, room3a);
    const rest = annualSaving - a3;
    const gross3a = futureValue(a3, years, SAVING_REUSE_RETURNS.pillar3a);
    const exit3a = capitalWithdrawalTax({ capital: gross3a, canton: g.canton, status }).total;
    const restCapital = futureValue(rest, years, SAVING_REUSE_RETURNS.pillar3b);
    const extra3a = extraSaving("pillar3aContributions", a3);
    if (a3 > 0) {
      placements.push({
        id: "pillar3a",
        label: rest > 0 ? "3e pilier A, solde en 3e pilier B" : "3e pilier A",
        yearlyAmount: annualSaving,
        leftover: rest,
        extraTaxSavingPerYear: extra3a,
        returnRate: SAVING_REUSE_RETURNS.pillar3a,
        capitalAtRetirement: Math.round(gross3a - exit3a + restCapital),
        exitTax: Math.round(exit3a),
        netGain: Math.round(
          gross3a - exit3a + restCapital + extra3a * years - annualSaving * years,
        ),
        note:
          (rest > 0
            ? `CHF ${a3.toLocaleString("fr-CH")} en 3a (plafond légal atteint), CHF ${rest.toLocaleString("fr-CH")} en 3b. `
            : "") +
          (extra3a > 0
            ? "Versement 3a déductible du revenu : l'économie d'impôt s'ajoute chaque année. Capital bloqué jusqu'à la retraite (sauf achat du logement, départ de Suisse, mise à son compte), imposé à taux réduit à la sortie."
            : "Pas d'économie d'impôt supplémentaire dans la situation de ce client (impôt déjà au plus bas ou imposition en France)."),
      });
    }

    const b3 = annualSaving;
    const gross3b = futureValue(b3, years, SAVING_REUSE_RETURNS.pillar3b);
    const extra3b = extraSaving("pillar3bContributions", b3);
    placements.push({
      id: "pillar3b",
      label: "3e pilier B",
      yearlyAmount: b3,
      leftover: 0,
      extraTaxSavingPerYear: extra3b,
      returnRate: SAVING_REUSE_RETURNS.pillar3b,
      capitalAtRetirement: Math.round(gross3b),
      exitTax: 0,
      netGain: Math.round(gross3b + extra3b * years - b3 * years),
      note:
        extra3b > 0
          ? "Primes déductibles tant que le forfait assurances n'est pas déjà atteint par les primes maladie. Pas de plafond de versement, capital disponible selon le contrat."
          : "Pas de déduction fiscale, mais aucun plafond de versement, capital disponible selon le contrat et exonéré à l'échéance si les conditions de durée sont remplies.",
    });

    const grossSav = futureValue(annualSaving, years, SAVING_REUSE_RETURNS.savings);
    placements.push({
      id: "savings",
      label: "Compte d'épargne",
      yearlyAmount: annualSaving,
      leftover: 0,
      extraTaxSavingPerYear: 0,
      returnRate: SAVING_REUSE_RETURNS.savings,
      capitalAtRetirement: Math.round(grossSav),
      exitTax: 0,
      netGain: Math.round(grossSav - annualSaving * years),
      note: "Disponible à tout moment, sans avantage fiscal ; les intérêts sont imposables.",
    });
  }

  const best = placements.length
    ? placements.reduce((a, b) => (b.netGain > a.netGain ? b : a))
    : null;

  return {
    todayTax,
    afterTax,
    annualSaving,
    origin,
    originLabel,
    years,
    room3a,
    placements,
    bestId: best ? best.id : null,
  };
}

/** Même calcul à partir d'un dossier client (fiche + prévoyance). */
export function computeSavingReuseFromBundle(bundle: ClientBundle): SavingReuse {
  const g = {
    ...createDefaultInput(),
    ...stripUndefined(toTaxGlobalInput(bundle) as unknown as Record<string, unknown>),
  } as TaxGlobalInput;
  return computeSavingReuse(g);
}
