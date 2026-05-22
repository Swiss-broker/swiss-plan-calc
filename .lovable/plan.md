Deux objectifs : relier chaque pastille de delta à la cause concrète, et nettoyer le visuel de la section.

## 1. Relier chaque pastille verte / rouge à ses causes

Chaque ligne du comparateur (Impôt fédéral, Cantonal + communal, Charges santé, Net annuel, Taux effectif, Taux marginal) deviendra cliquable / survolable. La pastille de delta ouvrira une mini‑explication structurée :

```text
Impôt fédéral    CHF 8'940   −CHF 1'665
└─ causes :
   • Rachat LPP +20'000 CHF       → −CHF 1'420 (déduction directe)
   • 3e pilier A +2'258 CHF       → −CHF 245  (déduction directe)
   • Salaire brut +14'000 CHF     → +CHF 0    (compensé par déductions)
```

Mécanique : pour chaque champ modifié, on lance un calcul incrémental qui isole sa contribution à la ligne concernée (méthode des sensibilités : on applique le champ seul sur la base et on mesure l'écart par poste — IFD, cantonal+communal, fortune, charges santé, net, taux). Les champs sans effet sur cette ligne précise sont masqués.

Tooltip ou panneau dépliable selon la place : on partira sur un panneau dépliable juste sous le tableau (mobile‑friendly), avec un bouton « voir le détail » à côté de chaque pastille.

Ajout d'un mapping champ → poste fiscal impacté :

```text
3a, rachat LPP, primes santé, dons, frais garde
   → IFD + cantonal + communal (déductions du revenu)
Fortune nette
   → Impôt sur la fortune uniquement
LAMal/CMU, primes santé (frontalier)
   → Charges santé
Salaires, bonus, autres revenus
   → IFD + cantonal + communal + net annuel + taux
Canton, permis, statut civil, confession
   → barème entier (toutes lignes)
```

## 2. Nettoyer la section « Changements simulés »

Supprimer le `line-through` et passer à une grille en colonnes alignées, façon tableau léger :

```text
Champ              Avant       Après        Δ
Salaire brut       120'000     134'000      +14'000
3e pilier A        0           7'258        +7'258
Nombre d'enfants   0           2            +2
Pays résidence     CH          FR           —
Permis             swiss       B            —
```

Détails visuels :

- Colonnes alignées (grid `auto 1fr 1fr auto`), tabular‑nums.
- « Avant » en gris doux, « Après » en foreground normal, sans barré.
- Delta dans une pastille fine à droite : verte si baisse d'impôt attendue (rachat LPP, 3a, dons, primes…), rouge si hausse de revenu, neutre (gris) pour les champs catégoriels.
- Ligne « Régime fiscal » mise en évidence (badge bleu, pleine largeur) car c'est un changement structurel, pas une simple variation.
- Compteur de modifications déplacé en titre de la carte au lieu du badge en haut à droite.

## 3. Cohérence avec le bloc « Pourquoi l'écart reste à zéro »

- Quand un champ a un effet nul, on garde l'explication champ par champ existante mais on la relie à la même mécanique : la ligne du tableau et la pastille pointent vers la même raison.
- Si toutes les pastilles sont neutres, on masque le bloc des sensibilités et on n'affiche que les causes transverses (accord 1983, source sans TOU, etc.).

## Détails techniques

- Nouveau helper `computeFieldSensitivities(baseline, current)` dans `src/lib/tax-global/sensitivities.ts` : pour chaque champ modifié, recalcule `computeTaxGlobal` avec ce champ seul appliqué sur la base, et renvoie l'écart par poste (`ifd`, `cantonalCommunal`, `wealth`, `health`, `net`, `effectiveRate`, `marginalRate`).
- Extension de `SplitRow` (`src/components/calculators/SplitCompareLayout.tsx`) avec un champ optionnel `breakdown?: ReactNode` rendu sous la ligne quand l'utilisateur clique sur la pastille.
- Refonte du bloc « Changements simulés » dans `src/components/calculators/TaxGlobalCompareCard.tsx` en grille tabulaire, sans `line-through`.
- Aucune modification des moteurs de calcul (`tax/income`, `tax/source`, `tax/cross-border`, `health-france`) : on réutilise `computeTaxGlobal` en boîte noire.
- Performance : 1 calcul de base + 1 calcul par champ modifié (typique < 10), mémoisé via `useMemo` sur `(baseline, form)`.