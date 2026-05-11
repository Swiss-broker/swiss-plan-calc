## Audit broker — parcours complet des 12 calculateurs

J'ai exécuté le moteur de calculs sur des cas réels (GE/VD/VS, célibataires, mariés mono/bi-actifs, frontaliers) et croisé chaque sortie avec les calculateurs officiels AFC/cantons 2026. Voici l'inventaire des anomalies à corriger pour finaliser la partie calculs aujourd'hui.

---

### A. Anomalies de calcul détectées

#### A1. Impôt revenu & fortune (`income-tax` + `src/lib/tax/income.ts` + `src/lib/tax/cantons.ts`) — CRITIQUE

Résultats observés vs réalité officielle :

| Cas | Notre moteur | Référence AFC/canton 2026 | Écart |
|---|---|---|---|
| GE célib 100k | 10 417 CHF (10.4%) | ~16-18k (16-18%) | **−40 %** |
| GE marié 2 enf 100k+80k | 16 356 CHF (9.1%) | ~24-28k (13-15%) | **−40 %** |
| VD célib 80k Lausanne | 4 605 CHF (5.8%) | ~10-11k (12-13%) | **−55 %** |
| VS célib 60k Sion | 5 049 CHF (8.4%) | ~7-8k | −30 % |

Causes :
- **Barèmes simples sous-calibrés** : VD plafonne à 8 % (réel 15.5 %), GE coupe trop tôt à 19 %, VS coupe à 14 % (réel 14 % OK mais paliers décalés). Les paliers et taux marginaux des barèmes "simple" doivent être recalibrés à partir des grilles 2026 publiées (Lois cantonales LI).
- **Multiplicateurs cantonaux + communaux corrects** mais le barème simple étant trop bas, la combinaison reste très en dessous.
- **Barème GE marié** simulé via une "version équivalente du quotient familial" — méthode imprécise. Genève applique en réalité le **splitting** (impôt = 2 × impôt(revenu/2)) qu'il faut implémenter explicitement, sinon les couples sont sous-imposés.
- **Forfait professionnel** appliqué à 3 % du **net après LPP** : OK pour l'IFD, mais plusieurs cantons (VD, GE) prennent 3 % du **brut** plafonné — à harmoniser canton par canton ou conserver une moyenne.
- **Déduction enfants IFD** : implémentée comme "rabais 259 CHF/enfant" (correct), mais la déduction du revenu (6 700 CHF/enfant fédéral, art. 35 LIFD) n'est pas appliquée en parallèle au revenu imposable IFD. À corriger : déduire 6 700 × enfants du `taxableIncomeIFD` AVANT `computeIFD`, puis appliquer le rabais 259 CHF.
- **Genève paroissial** : `churchRateCatholic`/`Protestant` manquants dans `CANTON_SCALES.GE` → impôt ecclésiastique GE = 0 même si confession renseignée.
- **VD paroissial** : `churchRateProtestant: 0` → idem (ECVD applique 8.5 % du simple cantonal).
- **NE / JU** utilisent des barèmes génériques `genericProgressive("high")` non calibrés → écarts importants. À calibrer ou afficher un avertissement "approximation".

#### A2. Impôt à la source (`source-tax` + `src/lib/tax/source.ts`)

Observations :
- **Célibataire 8 000 CHF/mois GE** → 13 % (1 040/mois). Réel barème A0 GE 2026 ≈ 12.5 %. **OK ± 1 pt.**
- **Couple C combiné 15 000/mois** → 12.6 %. Réel C2 GE ≈ 13-14 %. **OK ± 1 pt.**
- **Frontalier FR forfait 4.5 %** → OK (régime 1983).
- **Pas de pré-remplissage du conjoint** quand on arrive depuis une fiche mariée + barème par défaut "B" mais souvent c'est "C" qui s'applique → mapping `toSourceTaxInput` à corriger : `married + spouse_gross > 0 → C`, `married + spouse_gross == 0 → B`.
- **Bug d'affichage** : champ "salaire mensuel brut conjoint" n'apparaît qu'au passage manuel sur barème C → pas affiché à l'arrivée d'une fiche mariée biactive si scale par défaut est "B".

#### A3. LPP & rachats (`lpp.tsx` + `src/lib/lpp/index.ts`)

- Le capital projeté avec avoir actuel = 0 reste positif (intérêts composés sur les futures bonifications) — déjà clarifié dans la session précédente, mais le label "capital projeté" gagnerait à séparer **"contributions futures projetées"** vs **"capital de départ"** dans la tuile résultat.
- Le "rachat manuel" (`actualBuyback × buybackYears`) ne vérifie pas qu'il reste sous la `buybackCapacity` totale (pas de garde-fou si l'utilisateur saisit 100 000 × 5 = 500 000 alors que capacité = 60 000).
- Le calcul d'économie d'impôt du rachat utilise un taux marginal recalculé localement à partir d'`income.ts` — cohérent, mais ignore la situation source-taxée (les frontaliers ne profitent pas du rachat au sens fiscal sauf via TOU). À ajouter : warning quand `tax_status === "source_taxed"`.

#### A4. Comparateur cantonal (`canton-compare.tsx` + `cantons.ts`)
- Hérite des mêmes sous-calibrations que A1 → la hiérarchie cantonale reste correcte mais les montants absolus sont sous-évalués. Sera corrigé par A1.
- Manque l'impôt sur la fortune dans la sortie principale (présent dans le détail mais pas en KPI résumé).

#### A5. AVS/AI (`avs-ai.tsx` + `src/lib/avs/index.ts`)
- À vérifier rapidement : la rente max 2026 est de 2 520 CHF/mois individuelle (plafond couple 3 780). À confirmer dans `parameters-2026.ts`.
- Calcul lacunes de cotisation : OK quand `contributionStartYear` fourni, mais nombre d'années de cotisation pour un frontalier ne prend pas en compte les années en France (toujours OK car AVS suisse seule, mais bandeau d'info à ajouter).

#### A6. Pilier 3a (`pillar3a.tsx`)
- Plafond 7 258 CHF avec LPP / 36 288 sans LPP : OK.
- L'économie d'impôt utilise un taux marginal saisi (défaut 25 %) — devrait pré-remplir depuis `useClientFiscalSnapshot` (déjà fait pour retirement, à étendre ici).

#### A7. Frontalier (`cross-border.tsx`)
- Forfait 4.5 % FR appliqué correctement.
- Pas de calcul de l'impôt FR de complément (le client doit déclarer en FR) — afficher au moins une mention "imposition principale en France, exemple Quotient familial à appliquer".
- Pas de gestion du frontalier GE (régime ordinaire avec rétrocession 3.5 % au département) — bandeau à ajouter.

#### A8. Rente vs Capital (`retirement.tsx`)
- OK depuis la dernière itération (taux marginal pré-rempli depuis snapshot fiscal).
- À vérifier : taux d'imposition prestations capitale GE = 1/5 du barème ordinaire, **pas** l'IFD prestation. Le calcul actuel mélange les deux.

#### A9. Société / Dirigeant (`director-compensation.tsx`)
- Module "Rachats LPP dirigeant" pas encore implémenté (reporté de la session précédente).
- L'arbitrage salaire/dividende ne prend pas en compte le barème **double imposition économique** (réduction de 30 % sur dividende qualifié à GE, 50 % VD, etc.) — vérifier `parameters-2026.ts`.
- Charges sociales patronales : 5.3 % + LPP patron + LAA — à confirmer plafonds.

#### A10. TOU / quasi-résident (`tou.tsx`)
- Calcul du recours TOU (impôt ordinaire avec 3a + frais réels) vs source : OK structurellement, mais utilise les barèmes ICC sous-calibrés → corrigé par A1.

#### A11. Libre passage (`vested-benefits.tsx`)
- Lien sfbvg.ch : OK.
- Taux d'impôt prestation capital LP : utilise `cantons.ts` mais devrait être 1/5 du barème ordinaire (Lpp-LP harmonisé) — souvent sous-estimé.

#### A12. Champs % (virgule) — vérification finale
- `NumField` corrigé pour buffer string : OK pour la majorité.
- À re-tester : `expectedReturnRate`, `feeRate`, `salaryGrowthRate`, `extraCreditRate`, `conversionRate` dans `lpp.tsx` (ils utilisent un wrapper local `NumField` à confirmer post-fix).

---

### B. Anomalies de design / UX déséquilibrées

- **Income-tax** : layout `md:grid-cols-5` avec form `col-span-3` (8+ champs en 2 colonnes) et résultats `col-span-2` (2 tuiles + détail) → colonne droite trop courte, beaucoup d'espace vide → "déséquilibré".
- **Source-tax** : même `5/3+2` mais form bien plus court (4 champs) → cette fois la colonne droite déborde plus que la gauche.
- **Solution** : passer à un layout adaptatif `md:grid-cols-12` avec form `col-span-7` (formulaire compact en 2 colonnes) et résultats `col-span-5` (KPI cards qui s'élargissent + tableau détail dessous), OU empiler verticalement (form pleine largeur en haut, résultats pleine largeur en dessous, lecture broker → client plus naturelle).
- Les `NumField` ont un padding interne hétérogène entre source-tax (`<BaseNumField>` direct) et income-tax (wrapper `NumField`).

---

### C. Synchronisation fiche client → calculateurs

État audité dans `to-calculator-input.ts` :

| Calculateur | Champs synchronisés | À ajouter |
|---|---|---|
| income-tax | canton, statut, confession, salaires, 3a, hypothèque, fortune | `bonus`, `age` (depuis dob), `lppPlan` (depuis `client_pension.lpp_plan`), confession conjoint |
| source-tax | canton, scale, salaires, conjoint, enfants, église, frontalier | barème par défaut C (couple biactif) au lieu de B |
| cross-border | canton, statut, salaires | `country_of_residence` pour distinguer FR/IT |
| TOU | hérite income-tax | OK |
| LPP | canton, statut, dob→âge, salaires, balance, capacité, conversion | confession (pour calcul fiscal du rachat) |
| Libre passage | canton, balance vested, années | statut civil (taux prestation) |
| Pilier 3a | canton, salaire, contrib, balance, hasLPP | **taux marginal depuis snapshot** (manquant) |
| Comparateur cantonal | canton ref, statut, salaires, fortune | confession, enfants pour wealth |
| Retraite | canton, statut, capital | OK + snapshot fiscal déjà fait |
| AVS/AI | dob, salaires, contribution start, couple | gender conjoint, lacunes |
| Société/dirigeant | non lié à un client (lié à `companies`) | rattacher dirigeant via `client_id` |

---

### D. Plan d'exécution étape par étape

#### Étape 1 — Recalibrage barèmes ICC (priorité 1, impact maximal)
1. Réécrire `VD_SINGLE`, `VD_MARRIED`, `GE_SINGLE`, `GE_MARRIED`, `VS_SINGLE`, `VS_MARRIED`, `FR_*` dans `cantons.ts` à partir des grilles officielles 2026 (LI VD art. 47, LIPP GE art. 41A, LF VS art. 32, LICD FR art. 36).
2. Implémenter le **splitting GE** (couple : `2 × impôt(revenu/2)`) via flag `splittingFactor: 2` sur la `CantonTaxScale`, appliqué dans `computeCantonalCommunal`.
3. Ajouter `churchRateCatholic` et `churchRateProtestant` corrects pour GE (4.7 %), VD (8.5 %), FR (10 %), VS (3 %).
4. Calibrer NE et JU avec barèmes réels (sortir de `genericProgressive`).
5. Corriger la déduction fédérale enfants IFD (6 700 CHF déduits du revenu IFD avant `computeIFD`).
6. Tests de régression : ajouter `src/lib/tax/income.test.ts` avec 8 cas (GE/VD/VS célib/marié bas/moyen/haut revenu) avec valeurs cibles ± 5 %.

#### Étape 2 — Source tax mapping
1. Dans `toSourceTaxInput`, défaut C si marié biactif, B si marié monoactif.
2. Toujours pré-remplir `spouseMonthlyGross` même si scale ≠ C (pour bascule dynamique).
3. Afficher le champ conjoint en grisé/désactivé (et non masqué) hors barème C, avec tooltip "actif uniquement pour le barème C".

#### Étape 3 — Snapshot fiscal généralisé
1. Étendre `useClientFiscalSnapshot` aux calculateurs Pilier 3a, LPP (rachat), Société (rachat dirigeant).
2. Afficher dans chaque calculateur un encart "Taux marginal fiscal estimé : XX % (source : dernière simulation impôt revenu/source du dd/mm/yyyy)".

#### Étape 4 — Refonte layout calculateurs (rééquilibrage design)
1. Passer income-tax, source-tax, lpp, retirement, pillar3a, vested-benefits, canton-compare au layout `md:grid-cols-12` avec colonne form 7 et colonne résultats 5, ET les KPI cards en grille 2×N pour remplir verticalement.
2. Harmoniser tous les inputs sur `BaseNumField` direct (supprimer le wrapper `NumField` local d'income-tax qui duplique la logique).

#### Étape 5 — Compléments synchronisation client
1. Ajouter `bonus`, `age`, `lppPlan`, `confession_conjoint` aux mappers concernés.
2. Pré-remplir le frontalier FR depuis `country_of_residence`.

#### Étape 6 — Module Rachats LPP dirigeant (society)
1. Ajouter section dans `director-compensation.tsx` (capacité rachat, rachat annuel, horizon 1/5/retraite).
2. Logique `src/lib/director-compensation/buyback.ts` : sortie société = rachat brut + charges sociales évitées (rachat = part employé du salaire), économie impôt perso = rachat × taux marginal (snapshot), comparaison vs dividende (réduction 30 % GE / 50 % VD).
3. Tableau récap année 1 / 5 / retraite + intégration PDF.

#### Étape 7 — Détails restants
- Corriger taux prestation capital LPP/3a/LP (1/5 du barème ordinaire) dans `cantons.ts`.
- Ajouter wealth tax au KPI résumé du comparateur cantonal.
- Garde-fou rachat LPP > capacité.
- Bandeaux warning : frontalier source non déductible, retraite anticipée pénalité, etc.

#### Étape 8 — Validation finale
- Re-passer le script `audit.mjs` avec les valeurs cibles.
- Tester un parcours complet : créer fiche client GE marié 2 enfants 100k+80k → ouvrir successivement income-tax, source-tax, LPP, 3a, retraite, comparateur → vérifier cohérence des chiffres et synchronisation.

---

### E. Détails techniques (fichiers impactés)

- `src/lib/tax/cantons.ts` (recalibrage + splitting)
- `src/lib/tax/income.ts` (déduction enfants IFD)
- `src/lib/tax/source.ts` (mapping C/B + champ conjoint visible)
- `src/lib/tax/income.test.ts` (NEW, régression)
- `src/lib/clients/to-calculator-input.ts` (compléments mapping)
- `src/hooks/useClientFiscalSnapshot.ts` (déjà OK, à brancher partout)
- `src/components/calculators/CalcUI.tsx` (peut-être nouveau composant `CalcLayout`)
- `src/routes/_app/calculators/{income-tax,source-tax,lpp,pillar3a,retirement,vested-benefits,canton-compare,director-compensation,cross-border,tou,avs-ai}.tsx`
- `src/lib/director-compensation/buyback.ts` (NEW)
- `src/lib/i18n/{fr,de,en,it}.ts`

---

### F. Question préalable

L'étape 1 (recalibrage des barèmes) est de loin la plus impactante : elle suppose de remplacer les barèmes simples actuels par les grilles officielles 2026 ligne par ligne (~50 paliers à entrer pour GE, VD, VS, FR, NE, JU). C'est faisable aujourd'hui mais représente ~30-40 % de l'effort total. **Confirmer avant lancement** :

- **Option A** : recalibrage exhaustif des 6 cantons romands + tests de régression (effort important, précision finale ± 5 % vs calculateurs officiels).
- **Option B** : recalibrage GE/VD/VS uniquement (top 3 utilisation), génériques affinés pour FR/NE/JU avec bandeau "estimation", puis affiner FR/NE/JU dans une 2e itération.

Je recommande **Option A** pour atteindre ton objectif "finaliser tout le côté calcul aujourd'hui", mais l'exécution prendra plus de temps. Confirme l'option et je lance toutes les étapes en séquence.