
## 1. Retirer « Capacité de rachat LPP » de la fiche client (UI uniquement)

**Objectif :** ne plus saisir `lpp_max_buyback` dans le wizard client (ni création ni édition). La donnée reste utilisable côté calculateur LPP (saisie manuelle libre) et la colonne en base est conservée pour la rétro-compatibilité (valeurs existantes non perdues, juste masquées).

**Fichiers touchés (1 seul) :**
- `src/components/clients/ClientWizard.tsx`
  - Supprimer le bloc `{rules.canBuybackLPP && (<Field label="wizard.lpp.buyback">…)}` (lignes ~1063-1071).
  - Conserver la clé `lpp_max_buyback` dans le state form + le `save()` (envoie 0 par défaut) pour ne rien casser côté DB / scénarios.

**Hors scope (intentionnel) :**
- Pas de migration DB.
- La fiche client lecture seule (`$clientId.tsx` ligne 465) continue d'afficher la valeur si elle existe en base (issue d'une ancienne saisie).
- Le calculateur LPP (`/calculators/lpp`) garde son champ « Capacité de rachat » saisissable.
- Les bornes `lppCapacity > 0` côté scénarios continuent de fonctionner avec les anciennes valeurs.

---

## 2. Synchroniser automatiquement l'état civil fiche client → calculateurs

**Problème actuel :** `useHydrateFormFromPrefill` (src/hooks/usePrefillFromClient.ts) hydrate le formulaire **une seule fois** (via `hydratedRef`). Si le courtier modifie l'état civil dans la fiche client puis revient sur un calculateur, le calculateur garde l'ancienne valeur.

**Solution ciblée :** créer un second hook `useSyncCivilStatusFromClient` qui surveille en continu **uniquement les champs "identité fiscale"** issus de la fiche (état civil, enfants, canton, confession), et les force à se resynchroniser quand ils changent côté fiche — sans écraser les autres ajustements "what-if" du courtier (salaire, rendement, etc.).

**Fichiers touchés :**
- `src/hooks/usePrefillFromClient.ts` : ajouter le hook `useSyncFieldsFromClient(prefill, setForm, fieldKeys)` :
  - Stocke la dernière valeur connue de chaque champ surveillé.
  - À chaque changement de `prefill[field]`, met à jour `form[field]` (même si déjà hydraté).
  - Listes typées + comparaison stricte pour éviter les boucles.
- Chaque calculateur consommateur s'abonne pour `["status", "canton", "children", "confession"]` selon ce qu'il utilise :
  - `src/routes/_app/calculators/lpp.tsx`
  - `src/routes/_app/calculators/income-tax.tsx`
  - `src/routes/_app/calculators/source-tax.tsx`
  - `src/routes/_app/calculators/cross-border.tsx`
  - `src/routes/_app/calculators/pillar3a.tsx`
  - `src/routes/_app/calculators/retirement.tsx`
  - `src/routes/_app/calculators/tou.tsx`
  - `src/routes/_app/calculators/avs-ai.tsx`
  - `src/routes/_app/calculators/tax-global.tsx`
- Note UX dans chaque page : le sélecteur « Statut civil » devient **read-only** quand `clientId` est présent (même pattern que le champ « enfants » déjà existant en `lpp.tsx` lignes 439-450). Sous-titre : « Synchronisé depuis la fiche client ».

**Garde-fou :** en mode standalone (sans `clientId`), le hook ne fait rien — le courtier peut toujours simuler librement.

---

## 3. Rendre le plan de rachat LPP explicable (transparence calculs)

**Problème :** le bloc « Économies » du calculateur LPP affiche des chiffres (totalTaxSavings, yearlyAmount, ROI moyen, taux marginal effectif) sans expliquer **comment** ils sont obtenus ni **pourquoi** ils varient.

**Solution :** ajouter sous la `CalcCard` « Économies du plan de rachat » un panneau dépliable « Comment ce résultat est calculé » avec :

1. **Méthode** (texte clair, sans jargon)
   - Montant annuel = `actualBuyback ÷ nombre d'années` (capé à la capacité).
   - Pour chaque année : on calcule l'impôt **avec** ce rachat (déduction art. 33 al. 1 let. d LIFD) et **sans**, l'économie = différence.
   - Le total = somme des économies annuelles.
   - Le ROI fiscal = économie totale ÷ rachat total (interprété comme « pour 1 CHF investi, X centimes récupérés en impôt »).
   - Le taux marginal effectif = part du 1er versement effectivement absorbée par l'économie d'impôt.

2. **Hypothèses utilisées** (lues depuis `enrichedTaxInput`) :
   - Canton, commune (multiplicateur), statut civil, confession, nombre d'enfants.
   - Revenu de référence (salaire brut + salaire conjoint + autres revenus).
   - Déductions prises en compte (3a annuel, primes maladie, frais pro forfaitaires).
   - Année fiscale utilisée.

3. **Tableau année par année** déjà présent, enrichi d'une 3ᵉ colonne « Coût net » (= versement − économie).

4. **Avertissements clés** (1 ligne chacun) :
   - Blocage 3 ans avant tout retrait LPP (art. 79b al. 3 LPP).
   - Si `actualBuyback > capacity` → message déjà présent, conservé.
   - Si revenu trop bas pour absorber la déduction → message « rachat partiellement perdu fiscalement » avec montant absorbable estimé.
   - Si le marginal effectif diffère sensiblement du marginal théorique baseline → courte explication (« la déduction fait passer la tranche marginale de X% à Y% »).

5. **Lien vers la fiche wiki** « Rachat LPP » (déjà existante via `wikiId="lpp-rachat"`).

**Fichiers touchés :**
- `src/routes/_app/calculators/lpp.tsx` : nouveau composant local `<BuybackPlanExplanation plan={buybackPlan} taxInput={enrichedTaxInput} form={form} />` rendu sous la `CalcCard` « savings_card » (ligne ~524). Utilise `<Collapsible>` (déjà dans le projet via `src/components/ui/collapsible.tsx`).
- `src/lib/i18n/fr.ts` + `de.ts` + `en.ts` + `it.ts` : nouvelles clés `calc.lpp.explain.*` (titre, méthode, hypothèses, avertissements).

**Aucun calcul existant n'est modifié** — uniquement de l'affichage explicatif au-dessus du résultat déjà produit par `simulateBuybackPlan()`.

---

## Vérifications après implémentation

- `bun run typecheck` / build harness vert.
- Wizard : étape LPP n'affiche plus le champ capacité, sauvegarde OK.
- Fiche client : modifier état civil → ouvrir calc LPP → état civil mis à jour automatiquement.
- Calc LPP : panneau explicatif déplié → toutes les hypothèses listées correspondent au résultat.
