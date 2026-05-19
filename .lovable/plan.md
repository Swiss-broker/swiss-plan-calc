## 1. États civils complets

Les enums DB existent déjà avec : `single`, `married`, `registered_partnership`, `divorced`, `widowed`, `separated` (voir `CIVIL_STATUS_LABELS`). Le calculateur Global n'accepte aujourd'hui que `single | married`.

À faire :
- Étendre `TaxGlobalInput.civilStatus` à toute la liste DB + `cohabiting` (concubinage).
- UI : remplacer le `<Select>` par la liste complète (Célibataire, Marié(e), Partenariat enregistré, Concubinage, Divorcé(e), Séparé(e), Veuf/Veuve).
- Mapping fiscal correct (règle CH) dans un helper unique `toTaxStatus(civilStatus, children)` :
  - `married`, `registered_partnership` → barème couple (statut `married` côté moteurs).
  - `single`, `divorced`, `widowed`, `separated`, `cohabiting` + enfants à charge → `single_with_children`.
  - Sinon → `single`.
- Champ "conjoint actif" et "salaire conjoint" affichés uniquement si statut couple (`married` ou `registered_partnership`). Pour `cohabiting`, afficher une note : "Imposition séparée en Suisse — chaque partenaire déclare seul."
- Le prefill depuis fiche client passe déjà par DB enum donc plus de perte d'info.

## 2. Indicateur "Frontalier" clair

Quand `countryOfResidence !== "CH"` ET canton de travail saisi :
- Le hero badge affiche déjà `regimeLabel`. On ajoute en plus un **chip "🇫🇷→🇨🇭 Frontalier"** dédié à côté du badge "Régime détecté", coloré (accent), visible au premier coup d'œil.
- Section accordéon "Frontalier" : déjà ouverte automatiquement (`defaultValue` étendu) quand `showFrontalierBlock`.
- Tuile résultat dédiée "Part Suisse / Part Étrangère" toujours visible en mode frontalier avec montants + % détaillés (déjà partiellement présent, à compléter).

## 3. Audit complet des calculs

Bugs identifiés à corriger :

**a) Frontalier — `marginalRate` toujours à 0.**
Calculer le taux marginal réel = dérivée du `frenchIncomeTax` à la tranche du revenu imposable (taux de la dernière tranche atteinte × parts/parts). Renvoyé par `computeCrossBorder`.

**b) Frontalier — Mélange impôt et LAMal/CMU dans `totalTaxCHF`.**
Aujourd'hui `total = crossBorder.totalTax + health.recommendedAnnualCHF`. C'est trompeur : la santé n'est pas un impôt.
- `totalTaxCHF` ne contient QUE l'impôt (CH + FR).
- Nouveau champ `socialChargesCHF` = LAMal/CMU recommandée.
- KPI "Net annuel" = `gross - totalTaxCHF - socialChargesCHF` (charges sociales déduites du net réel).
- Tuile dédiée "Couverture santé" affiche le coût séparément.

**c) Source / TOU — `effectiveRate` calculé sur `gross` incluant `otherIncome` mais source n'impose que le salaire.**
- Aligner : `effectiveRate = source.annualTax / (salaire imposé à la source uniquement)`.
- Si TOU avantageux et retenu : recalculer `effectiveRate` sur le revenu mondial CH.

**d) Résident ordinaire — `foreignIncome` ignoré dans le moteur income.**
Le moteur income ne le prend pas, mais en taxation ordinaire CH le revenu mondial sert au **taux effectif** (méthode d'exonération avec réserve de progression).
- Ajouter une note explicite si `foreignIncome > 0` : "Revenu étranger exonéré mais retenu pour le taux effectif — à déclarer manuellement."
- Afficher la part suisse / part étrangère dans tous les régimes (pas seulement TOU).

**e) Cross-border GE — `swissTax` arrondi à l'entier puis utilisé pour `swissRate`.**
OK mais `foreignTax` côté GE = `frenchIncomeTax × 0.05` est une approximation très grossière du résiduel (taux effectif). À remplacer par le calcul exact : impôt FR sur revenu mondial − crédit d'impôt = max(0, FR_tax(mondial) × (revenuFR_hors_CH / mondial)). Si pas de revenu hors CH → 0.

**f) `netAnnualCHF` — base inconsistante selon régime.**
- Résident ordinaire : `gross = grossSalary + bonus + spouseGrossSalary + otherIncome + rentalIncome + imputedRent` (manque actuellement spouse/rental/imputed).
- Source : `gross = salaireBrut + bonus + spouseGrossSalary (si conjoint actif)`.
- Frontalier : `gross = salaireBrut + bonus` (le conjoint, s'il travaille en FR, n'est pas dans le brut CH).
Unifier via un helper `computeGrossIncomeForRegime(input, regime)` réutilisé pour effective rate ET net.

**g) Tuiles "Part suisse / Part étrangère"** toujours affichées en mode frontalier avec :
- Part suisse = impôt source CH + cotisations sociales CH (déjà retenues sur fiche de paie).
- Part étrangère = impôt FR + CMU si applicable.

**h) `marginalRate` résident — déjà calculé par `computeIncomeTax`** : OK.

## 4. Scénarios — recalcul après corrections

Les scénarios (3a max, rachat LPP, permis C, TOU) appellent déjà `computeTaxGlobal` donc bénéficient automatiquement des corrections. À vérifier après refacto que `deltaVsBaseline` reste cohérent (ne pas comparer un `totalTaxCHF` qui inclut la santé à un qui ne l'inclut pas — la correction (b) règle ça naturellement).

## 5. Traductions

~10 clés i18n nouvelles dans `fr/en/de/it` : libellés des statuts (déjà dans `CIVIL_STATUS_LABELS` via `enum.civil_status.*`), badge "Frontalier", note concubinage, label "Charges sociales", label "Couverture santé séparée".

## Fichiers touchés

- `src/lib/tax-global/types.ts` — étendre `civilStatus`, ajouter `socialChargesCHF` au résultat.
- `src/lib/tax-global/profile.ts` — helper `toTaxStatus()` partagé.
- `src/lib/tax-global/engine.ts` — corrections (b), (c), (d), (e), (f), (g) ; séparation impôt/santé ; gross unifié.
- `src/lib/tax/cross-border.ts` — `marginalRate` (a), affinage `foreignTax` GE (e).
- `src/routes/_app/calculators/tax-global.tsx` — Select états civils complet, badge Frontalier visible, tuile santé séparée, tuile parts suisse/étrangère, note concubinage.
- `src/lib/i18n/{fr,en,de,it}.ts` — clés ajoutées.

## Hors scope

- Pas de modification de la DB (l'enum `civil_status` couvre déjà tout sauf "cohabiting" — géré côté Global uniquement, pas persisté).
- Pas de refonte visuelle, juste l'ajout du badge et d'une tuile santé.
