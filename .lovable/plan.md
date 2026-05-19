## Objectif

Remplacer la tuile "3e pilier B" dans `OptimizationsPanel` par une explication claire, structurée et **juste** sur le plan fiscal, avec un comportement adapté au canton du client (Genève / Fribourg = règles spéciales, autres = pas de déduction).

## Problème actuel

Le texte actuel est un bloc dense, mélange IFD / cantonal / forfait assurances / frontalier en une phrase, cite un chiffre GE erroné (~2 200 / ~4 300 CHF pour le forfait LAMal, pas pour le 3b), et conclut sans message clair. Résultat : on ne comprend pas si oui ou non on peut déduire un 3b.

## Règles fiscales correctes (sources : Finwise Assurances, troisiemepilier.ch, jane.ch — 2025)

- **IFD (impôt fédéral)** : 3e pilier B **jamais déductible**, dans aucun canton.
- **Majorité des cantons** : 3b **non déductible** du revenu (les primes peuvent éventuellement rentrer dans le forfait global "assurances + intérêts d'épargne", mais ce forfait est en pratique saturé par la LAMal → impact = 0).
- **Canton de Genève** (déduction cantonale spécifique 3b, plafonds 2025) :
  - Célibataire : jusqu'à **2 196 CHF/an** (4 434 CHF si indépendant)
  - Couple marié / partenariat enregistré : jusqu'à **3 292 CHF** (6 652 CHF si les 2 sont indépendants)
  - Supplément **900 CHF par enfant** (1 814 CHF par enfant si indépendants)
- **Canton de Fribourg** (déduction cantonale 3b) :
  - Célibataire : **750 CHF/an**
  - Couple : **1 500 CHF/an**
- **Frontalier accord 1983 (VD/VS/NE/JU/FR)** : imposition en France → la déduction CH cantonale 3b **n'a aucun effet fiscal**.

## Comportement de la nouvelle tuile

Tuile toujours visible dans `OptimizationsPanel` (en bas, même en état vide). Contenu adapté :

1. **Titre clair** + sous-titre : "Déductible uniquement à Genève et Fribourg".
2. **Bloc principal court** (2-3 phrases) expliquant en clair :
   - Pas de déduction au niveau fédéral.
   - Pas de déduction dans la plupart des cantons.
   - Exceptions : GE et FR uniquement, avec plafonds bas.
3. **Mini-tableau lisible** des plafonds 2025 (GE + FR), célibataire / couple, avec note "par enfant" pour GE.
4. **Variante contextuelle** selon le canton détecté (props : `canton?: string`, `civilStatus?: string`, `taxStatus?: TaxStatusContext`) :
   - Si canton = `GE` : badge vert "Vous êtes éligible (GE)" + montant max applicable mis en évidence selon statut civil.
   - Si canton = `FR` : badge vert "Vous êtes éligible (FR)" + montant FR mis en évidence.
   - Si autre canton : badge gris "Non déductible dans votre canton" + texte "Le 3b reste utile pour la prévoyance et la transmission, mais sans levier fiscal direct."
   - Si frontalier accord 1983 : note rouge/warning "Imposition en France : aucune déduction CH applicable, même si canton = FR."
5. Conclusion utilitaire en 1 phrase : "Le 3b reste pertinent pour la protection des proches, la transmission et l'épargne à long terme — mais ce n'est pas un levier d'optimisation fiscale dans la majorité des cas."

## Modifications techniques

**Fichier modifié : `src/components/optimizer/OptimizationsPanel.tsx`**

1. Étendre la signature `OptimizationsPanel` avec props optionnelles :
   ```ts
   canton?: string;
   civilStatus?: string;
   taxStatus?: "resident" | "source_taxed" | "cross_border_fr_1983" | "cross_border_ge" | "tou";
   ```
2. Passer ces props à `<Pillar3bInfoTile canton={...} civilStatus={...} taxStatus={...} />`.
3. Réécrire `Pillar3bInfoTile` :
   - Constantes locales `GE_LIMITS` et `FR_LIMITS` (chiffres 2025).
   - Logique :
     - `isFrontalier1983 = taxStatus === "cross_border_fr_1983"`
     - `eligibleCanton = canton === "GE" || canton === "FR"` (et non frontalier)
     - Badge + bloc "votre situation" calculé en fonction.
   - Structure visuelle : en-tête (icône + titre + badge contextuel), paragraphe d'explication clair, petit tableau 2-colonnes (Genève / Fribourg) avec plafonds, et phrase de conclusion.
   - Aucun `<strong>` empilé — utiliser hiérarchie typographique (h4, text-sm, text-xs muted).

**Fichier modifié : `src/routes/_app/calculators/tax-global.tsx`**

- Passer `canton`, `civilStatus` et `taxStatus` (régime détecté) à `<OptimizationsPanel>` là où il est rendu, pour activer la variante contextuelle.

## Hors scope

- Pas de nouveau scénario chiffré "verser X CHF en 3b" dans `scenarios.ts` (décision déjà prise : trop dépendant du forfait cantonal et du statut indépendant).
- Pas de changement dans `engine.ts`, `to-calculator-input.ts`, ni dans la DB.
- Pas de modification de la fiche client (3b non saisi côté DB aujourd'hui — info pédagogique uniquement).

## Vérification

Lecture visuelle de la tuile sur le client courant (canton à confirmer dans la fiche) :
- Si GE/FR → badge vert + plafond mis en avant.
- Sinon → badge gris + message court.
- Si frontalier 1983 → message warning.

Aucune migration DB, aucun nouveau test requis.
