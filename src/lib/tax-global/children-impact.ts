// "Impact enfants" — pour un client SANS enfant, projette ce que changerait
// concrètement l'arrivée d'un enfant sur ses finances (même salaire, même
// canton, tout identique sauf l'enfant). Volontairement réservé aux clients
// sans enfant : comparer un client qui A déjà un enfant à la même situation
// sans cet enfant laissait entendre "vous seriez mieux sans lui", un cadre
// à éviter. La version prospective ("et si vous aviez un enfant ?") est
// pertinente pour un couple qui envisage une naissance, pas pour un parent.

import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput } from "./types";

export interface ChildrenImpact {
  /** Économie d'impôt annuelle si un enfant arrivait (déductions + rabais) :
   *  impôt actuel (sans enfant) moins impôt avec 1 enfant hypothétique. */
  taxSavingsCHF: number;
  /** Allocations familiales annuelles saisies sur la fiche (telles quelles,
   *  jamais devinées — à ajuster par le courtier au montant réel attendu). */
  familyAllowancesCHF: number;
  /** true si ajoutées au revenu imposable (indépendant) — voir TaxGlobalResult. */
  familyAllowancesIncludedInIncome: boolean;
  /** Impact NET réel sur le revenu disponible annuel — calcul autoritaire
   *  du moteur (netAnnualCHF avec enfant hypothétique moins actuel), PAS
   *  une simple somme de taxSavingsCHF + familyAllowancesCHF : pour un
   *  salarié, les allocations sont déjà comprises dans le salaire brut
   *  saisi des deux côtés de la comparaison (jamais ajoutées, voir
   *  isSelfEmployedStatus dans engine.ts), donc sans effet sur le delta de
   *  revenu brut — les sommer en plus doublerait leur effet. */
  netImpactCHF: number;
}

/** Retourne null si le client a déjà au moins un enfant (rien d'hypothétique
 *  à montrer — voir la note en tête de fichier sur le choix de ce sens). */
export function computeChildrenImpact(input: TaxGlobalInput): ChildrenImpact | null {
  if (input.children > 0) return null;

  // Situation actuelle : sans enfant, donc sans droit aux allocations
  // familiales — forcé à 0 ici même si le champ du formulaire contient déjà
  // le montant anticipé pour l'hypothèse ci-dessous (voir withChild), pour
  // ne jamais l'ajouter au revenu d'un indépendant qui n'a pas encore
  // d'enfant (addableFamilyAllowances ne conditionne pas lui-même sur le
  // nombre d'enfants, donc sans ce forçage le montant aurait été ajouté des
  // deux côtés et se serait annulé dans le delta, masquant complètement
  // l'effet des allocations pour un indépendant).
  const current = computeTaxGlobal({ ...input, familyAllowances: 0 });
  // Âge 0 : hypothèse la plus courante pour une projection "et si on avait
  // un enfant ?" (naissance à venir), sans effet sur la déduction fédérale
  // (fixe par enfant) ni sur la plupart des barèmes cantonaux. Allocations
  // familiales : montant du formulaire repris tel quel (jamais deviné) —
  // à ajuster par le courtier au montant réel anticipé.
  const withChild = computeTaxGlobal({
    ...input,
    children: 1,
    childrenAges: [0],
  });

  return {
    taxSavingsCHF: current.totalTaxCHF - withChild.totalTaxCHF,
    familyAllowancesCHF: withChild.familyAllowancesCHF,
    familyAllowancesIncludedInIncome: withChild.familyAllowancesIncludedInIncome,
    netImpactCHF: withChild.netAnnualCHF - current.netAnnualCHF,
  };
}
