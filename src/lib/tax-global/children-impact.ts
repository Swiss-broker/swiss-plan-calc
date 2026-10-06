// "Impact enfants" — isole ce que les enfants changent concrètement sur les
// finances du client, en comparant la situation actuelle à la MÊME
// situation sans aucun enfant (même salaire, même canton, tout identique).

import { computeTaxGlobal } from "./engine";
import type { TaxGlobalInput } from "./types";

export interface ChildrenImpact {
  /** Économie d'impôt annuelle liée aux enfants (déductions + rabais) :
   *  impôt sans enfant moins impôt avec enfant(s). */
  taxSavingsCHF: number;
  /** Allocations familiales annuelles saisies sur la fiche. */
  familyAllowancesCHF: number;
  /** true si ajoutées au revenu imposable (indépendant) — voir TaxGlobalResult. */
  familyAllowancesIncludedInIncome: boolean;
  /** Impact NET réel sur le revenu disponible annuel — calcul autoritaire
   *  du moteur (netAnnualCHF avec enfants moins sans enfants), PAS une
   *  simple somme de taxSavingsCHF + familyAllowancesCHF : pour un
   *  salarié, les allocations sont déjà comprises dans le salaire brut
   *  saisi des deux côtés de la comparaison (jamais ajoutées, voir
   *  isSelfEmployedStatus dans engine.ts), donc sans effet sur le delta de
   *  revenu brut — les sommer en plus doublerait leur effet. */
  netImpactCHF: number;
}

/** Retourne null si le client n'a pas d'enfant (rien à comparer). */
export function computeChildrenImpact(input: TaxGlobalInput): ChildrenImpact | null {
  if (input.children <= 0) return null;

  const withChildren = computeTaxGlobal(input);
  const withoutChildren = computeTaxGlobal({
    ...input,
    children: 0,
    childrenAges: [],
    familyAllowances: 0,
  });

  return {
    taxSavingsCHF: withoutChildren.totalTaxCHF - withChildren.totalTaxCHF,
    familyAllowancesCHF: withChildren.familyAllowancesCHF,
    familyAllowancesIncludedInIncome: withChildren.familyAllowancesIncludedInIncome,
    netImpactCHF: withChildren.netAnnualCHF - withoutChildren.netAnnualCHF,
  };
}
