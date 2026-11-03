// Règles métier dérivées du statut professionnel.
// Centralise "que peut/doit ce client faire" pour éviter la duplication
// entre wizard, calculateurs, optimizer et dashboard.

import type { WorkStatus } from "@/lib/swiss/enums";
import { PILLAR_3A_MAX_LPP_2026, PILLAR_3A_MAX_NO_LPP_2026 } from "@/lib/pillar3";

export interface WorkStatusRules {
  /** Le client perçoit-il un salaire (champ salaire visible & pertinent) ? */
  hasSalary: boolean;
  /** Le client est-il affilié à la LPP (cotise + capacité de rachat) ? */
  hasLPP: boolean;
  /** Plafond 3a applicable (avant prise en compte du revenu indépendant). */
  pillar3aCap: number;
  /** Le client peut-il faire un rachat LPP ? */
  canBuybackLPP: boolean;
  /** Le client est-il déjà à la retraite (rentes au lieu de salaire) ? */
  isRetired: boolean;
  /** Le client est-il indépendant (pur ou mixte) ? */
  isSelfEmployed: boolean;
  /** Calcs jugés non pertinents pour ce statut (clé route). */
  hiddenCalculators: ReadonlySet<string>;
  /** Étiquette FR courte pour affichage. */
  shortLabel: string;
}

const NO_HIDE: ReadonlySet<string> = new Set();

export function getWorkStatusRules(status: WorkStatus | null | undefined): WorkStatusRules {
  switch (status) {
    case "self_employed":
      return {
        hasSalary: false,
        hasLPP: false, // pas de LPP obligatoire (peut s'affilier facultativement)
        pillar3aCap: PILLAR_3A_MAX_NO_LPP_2026, // 36'288 (20% du revenu net plafonné)
        canBuybackLPP: false,
        isRetired: false,
        isSelfEmployed: true,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Indépendant",
      };
    case "mixed":
      return {
        hasSalary: true,
        hasLPP: true, // affilié via la part salariée
        pillar3aCap: PILLAR_3A_MAX_LPP_2026,
        canBuybackLPP: true,
        isRetired: false,
        isSelfEmployed: true,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Mixte",
      };
    case "retired":
      return {
        hasSalary: false,
        hasLPP: false,
        pillar3aCap: 0,
        canBuybackLPP: false,
        isRetired: true,
        isSelfEmployed: false,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Retraité",
      };
    case "unemployed":
      return {
        hasSalary: false,
        hasLPP: false,
        pillar3aCap: 0,
        canBuybackLPP: false,
        isRetired: false,
        isSelfEmployed: false,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Sans emploi",
      };
    case "student":
      return {
        hasSalary: true,
        hasLPP: false,
        pillar3aCap: PILLAR_3A_MAX_LPP_2026,
        canBuybackLPP: false,
        isRetired: false,
        isSelfEmployed: false,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Étudiant",
      };
    case "director":
      return {
        hasSalary: true,
        hasLPP: true,
        pillar3aCap: PILLAR_3A_MAX_LPP_2026,
        canBuybackLPP: true,
        isRetired: false,
        isSelfEmployed: false,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Dirigeant",
      };
    case "employee":
    default:
      return {
        hasSalary: true,
        hasLPP: true,
        pillar3aCap: PILLAR_3A_MAX_LPP_2026,
        canBuybackLPP: true,
        isRetired: false,
        isSelfEmployed: false,
        hiddenCalculators: NO_HIDE,
        shortLabel: "Salarié",
      };
  }
}

/** Plafond 3a effectif tenant compte du revenu (indépendant ou non). */
export function effectivePillar3aCap(
  status: WorkStatus | null | undefined,
  income?: number,
): number {
  const rules = getWorkStatusRules(status);
  if (rules.hasLPP) return rules.pillar3aCap;
  // Non affilié LPP (indépendant pur, étudiant sous le seuil d'entrée LPP,
  // ou tout futur statut hasLPP:false) : Art. 7 OPP3, plafond = 20% du
  // revenu net, max 36'288 — jamais le plafond "affilié LPP" (7'258).
  // Avant ce correctif, seul isSelfEmployed basculait sur cette formule :
  // un étudiant avec un job d'appoint (hasLPP: false, isSelfEmployed:
  // false) retombait sur le plafond bas 7'258, trop élevé pour son revenu réel.
  const ratio = (income ?? 0) * 0.2;
  return Math.min(PILLAR_3A_MAX_NO_LPP_2026, Math.round(ratio));
}
