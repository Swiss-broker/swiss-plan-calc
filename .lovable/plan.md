Je vais corriger ça en deux axes : cohérence des montants et lecture visuelle claire.

## 1. Faire matcher le comparateur cantonal avec le fiscal global

- Le comparateur cantonal utilise aujourd’hui `computeIncomeTax` en mode taxation ordinaire simple.
- Le fiscal global utilise `computeTaxGlobal`, qui tient compte du régime réel du client : résident ordinaire, source, TOU, frontalier Genève, frontalier accord 1983, etc.
- Pour un client comme celui affiché actuellement : canton GE, résidence FR, permis B, statut source/frontaliers, le fiscal global part sur un régime frontalier Genève, alors que le comparateur cantonal compare comme une taxation ordinaire suisse classique. C’est la source principale de l’écart.

Je vais donc :
- importer la logique fiscale globale dans le comparateur cantonal ;
- construire les lignes du comparateur en changeant uniquement le canton, mais en conservant tous les autres paramètres du client/calculateur global ;
- utiliser `computeTaxGlobal` pour le mode “impôt annuel” quand le comparateur est ouvert depuis une fiche client ;
- garder le moteur actuel seulement comme fallback pour le mode standalone sans client ou pour les cas où le comparateur n’a pas les données fiscales globales nécessaires ;
- ajouter dans le comparateur les champs manquants qui influencent le fiscal global : canton, pays de résidence, permis/régime, bonus, autres revenus, 3a, rachat LPP, intérêts, entretien, fortune, confession, enfants, conjoint.

Résultat attendu : si fiscal global affiche Genève à ~24–26k selon les déductions/régime, la ligne Genève du comparateur cantonal affichera la même base de calcul, pas un autre moteur incohérent.

## 2. Clarifier les cas où un canton change aussi le régime fiscal

Certains écarts sont fiscalement normaux si le régime change avec le canton :
- Genève frontalier = imposition à la source genevoise ;
- Vaud/Valais/Fribourg/Jura/Neuchâtel pour résident France = accord 1983, imposition française avec compensation 4.5 % ;
- résident CH = taxation ordinaire cantonale.

Je vais rendre ça visible dans le comparateur :
- afficher le régime utilisé par ligne/canton dans le tooltip ou sous le montant ;
- éviter que l’utilisateur pense que ce sont les mêmes règles quand juridiquement ce ne sont pas les mêmes ;
- mettre une note claire si le comparateur compare des régimes différents, pas uniquement des barèmes cantonaux.

## 3. Harmoniser les données préremplies depuis la fiche client

Je vais ajuster le mapping client pour que `tax-global` et `canton-compare` partent de la même matière fiscale :
- salaire + bonus + autres revenus ;
- conjoint si applicable ;
- enfants ;
- canton ;
- pays de résidence ;
- permis ;
- statut fiscal ;
- 3a annuel ;
- fortune nette ;
- intérêts hypothécaires et frais immobiliers ;
- rachats LPP de l’année.

But : quand on passe d’une fiche client à un calculateur, les calculateurs ne doivent plus ignorer des éléments que les autres prennent en compte.

## 4. Revoir les couleurs dans “Rente vs capital”

Je vais remplacer la logique orange ambiguë par une logique explicite :
- vert très visible = option gagnante / optimisation / meilleur net ;
- orange = coût fiscal, charge, ou option moins favorable ;
- neutre/bleu = information de contexte, pas une recommandation.

Concrètement :
- `Total impôt capital` restera identifié comme une charge fiscale, mais avec un libellé plus clair ;
- entre “rente” et “capital”, le meilleur scénario sera vert ;
- le scénario perdant sera orange ;
- la recommandation finale utilisera aussi le vert si une stratégie est clairement gagnante, et un style neutre si le résultat est mixte.

## 5. Vérification chiffrée

Après correction, je vérifierai au minimum :
- un cas GE frontalier/résidence France ;
- un cas résident CH taxation ordinaire ;
- un cas avec 3a annuel ;
- un cas rente vs capital où le capital gagne ;
- un cas rente vs capital où la rente gagne.

Objectif : supprimer les contradictions visibles entre calculateurs et rendre les économies/coûts immédiatement compréhensibles.