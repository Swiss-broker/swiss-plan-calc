# Barre des calculateurs de la fiche client — version unifiée

## Constat actuel

La barre `ClientCalculatorBar` (rendue dans `/clients/$clientId`) liste déjà 10 calculateurs + le comparateur dirigeant conditionnel. Investment-compare est volontairement absent (autonome). MAIS deux mécanismes de masquage rendent la liste incomplète selon le profil :

1. `work-status-rules.ts` masque jusqu'à 4 chips selon le statut pro (retraité, indépendant, étudiant, sans emploi).
2. La condition `show()` masque frontalier et impôt source si le statut fiscal ne correspond pas.

Résultat : un courtier sur un dossier de retraité ne voit que 6 chips au lieu de 11, sans explication.

## Synchronisation fiche → calculateurs (déjà en place, à conserver)

Tous les calcs reliés utilisent `usePrefillFromClient` + `useHydrateFormFromPrefill`. Aucun changement nécessaire ici. La matrice est correcte ; le solde LPP est utilisé partout où il fait sens (LPP, retirement, vested-benefits, pillar3a). Pour income-tax, on utilise volontairement la **capacité de rachat** et non le solde (le solde LPP n'entre pas dans la fortune imposable suisse).

## Changements à faire

### 1. Refondre `ClientCalculatorBar.tsx`

- **Ne plus filtrer** : `CHIPS.filter(...)` est remplacé par un mapping qui calcule pour chaque chip un statut `relevant: boolean` + `reason: string` (raison du grisage).
- **Toujours afficher les 10 chips** + le comparateur dirigeant si applicable (ou grisé si client non dirigeant ou sans société).
- Un chip non pertinent reste cliquable mais :
  - Opacité réduite (`opacity-50`)
  - Bordure pointillée (`border-dashed`)
  - Icône info subtile à droite
  - `Tooltip` (Radix) sur hover qui affiche la raison ("Client retraité — pas de cotisation LPP possible", "Client résident, pas frontalier", etc.)

### 2. Centraliser les règles de pertinence

Créer une fonction `getCalculatorRelevance(client, calcRoute) → { relevant, reason }` dans `src/lib/clients/calculator-relevance.ts`. Elle remplace la logique dispersée entre `work-status-rules.hiddenCalculators` et les `show()` dans CHIPS.

Règles unifiées :
- LPP : non pertinent si `retired | unemployed | self_employed | student`
- Pilier 3a : non pertinent si `retired | unemployed`
- Source-tax : pertinent uniquement si `tax_status` ∈ {`source_taxed`, `tou`}
- Frontalier : pertinent uniquement si `tax_status` ∈ {`cross_border_fr_1983`, `cross_border_ge`}
- Cross-border : non pertinent si retraité/sans emploi/indépendant
- Director-compensation : pertinent uniquement si `work_status === director` ET `company_id`
- Tous les autres (income-tax, TOU, AVS, libre passage, retirement, canton-compare) : toujours pertinents

### 3. Garder la responsabilité de masquage AILLEURS

`work-status-rules.hiddenCalculators` est utilisé uniquement par la barre. On le **vide** (passe à `NO_HIDE` partout) et on rend la nouvelle fonction `getCalculatorRelevance` source de vérité unique. Cela évite la divergence.

### 4. Légende discrète

Ajouter sous la barre une mention 11 px : "Les calculateurs grisés ne s'appliquent pas à ce profil — clic possible pour simulation what-if."

## Détail technique

```text
src/components/clients/ClientCalculatorBar.tsx       (refonte)
src/lib/clients/calculator-relevance.ts              (nouveau)
src/lib/clients/work-status-rules.ts                 (hiddenCalculators → NO_HIDE)
```

- Composant `<Tooltip>` déjà disponible dans `src/components/ui/tooltip.tsx`.
- Pas de migration DB, pas de changement de schéma, pas de touche aux calculateurs eux-mêmes.
- Pas de changement à la logique de prefill : elle est correcte et reste comme telle.

## Hors scope

- Pas de changement à `investment-compare` (reste autonome, hors barre).
- Pas de modification des mappers de prefill.
- Pas de refonte visuelle de la fiche client en dehors de cette barre.
