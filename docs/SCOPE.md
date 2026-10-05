# Scope V1 — Suisse romande

## Périmètre fonctionnel

La v1 cible exclusivement la **Suisse romande** : 6 cantons sélectionnables comme canton de domicile / travail, plus **Zoug**, **Schwyz** et **Berne** comme cantons de référence dans le comparateur cantonal uniquement.

| Canton | Code | Sélectable (domicile/travail) | Comparable (ranking) |
|--------|------|:-----------------------------:|:--------------------:|
| Genève | GE | ✅ | ✅ |
| Vaud | VD | ✅ | ✅ |
| Valais | VS | ✅ | ✅ |
| Fribourg | FR | ✅ | ✅ |
| Neuchâtel | NE | ✅ | ✅ |
| Jura | JU | ✅ | ✅ |
| Zoug | ZG | ❌ | ✅ (référence fiscalité optimisée, suggéré par l'optimiseur) |
| Schwyz | SZ | ❌ | ✅ (référence fiscalité optimisée) |
| Berne | BE | ❌ | ✅ (référence) |

Les 17 autres cantons restent listés dans `src/lib/swiss/cantons.ts` (flags `selectable=false`, `comparable=false`) pour préserver l'architecture multi-cantons. Ils ne sont jamais affichés à l'utilisateur en v1.

## Architecture

### Source de vérité
- `src/lib/swiss/cantons.ts` — liste des 26 cantons + flags + helpers `getSelectableCantons()` / `getComparableCantons()` + types `SelectableCantonCode` / `ComparableCantonCode` + garde-fou runtime de cohérence flags ↔ codes typés.

### Données fiscales
- `src/lib/tax/cantons.ts` — `CANTON_SCALES` : 9 entrées, toutes sur barème officiel réel (Feuille cantonale AFC) : 6 romands sélectionnables + ZG, SZ, BE comparables. Plus de barème générique/calibré depuis la vérification GE/VS/ZG/SZ — voir l'en-tête du fichier pour la méthodologie de calibration historique, encore utilisée par BE.
- `src/lib/tax/source.ts` — coefficients impôt à la source : 6 cantons romands.
- `src/lib/tax/cross-border.ts` — accords frontaliers FR : sous-ensemble romand + GE.

### UI
- Tous les sélecteurs de canton consomment `getSelectableCantons()` (jamais `CANTONS` directement).
- Le comparateur cantonal consomme `getComparableCantons()`.
- L'optimiseur (`src/lib/optimizer/index.ts`) suggère uniquement ZG comme alternative de domicile fiscal (hardcodé, pas SZ/BE) — voir la règle d'invariance n°4 ci-dessous.

## Procédure d'ajout d'un canton (v1.5+)

Pour ajouter un canton hors scope (exemple : ZH, BS) comme `selectable`, ou rendre `selectable` un canton déjà `comparable` (ZG, SZ, BE), suivre cette checklist dans l'ordre — l'étape a) est déjà faite pour ZG/SZ/BE puisqu'ils ont un barème réel :

### a) Compléter les barèmes ICC
Dans `src/lib/tax/cantons.ts`, ajouter une entrée dans `CANTON_SCALES` :
- `single` / `married` (barèmes progressifs validés vs calculateur officiel, écart < 2 %)
- `cantonalMultiplier` / `communalMultiplierCapital` (chef-lieu, année courante)
- `wealthScale`, `wealthExemptionSingle/Married`
- `childDeduction`, `marriedDeduction`, `capital`
- `churchRateCatholic` / `churchRateProtestant` si applicable

### b) Ajouter les barèmes IS si `selectable`
Dans `src/lib/tax/source.ts`, ajouter les coefficients IS A/B/C/H pour le canton.

### c) Mettre à jour `cantons.ts`
Dans `src/lib/swiss/cantons.ts` :
1. Passer `selectable: true` et/ou `comparable: true` dans `CANTONS`.
2. Ajouter le code dans `SELECTABLE_CANTON_CODES` et/ou `COMPARABLE_CANTON_CODES`.
3. Le garde-fou runtime vérifiera la cohérence au boot.

### d) Ajouter la traduction `canton.XX` dans `src/lib/i18n/fr.ts`
Ajouter la clé `canton.XX` avec le nom français officiel.

### e) Écrire les fixtures de tests
Dans `src/lib/swiss/cantons.test.ts` (et fichiers dérivés) :
- Fixture profil type pour le canton (salaire 100k, single).
- Snapshot du calcul d'impôt revenu + fortune.
- Vérification que le canton apparaît dans les sélecteurs UI.

### f) Mettre à jour ce document
Ajouter une ligne dans le tableau ci-dessus, retirer le canton de la liste "à venir" dans l'encart roadmap du comparateur (`canton-compare.tsx`) et dans les libellés marketing.

## Procédure de mise à jour annuelle (nouvelle année fiscale)

**État actuel, à bien comprendre avant de commencer** : le moteur ne gère
qu'UNE SEULE année fiscale à la fois — `computeIFD`, `CANTON_SCALES`,
`JU_IS_RATES_2026`, etc. n'ont pas de paramètre "année" ; ce sont les
barèmes 2026, point. Passer à 2027 veut dire REMPLACER ces valeurs, pas
en ajouter une version parallèle consultable. Si le besoin se présente un
jour de recalculer un ancien dossier client sur le barème d'une année
révolue (ex. un contrôle fiscal 2026 fait en 2028), le moteur ne le
permettra pas tel quel — ça demanderait de vrais barèmes versionnés par
année (voir le `tax_year` de la base Supabase, prévu mais non câblé).
Ce qui suit est donc un garde-fou pour éviter d'écraser 2026 PAR ERREUR
en mettant à jour pour 2027, pas une solution de versionnement complète.

### Avant de toucher un seul chiffre
1. `npx vitest run` doit être 100% vert. Si ce n'est pas le cas, régler
   d'abord (ne jamais mettre à jour une année fiscale sur une base de
   tests déjà rouge — impossible de distinguer ensuite "régression
   introduite par la mise à jour" de "problème préexistant").
2. Committer et pousser l'état actuel (le dernier commit "année 2026"
   doit être retrouvable dans l'historique git — c'est la sauvegarde,
   pas un fichier `.backup` à maintenir à la main).

### Pendant la mise à jour
3. Mettre à jour les constantes (`IFD_SINGLE_2026` → nouvelles valeurs
   2027, `CANTON_SCALES`, `JU_IS_RATES_2026`, `COMMUNAL_MULTIPLIERS`,
   etc.) avec leurs sources officielles en commentaire, exactement comme
   pour les barèmes 2026 déjà en place.
4. Relancer `npx vitest run`. Les tests qui échouent maintenant ne sont
   PAS un bug — ce sont `reference-cases.test.ts`, `brackets.test.ts`,
   `cantons.test.ts`, `source.test.ts` qui réagissent normalement à des
   barèmes qui ont changé. Pour chacun, vérifier le nouvel écart contre
   une source officielle, puis régénérer consciemment la valeur attendue
   (jamais juste "faire passer le test" sans avoir vérifié le nouveau
   chiffre — voir l'avertissement en tête de `reference-cases.test.ts`).
5. Un test qui reste VERT après une mise à jour de barème pour le canton
   concerné est suspect : soit le test ne couvre pas vraiment ce barème,
   soit la constante n'a pas été mise à jour au bon endroit.

### Après la mise à jour
6. Renommer les constantes `_2026` en `_2027` partout où c'est le cas
   (cohérence du nom avec le contenu — ne pas laisser une constante
   `IFD_SINGLE_2026` contenir des valeurs 2027).
7. Mettre à jour le commentaire de calibration en tête de `cantons.ts`
   (date, méthode, nombre de cas de référence) s'il y a eu une nouvelle
   campagne de calibration.
8. Un commit séparé par canton/barème touché plutôt qu'un seul commit
   générique "mise à jour 2027" — ça permet de retrouver facilement quel
   commit a changé quel chiffre si un écart est signalé plus tard.

## Règles d'invariance (garde-fous)

1. **Aucun composant UI ne doit importer `CANTONS` directement** pour afficher des options de sélection. Toujours passer par `getSelectableCantons()` ou `getComparableCantons()`.
2. **Les flags `selectable` et `comparable`** dans `CANTONS` doivent rester synchrones avec `SELECTABLE_CANTON_CODES` et `COMPARABLE_CANTON_CODES` (vérifié au boot).
3. **`CANTON_SCALES` doit contenir au minimum tous les cantons `comparable`**. Sinon, `computeIncomeTax` jette une erreur explicite et le ranking ignore silencieusement le canton (warn console).
4. **Pas de hardcode de codes canton hors scope** dans les listes d'alternatives (optimiseur, suggestions de déménagement, etc.). Toute liste codée en dur doit être restreinte aux codes `comparable`.

## Bug history (à éviter en v1.5)

- ❌ Filtrer `CANTONS` à la main dans chaque composant → utilisez les helpers.
- ❌ Importer `CANTON_SCALES` pour itérer sur "tous les cantons disponibles" → utilisez `getComparableCantons()`.
- ❌ Suggérer un canton dans l'optimiseur (`src/lib/optimizer/index.ts`) sans avoir vérifié que son barème est chargé dans `CANTON_SCALES` **et** réel (pas générique/calibré) → risque de conseiller une relocalisation fiscale à un client sur la base d'un chiffre approximatif. SZ a par exemple eu un barème générique jusqu'à vérification complète (voir historique git) ; ZG/SZ/BE sont désormais tous sur barème officiel réel, mais toute future addition à l'optimiseur doit repasser par cette vérification avant d'être suggérée.
