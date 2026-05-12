
# Ajout du mode d'intérêts (composés / simples) — Comparateur d'investissements

## Objectif
Permettre à l'utilisateur de choisir, pour chaque investissement (A et B) du comparateur, entre :
- **Intérêts composés** (comportement actuel : capitalisation année par année, le rendement s'applique sur capital + gains accumulés)
- **Intérêts simples** (le rendement annuel ne s'applique qu'au capital versé, jamais aux intérêts déjà générés)

## Changements

### 1. Logique de calcul — `src/lib/investment-compare/index.ts`
- Ajouter un champ `interestMode: "compound" | "simple"` à `InvestmentInput` (défaut `"compound"` pour rétro-compatibilité).
- Dans `simulateInvestment`, brancher selon `interestMode` :
  - **compound** : logique existante inchangée.
  - **simple** : à chaque année, intérêt = (capital versé cumulé) × taux net ; le capital final = total versé + somme des intérêts annuels. Les frais restent déduits du taux brut, l'impôt à la sortie reste appliqué sur le gain.
- Conserver la même structure `InvestmentYearPoint` pour que le graphique et le tableau PDF fonctionnent sans modification.

### 2. UI — `src/routes/_app/calculators/investment-compare.tsx`
- Ajouter `interestMode: "compound"` dans `DEFAULT_A` et `DEFAULT_B`.
- Dans `InvestmentCard`, ajouter un `Select` (ou `RadioGroup`) sous le champ "Type" :
  - Label : "Mode d'intérêts" / equiv.
  - Options : "Intérêts composés" (défaut) / "Intérêts simples"
  - HelpDot expliquant la différence.
- Inclure la valeur dans le tableau récap PDF (`exportInvestmentComparePdf`) — une ligne supplémentaire dans le tableau comparatif.

### 3. Internationalisation — `src/lib/i18n/{fr,de,en,it}.ts`
Ajouter les clés :
- `calc.invcompare.field.interest_mode`
- `calc.invcompare.mode.compound`
- `calc.invcompare.mode.simple`
- `calc.invcompare.tip.interest_mode` (explication courte : composés réinvestissent les gains, simples non)

### 4. Cohérence
- Pas de changement de schéma DB : `interestMode` sera persisté tel quel dans le JSON `inputs` de `SaveSimulationButton` (compatible).
- Pas d'impact sur la Synthèse RDV (le gain net final reste lu de la même façon via `extract-gain.ts`).

## Hors scope
- Pas de changement sur les autres calculateurs.
- Pas de migration de données existantes (les anciennes simulations sans `interestMode` seront traitées comme `compound`).
