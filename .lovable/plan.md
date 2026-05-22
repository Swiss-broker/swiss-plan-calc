# Plan approuvé · Implémentation

Tu as approuvé le plan : j'ajoute le split-screen Actuel vs Projeté sur le Calculateur Fiscal Global, plus deux extras demandés.

## 1. Comparateur Actuel vs Projeté sur tax-global

Nouveau composant `src/components/calculators/TaxGlobalCompareCard.tsx` injecté sous la zone résultats. Il calcule un scénario optimisé en appelant `computeTaxGlobal()` une seconde fois avec :

- **3a** porté au plafond légal 2026 (7 258 CHF affilié LPP, 36 288 CHF sinon).
- **Rachat LPP** = `min(capacité fiche client, 25 % du brut)` étalé sur 3 ans.
- **3b** au plancher 3 500 CHF (forfait cantonal indicatif) si pas saisi.
- **Frais santé** au forfait 3 500 CHF si pas saisi.

Affichage via `SplitCompareLayout` (déjà utilisé sur pillar3a et ConsolidatedBenefits) :

```text
                ACTUEL              PROJETÉ        Δ
Impôt total     10'605 CHF          7'200 CHF      −3'405 (vert)
IFD             …                   …
Cantonal+comm.  …                   …
Charges santé   3'586 CHF           3'586 CHF
Net annuel      119'809 CHF         123'214 CHF    +3'405
Taux effectif   7.9 %               5.4 %          −2.5 pp
Taux marginal   26.9 %              …
```

Bandeau bas : Économie annuelle / Gain net cash / Réduction d'impôt en %.
Footnote : décomposition des leviers (3a +X, LPP +Y, 3b +Z).

## 2. Petits « i » d'information partout

Chaque badge cible et chaque tuile du comparateur reçoit un `<HelpDot tip="...">` avec une explication claire :

- **Cible 3a** : rappelle le plafond 2026 et l'effet sur le revenu imposable.
- **Rachat LPP** : explique l'étalement 3 ans et le blocage art. 79b LPP.
- **Cible 3b** : explique l'agrégation au plafond commun cantonal.
- **Forfait santé** : explique le forfait cantonal LAMal + LCA.

Plus une légende sous le titre du comparateur expliquant les pastilles vertes/rouges.

Encarts amber/rouge contextuels :
- **Frontalier GE / IS** : « démarche TOU ou rectification IS requise avant le 31 mars ».
- **Accord 1983** : « déductions CH sans effet, scénario affiché à titre informatif ».

## 3. Nettoyage des tirets cadratins « — » dans toute l'application

252 occurrences détectées dans `src/`. Remplacement global du tiret cadratin entouré d'espaces (` — `) par `. ` (point + espace) ou `, ` selon le contexte grammatical. Couvre :

- Tooltips et bulles d'information (`tip="..."`).
- Libellés et descriptions dans `src/lib/i18n/*.ts`.
- Notes et avertissements dans les calculateurs.
- Commentaires JSDoc des moteurs (pour cohérence).

Vérification après le pass : pas de double point, pas de tiret orphelin résiduel, fichiers parseables (build vert).

## Fichiers touchés

- **Nouveau** : `src/components/calculators/TaxGlobalCompareCard.tsx`.
- **Modifié** : `src/routes/_app/calculators/tax-global.tsx` (1 import + 1 ligne d'insertion).
- **Nettoyage tirets** : ~30 fichiers `.ts` / `.tsx` touchés par sed scripté + relecture ciblée.

Aucun changement DB, aucune modif des autres calculateurs.
