## Calculateur Fiscal Suisse Global — Fusion des 4 calculateurs

### Objectif
Remplacer dans l'UI les 4 calculateurs fiscaux (Frontalier FR, Revenu/Fortune, Source, TOU/Quasi-résident) par **UN SEUL** module `/calculators/tax-global` qui :
- Détecte automatiquement le régime fiscal du client
- Affiche dynamiquement uniquement les champs utiles
- Lance tous les calculs en parallèle
- Compare les scénarios (statut actuel vs TOU vs permis C vs optimisations)

**La logique métier des 4 moteurs est 100% conservée** — on l'orchestre, on ne la réécrit pas.

---

### 1. Moteur orchestrateur (`src/lib/tax-global/`)

```
src/lib/tax-global/
  profile.ts      // détection auto du régime (réutilise suggestTaxStatus + règles)
  engine.ts       // appelle les moteurs existants selon le régime
  scenarios.ts    // génère les scénarios comparés
  types.ts        // TaxGlobalInput unifié + TaxGlobalResult
```

**Détection** :
- permis G + résidence FR + canton GE → frontalier GE
- permis G + résidence FR + canton accord 1983 → frontalier FR
- permis B/L + résident CH → source (+ proposer TOU si éligible)
- permis C / suisse + résident CH → ordinaire (revenu + fortune)
- Flags additionnels : `hasRealEstate`, `hasLpp`, `has3a`, `selfEmployed`...

**Orchestrateur** : selon le régime, appelle parmi
- `computeIncomeTax` (lib/tax/income)
- `computeSourceTax` (lib/tax/source)
- `computeCrossBorder` (lib/tax/cross-border)
- `computeTou` (lib/tax/tou)
- `computeHealthFrance` (lib/health-france) — CMU vs LAMal pour frontaliers
- `computeOvertimeFr` (lib/overtime-fr) — heures sup frontaliers

Aucun moteur n'est modifié.

---

### 2. Page unique `/calculators/tax-global`

`src/routes/_app/calculators/tax-global.tsx` — layout 3 zones :

**Gauche (3/5) — Fiche client unique en accordéons**
- Identité & ménage (canton, permis, état civil, enfants, religion, pays)
- Revenus (salaire, bonus, locatifs, dividendes, indépendant, étrangers)
- Patrimoine (mobilière, immobilière, crypto, titres, liquidités)
- Optimisations (rachats LPP, 3a, intérêts hypo, pensions, garde, frais réels, dons)

Les sections s'affichent/se masquent selon le régime détecté (ex : fortune masquée pour frontalier source pur).

**Droite (2/5) sticky — Résultats temps réel**
- Badge "Régime détecté" (couleur + libellé clair)
- Tuiles : revenu imposable, impôt total, taux global, net annuel, économie potentielle
- Breakdown : fédéral / cantonal / communal / fortune / source / CMU-LAMal

**Bas pleine largeur — Comparateur de scénarios**
Cartes côte à côte avec Δ vs baseline en vert/rouge :
- Situation actuelle
- TOU/Quasi-résident (si éligible)
- Passage permis C
- + Rachat LPP max
- + 3a max non utilisé

Recalcul instantané via `useMemo` sur l'input unifié.

---

### 3. Pré-remplissage client

- Extension `usePrefillFromClient` avec kind `"tax-global"`
- Nouveau mapper `toTaxGlobalInput` dans `src/lib/clients/to-calculator-input.ts` qui agrège tous les champs (clients + client_pension + client_assets)
- Mutualisation : une seule saisie alimente tous les calculs internes

---

### 4. Page index `/calculators`

Module **Fiscalité** restructuré :
- **Remplace** les 4 cartes par UNE carte "Calculateur Fiscal Global" en avant
- Conserve uniquement un lien discret "Accès aux moteurs séparés" (les 4 routes existantes restent accessibles techniquement, mais ne sont plus mises en avant)

Les routes `/calculators/income-tax`, `/source-tax`, `/cross-border`, `/tou` restent fonctionnelles pour les bookmarks et le prefill client existant.

---

### 5. Export & sauvegarde
- Nouveau PDF synthèse globale dans `src/lib/pdf/reports.ts` (`exportTaxGlobalPdf`) : régime détecté, breakdown, scénarios comparés, recommandation
- Bouton "Sauvegarder simulation" (kind `tax_global`) — étend `simulation_history`

---

### 6. i18n
~40 clés nouvelles dans `fr.ts / en.ts / de.ts / it.ts` :
- titres sections, labels régime détecté, libellés scénarios, tuiles résultats

---

### Ce qui NE change PAS
- Tous les moteurs existants (`tax/income`, `tax/source`, `tax/cross-border`, `tax/tou`, `health-france`, `overtime-fr`) — code inchangé
- Schéma BDD inchangé (la "fiche client centralisée" demandée existe déjà : tables `clients` + `client_pension` + `client_assets`)
- Les 4 routes existantes restent fonctionnelles (rétro-compatibilité)
- PDF reports existants conservés

---

### Livrables
1. `src/lib/tax-global/{profile,engine,scenarios,types}.ts`
2. `src/routes/_app/calculators/tax-global.tsx`
3. `toTaxGlobalInput` dans `to-calculator-input.ts` + kind `"tax-global"` dans `usePrefillFromClient`
4. `src/routes/_app/calculators/index.tsx` — mise en avant du nouveau module
5. `exportTaxGlobalPdf` dans `src/lib/pdf/reports.ts`
6. i18n 4 langues
7. Enregistrement kind `tax_global` dans `src/lib/history/registry.ts`

### Notes techniques
- Tous les moteurs existants sont des fonctions pures → orchestration sans effets de bord
- Composants UI réutilisés : `CalcCard`, `MoneyTile`, `PctTile`, `NumField`, `Accordion`, `Tabs`
- Architecture extensible : ajouter un futur calculateur = +1 appel dans `engine.ts` + +1 carte scénario
