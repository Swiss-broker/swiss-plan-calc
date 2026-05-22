## Ce qui se passe et pourquoi c'est confus

Trois problèmes distincts s'additionnent dans l'écran actuel :

### 1. Le « 4 500 » qui sort de nulle part pour le 3b projeté

Dans le code j'ai mis une règle automatique :

- si tu cotises < 3 000 CHF/an au 3b → cible = 6 000 CHF/an
- sinon → cible = ton versement × 1,5 (plafonné à 10 000)

Tu as saisi 3 000, donc la cible devient 3 000 × 1,5 = **4 500**. Le « +1 500 » vert est l'écart entre les deux colonnes. Cette règle n'est documentée nulle part dans l'UI, donc c'est illisible.

### 2. Les petites pastilles vertes avec la flèche

Elles indiquent l'écart entre la colonne « Actuelle » et « Projetée » (delta brut, ex. `+1 500 CHF`). C'est censé être un signal rapide « combien tu gagnes en passant à la situation projetée », mais sans légende ça ressemble à du bruit.

### 3. « Économie annuelle CHF 0 »

L'économie annuelle affichée = économie d'impôt 3a (projeté) − économie d'impôt 3a (actuel). Comme ton 3a est déjà au max, c'est 2 296 − 2 296 = **0**. Le 3b n'est **pas déductible** du revenu donc ne génère aucune économie d'impôt annuelle. C'est techniquement juste mais ça ne reflète pas le vrai gain de l'optimisation, qui est :

- +48 045 de capital 3b à la retraite (grâce à la cotisation 3b plus forte)
- +5 133 d'impôt en moins au retrait (fractionnement)
- = **+53 178 CHF nets** à la retraite (déjà affiché dans la 2e tuile)

## Plan de correction

### A. Rendre le 3b cible explicite et contrôlable

- Ajouter au-dessus du comparateur un petit bandeau qui dit en clair :
  > « 3b projeté : on suppose +50 % de votre versement actuel (cible 4 500 CHF/an). Modifiez la cible ci-dessous. »
- Ajouter **un champ « 3b cible (CHF/an) »** éditable dans le bloc « Actuel vs Projeté » lui-même, pré-rempli avec la règle automatique mais que l'utilisateur peut surcharger. Si on le passe à 3 000 = même que l'actuel, le « +1 500 » disparaît et le capital projeté 3b devient identique → confirme visuellement la logique.
- Si actuel = 0, la cible par défaut reste 6 000 (faut une suggestion concrète).

### B. Légender les pastilles delta

Ajouter une mini-légende sous le titre du comparateur :

> « Les pastilles vertes indiquent l'écart entre votre situation actuelle et la projection (ex. +1 500 CHF/an = vous cotisez 1 500 de plus). »

Et masquer les pastilles quand le delta = 0 (déjà fait), ou afficher « = » neutre pour rendre clair que rien n'a bougé.

### C. Remplacer le bandeau résumé du bas

Au lieu du trio actuel (Économie annuelle 0 / Capital net suppl. / Δ %), afficher **trois indicateurs qui ont du sens dans tous les cas** :

1. **Capital net supplémentaire à la retraite** (le vrai gain final) — déjà calculé : 53 178 CHF
2. **Économie d'impôt annuelle (3a)** — utile uniquement si le 3a n'est pas maxé ; sinon afficher « 3a déjà au max — pas d'économie supplémentaire » au lieu de « CHF 0 »
3. **Économie d'impôt au retrait (fractionnement)** — le levier fiscal restant quand le 3a est saturé : 5 133 CHF

Et **ventiler** dans le sous-titre du bandeau d'où vient le gain : « = 48 045 CHF de cotisations 3b supplémentaires capitalisées + 5 133 CHF d'impôt en moins au retrait ».

### D. Clarifier les lignes du comparateur

- Renommer « Cotisation annuelle 3a » → « Cotisation 3a (CHF/an) ».
- Ajouter un petit `hint` (déjà supporté par `SplitRow`) sur « Cotisation annuelle 3b » qui dit : « Cible projetée = +50 % de votre versement actuel (modifiable) ».
- Ajouter un `hint` sur « Économie d'impôt annuelle (3a) » : « Le 3b n'est pas déductible du revenu, donc n'apparaît pas ici. »

## Détails techniques

Un seul fichier touché : `src/routes/_app/calculators/pillar3a.tsx`.

- Nouveau state local `target3bYearlyOverride` (number | null) ; `target3bYearly` = override ?? règle auto.
- Nouveau champ `NumField` « 3b cible (CHF/an) » au-dessus du `SplitCompareLayout` avec bouton « auto » pour réinitialiser à la règle.
- Refonte du bandeau `summary` du `SplitCompareLayout` (3 tuiles au lieu de 2, libellés conditionnels).
- Ajout des `hint` sur les 2 lignes concernées.
- Mini-légende sous le titre.

Aucun changement de logique de calcul, aucun changement DB, aucun autre calculateur impacté.
