## Plan

Objectif : supprimer le comparateur de scénarios du calculateur fiscal global parce qu’il est confus et donne des chiffres incompréhensibles.

### Changements prévus

1. **Retirer l’affichage du comparateur**
   - Supprimer tout le bloc visuel des scénarios dans `src/routes/_app/calculators/tax-global.tsx`.
   - Enlever les cartes de scénarios type rachat LPP, 3a, donations, permis, TOU, CMU/LAMal, etc.

2. **Retirer le calcul automatique des scénarios**
   - Supprimer l’import et l’utilisation de `buildScenarios` dans ce calculateur.
   - Retirer les variables uniquement utilisées pour ce comparateur.

3. **Corriger la sauvegarde de simulation**
   - Le bouton de sauvegarde enregistrera le résultat fiscal actuel, pas un scénario “optimal” calculé par le comparateur supprimé.

4. **Conserver le reste intact**
   - Garder les revenus, déductions, calcul fiscal principal, explications, revenus étrangers avec conversion devise, frontalier/TOU, et tous les champs existants.

### Fichier concerné

- `src/routes/_app/calculators/tax-global.tsx`

Aucune modification de base de données n’est nécessaire.