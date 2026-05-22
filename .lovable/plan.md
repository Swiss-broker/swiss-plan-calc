## Pourquoi rien ne bouge actuellement

Sur la capture, la fiche client a déjà `pillar_3a_annual_contribution = 7'258 CHF` (le plafond légal 2026 pour un salarié LPP). Le scénario « Projeté » du split-screen propose justement « cotisation au maximum légal » → comme on est déjà au max, les deux colonnes affichent les mêmes chiffres. C'est mathématiquement juste mais l'écran ne sert à rien dans ce cas, et surtout **le 3B n'entre nulle part dans la comparaison**.

## Ce que je propose

Refondre le bloc « Actuel vs Projeté » du calculateur `pillar3a` pour qu'il représente l'ensemble de la prévoyance privée (3a + 3b) et qu'il propose toujours un levier d'optimisation, même quand le 3a est déjà saturé.

### 1. Élargir la comparaison au 3a + 3b

Le scénario « Actuel » et « Projeté » comparent désormais **tout le pilier 3** :

- Actuel = cotisation 3a saisie + 3b saisi (tels qu'en fiche / formulaire)
- Projeté = 3a au plafond légal **+ 3b « cible »** (cotisation annuelle 3b suggérée, par défaut 6'000 CHF/an si le 3b courant est plus bas, sinon on garde la valeur saisie) **+ retrait fractionné sur 3-5 comptes** au lieu d'un retrait unique

Lignes du comparateur (au lieu de 4 lignes 3a only) :

1. Cotisation annuelle 3a
2. Cotisation annuelle 3b
3. Économie d'impôt annuelle (3a uniquement, le 3b n'est pas déductible)
4. Capital 3a à la retraite
5. Capital 3b à la retraite
6. **Capital total prévoyance privée (3a + 3b)**
7. Impôt sur le retrait à la retraite (unique vs fractionné)
8. Capital net après impôt de sortie

### 2. Bandeau « déjà optimisé » quand le 3a est saturé

Si `contribution >= max` ET (3b absent OU sous-cotisé), afficher un encart explicite au-dessus du comparateur :

> ✅ Cotisation 3a déjà au maximum légal (7'258 CHF). Levier d'optimisation restant : **ouvrir un 3B** + **fractionner les retraits** sur 3 à 5 comptes 3a.

Le summary recalcule alors le gain via le 3b + le fractionnement, plus via la cotisation 3a.

### 3. Suggestion automatique du 3b cible

Si `pillar3bYearly < 3'000`, le scénario projeté utilise 6'000 CHF/an comme cible (montant éditable). Sinon on garde la valeur saisie + 50 %, plafonnée à un montant raisonnable (10'000 CHF/an).

### 4. Summary mis à jour

Le résumé en bas du SplitCompareLayout combine :

- Économie d'impôt annuelle = (Δ 3a) ✕ taux marginal
- Capital supplémentaire à la retraite = Δ(3a + 3b) projetés
- Économie d'impôt au retrait = `staggered.savings` du retrait fractionné
- Delta % = sur le capital net total après impôt de sortie

## Détails techniques

Fichiers touchés :

- `src/routes/_app/calculators/pillar3a.tsx`
  - Calculer `projection3bOptimized` (3b avec cotisation cible)
  - Étendre `compareRows` (8 lignes)
  - Ajouter un bandeau conditionnel « déjà au max »
  - Recalculer le `summary` du `SplitCompareLayout` pour intégrer 3b + fractionnement
- `src/lib/clients/to-calculator-input.ts` (mapper `toPillar3aInput`)
  - Pré-remplir `pillar3bCurrent` et `pillar3bYearly` depuis `client_pension.pillar_3b_accounts` (somme des soldes + estimation versement annuel si stocké)
- Aucun changement de schéma DB, aucune nouvelle dépendance, aucun changement aux autres calculateurs.

## Hors scope (à confirmer si voulu plus tard)

- Pré-remplissage du 3b côté wizard client (formulaire de saisie). Si la fiche n'a pas de 3b, le calculateur prend la valeur par défaut du formulaire et reste éditable.
- Propagation de ce modèle « prévoyance privée totale » dans `ConsolidatedBenefitsCard` (déjà fait en phase 2, mais on pourra y brancher le 3b cible si tu valides la logique ici).
