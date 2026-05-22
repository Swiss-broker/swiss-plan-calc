Le mieux, c’est de changer complètement la logique du bloc “Actuel vs Projeté”.

Aujourd’hui, “Actuel” et “Projeté” ne sont pas assez clairs parce que la situation actuelle contient déjà une partie des champs que l’utilisateur saisit. Donc si tu mets un rachat LPP de 20’000 CHF, ce montant peut déjà être considéré comme “actuel”, et le projeté n’a plus grand-chose à comparer.

Je propose donc cette logique plus claire :

```text
Situation actuelle = la situation de départ figée
Situation projetée = la situation en direct avec les changements saisis
Différence = impact réel de ce que l’utilisateur vient de modifier
```

## Plan proposé

### 1. Refaire la définition du comparateur

Le comparateur fiscal global deviendra un vrai comparateur “avant / après”.

- “Situation actuelle” = snapshot de départ quand on ouvre le calculateur ou quand la fiche client est chargée.
- “Situation projetée” = les valeurs actuellement saisies dans le formulaire.
- Si l’utilisateur modifie le rachat LPP, le 3a, la santé, le canton, le permis, le statut frontalier ou les revenus, la colonne projetée bouge immédiatement.

Résultat attendu : si tu mets un rachat LPP de 20’000 CHF, on voit directement l’impact par rapport à la situation avant rachat.

### 2. Ajouter un bouton “Définir comme situation actuelle”

Pour éviter toute ambiguïté, le courtier pourra figer la situation actuelle à n’importe quel moment.

Exemple :

```text
1. Je saisis la situation réelle du client
2. Je clique “Définir comme situation actuelle”
3. Je teste un rachat LPP, un 3a, une TOU ou un changement de canton
4. Le comparateur affiche l’impact exact
```

### 3. Renommer les colonnes pour supprimer le flou

Remplacer :

```text
Situation actuelle
Situation projetée
```

par quelque chose de plus explicite :

```text
Base de comparaison
Situation simulée
```

ou :

```text
Avant modification
Après modification
```

Je recommande “Avant modification” et “Après modification”, c’est le plus compréhensible.

### 4. Afficher ce qui a réellement changé

Ajouter un bloc juste au-dessus ou sous le comparateur :

```text
Changements simulés
Rachat LPP : +20’000 CHF
3e pilier A : +7’258 CHF
Régime fiscal : Source → TOU
Santé : CMU → LAMal
```

S’il n’y a aucun changement, afficher :

```text
Aucune modification simulée. Modifiez un champ ou appliquez une optimisation pour voir l’impact.
```

### 5. Afficher l’impact par niveau fiscal

Le comparateur doit dire précisément où l’effet se produit :

- Impôt fédéral
- Impôt cantonal et communal
- Impôt à la source
- TOU ou rectification IS
- Charges santé CMU / LAMal
- Net annuel disponible
- Taux effectif
- Taux marginal

Ainsi, on ne montre pas seulement “CHF 0”, on explique pourquoi ça bouge ou pourquoi ça ne bouge pas.

### 6. Garder les optimisations détectées, mais séparées

Les recommandations automatiques doivent rester, mais elles ne doivent plus être confondues avec le comparateur principal.

Je propose deux zones :

```text
Comparateur avant / après
= impact de ce que l’utilisateur saisit maintenant

Optimisations détectées
= autres pistes possibles : 3a max, rachat LPP, TOU, permis C, CMU/LAMal, don, etc.
```

Chaque optimisation détectée pourra avoir un bouton du type :

```text
Appliquer au scénario simulé
```

Comme ça, l’utilisateur comprend : “si j’applique cette optimisation, voilà ce que ça change”.

### 7. Corriger les cas où l’écart reste à zéro

Quand l’économie est nulle, afficher une explication directe selon le cas :

- Le rachat LPP est déjà dans la base de comparaison.
- La TOU ou rectification IS n’est pas avantageuse.
- Le client est sous accord franco-suisse 1983, donc les déductions suisses ne changent pas l’impôt.
- La capacité de rachat LPP n’est pas renseignée.
- Le plafond 3a est déjà atteint.
- Le changement affecte les charges santé mais pas l’impôt.

## Résultat final attendu

Le calculateur fiscal global deviendra lisible comme ça :

```text
Avant modification : impôt total CHF 10’605
Après modification : impôt total CHF 8’940
Économie : CHF 1’665
Cause : rachat LPP +20’000 CHF
Impact : baisse de l’impôt fédéral + cantonal/communal
```

C’est cette approche que je recommande, parce qu’elle répond exactement au besoin : chaque modification doit avoir un endroit clair où son impact apparaît.