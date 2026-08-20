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

## Règles d'invariance (garde-fous)

1. **Aucun composant UI ne doit importer `CANTONS` directement** pour afficher des options de sélection. Toujours passer par `getSelectableCantons()` ou `getComparableCantons()`.
2. **Les flags `selectable` et `comparable`** dans `CANTONS` doivent rester synchrones avec `SELECTABLE_CANTON_CODES` et `COMPARABLE_CANTON_CODES` (vérifié au boot).
3. **`CANTON_SCALES` doit contenir au minimum tous les cantons `comparable`**. Sinon, `computeIncomeTax` jette une erreur explicite et le ranking ignore silencieusement le canton (warn console).
4. **Pas de hardcode de codes canton hors scope** dans les listes d'alternatives (optimiseur, suggestions de déménagement, etc.). Toute liste codée en dur doit être restreinte aux codes `comparable`.

## Bug history (à éviter en v1.5)

- ❌ Filtrer `CANTONS` à la main dans chaque composant → utilisez les helpers.
- ❌ Importer `CANTON_SCALES` pour itérer sur "tous les cantons disponibles" → utilisez `getComparableCantons()`.
- ❌ Suggérer un canton dans l'optimiseur (`src/lib/optimizer/index.ts`) sans avoir vérifié que son barème est chargé dans `CANTON_SCALES` **et** réel (pas générique/calibré) → risque de conseiller une relocalisation fiscale à un client sur la base d'un chiffre approximatif. SZ a par exemple eu un barème générique jusqu'à vérification complète (voir historique git) ; ZG/SZ/BE sont désormais tous sur barème officiel réel, mais toute future addition à l'optimiseur doit repasser par cette vérification avant d'être suggérée.
