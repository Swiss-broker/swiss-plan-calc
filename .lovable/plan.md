# Correction du comparateur cantonal lié à la fiche client

Tu signales deux problèmes précis depuis la fiche client → bouton "Comparateur cantonal" :
1. Le **salaire brut** affiché ne tient pas compte du bonus (13ᵉ) ni des autres revenus.
2. Le mode **prestation en capital** ignore le **rachat LPP** dans le capital projeté à 65 ans.

## Diagnostic

### Bug 1 — revenus tronqués (mode annuel)

Dans `src/lib/clients/to-calculator-input.ts`, `toCantonCompareInput` mappe uniquement `client.gross_annual_salary` :

```ts
grossSalary: numOrUndef(b.client.gross_annual_salary),
```

Le formulaire du comparateur n'a qu'un seul champ "Salaire brut" (volontairement minimaliste). Bonus (10 000) et autres revenus (6 000) sont donc **perdus** lors du préremplissage → le calcul tourne sur 100 000 au lieu de 116 000.

**À noter** : les autres mappers sont déjà corrects sur ce point (income-tax, tou, AVS additionnent bonus/other). Le bug est isolé au comparateur cantonal.

### Bug 2 — rachat LPP non pris en compte (mode prestation en capital)

Dans `src/routes/_app/calculators/canton-compare.tsx` (l.118) :

```ts
const projectedLPPCapital = dashboard?.lpp?.projectedCapitalAt65 ?? 0;
```

`projectedCapitalAt65` est la projection LPP **sans rachat**. La capacité de rachat est exposée séparément (`dashboard.lpp.buybackCapacity`) mais n'est jamais agrégée → l'imposition de prestation en capital sous-évalue la base.

## Corrections

### 1. `src/lib/clients/to-calculator-input.ts`

Dans `toCantonCompareInput`, agréger les revenus comme dans le mapper income-tax :

```ts
const totalIncome =
  Number(b.client.gross_annual_salary ?? 0) +
  Number(b.client.bonus ?? 0) +
  Number(b.client.other_income ?? 0);

return {
  // …
  grossSalary: totalIncome > 0 ? totalIncome : undefined,
  // …
};
```

### 2. `src/routes/_app/calculators/canton-compare.tsx`

Inclure le rachat LPP planifié dans le capital projeté :

```ts
const projectedLPPCapital =
  (dashboard?.lpp?.projectedCapitalAt65 ?? 0) +
  (dashboard?.lpp?.buybackCapacity ?? 0);
```

### 3. i18n `src/lib/i18n/{fr,en,de,it}.ts`

Préciser le libellé du sous-titre du mode "prestation en capital" pour rendre l'agrégation transparente :

- FR : « Capital projeté à 65 ans **incluant rachats LPP planifiés** : {amount} »
- EN/DE/IT équivalents

Et clarifier le libellé du champ "Salaire brut" du comparateur :
- FR : « Salaire brut **total** (incl. bonus et autres revenus) »

## Vérifications

1. **Tests unitaires** : `bunx vitest run --reporter=dot` → les 30 tests doivent rester verts (aucun moteur touché).
2. **QA browser automatisée** :
   - Créer/ouvrir un client : salaire 100 000 + bonus 10 000 + autres 6 000.
   - Cliquer "Comparateur cantonal" depuis la fiche.
   - Vérifier que le champ "Salaire brut" affiche **116 000**.
   - Activer le mode "Prestation en capital" et vérifier que le capital affiché = projection LPP + rachat.
   - Comparer une ligne (ex. GE) avec le calculateur impôt revenu standalone à 116 000 → cohérence.

## Fichiers touchés

- `src/lib/clients/to-calculator-input.ts`
- `src/routes/_app/calculators/canton-compare.tsx`
- `src/lib/i18n/fr.ts`, `en.ts`, `de.ts`, `it.ts`

## Hors scope (à confirmer)

Tu mentionnes aussi « les calculateurs ne sont pas liés entre eux apparemment et d'autres choses ». J'ai déjà vérifié les mappers des autres calculateurs (income-tax, TOU, AVS, source, frontalier, LPP, 3a, libre passage, retraite) : ils transmettent correctement les champs disponibles dans la fiche. Si tu as **un cas précis** où un champ manque ou un montant ne remonte pas, indique-le moi (calculateur + champ + ce que tu as saisi vs. ce que tu vois) et je l'inclus dans la correction.
