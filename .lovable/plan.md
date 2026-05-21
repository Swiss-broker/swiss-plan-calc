
## Diagnostic — pourquoi les déductions ne changent rien

J'ai relu `engine.ts`, `scenarios.ts` et `cross-border.ts`. Le bug est confirmé et il vient bien du moteur, pas de l'UI.

**Ce qui se passe aujourd'hui selon le régime détecté :**

| Régime | LPP / 3a / hypo / santé / dons pris en compte ? |
|---|---|
| **Résident ordinaire** (permis C ou Suisse, résidence CH) | ✅ OUI — passe par `computeIncomeTax(toIncomeTaxInput(g))` |
| **Source / quasi-résident** (permis B/L, résidence CH) | ⚠️ NON par défaut. Les déductions ne sont prises en compte QUE si la TOU est éligible (≥90 % CH) ET avantageuse. Sinon l'impôt = retenue source brute, et le KPI ne bouge pas d'un franc. |
| **Frontalier GE** | ❌ NON. `computeCrossBorder` ne reçoit que salaire + statut + enfants + conjoint. Tout le reste est ignoré silencieusement. |
| **Frontalier accord 1983 (VD/VS/FR/NE/JU)** | ❌ NON. Idem : 4.5 % retenu sur le brut, le reste est imposé en France sur `(brut × 0.9)` sans aucune déduction CH. |
| **Frontalier autre** | ❌ NON. Idem. |

C'est pour ça que peu importe ce que tu tapes dans « Rachat LPP » ou « Intérêts hypothécaires », tu vois le même chiffre dans la synthèse et le même delta nul dans les scénarios. Le client courant (`09278d25...`) est très probablement frontalier ou imposé à la source.

---

## Ce que je vais corriger

### 1. Brancher les déductions sur tous les régimes (correction moteur)

**Régime source / quasi-résident** (`engine.ts`)
- Calculer **systématiquement** la variante ordinaire avec déductions via `toIncomeTaxInput(g)` (déjà disponible via `touComparison.ordinaryTax`).
- Si l'utilisateur saisit ≥ 1 CHF de déduction → bascule automatique de l'affichage sur le scénario ordinaire et badge « Calcul basé sur rectification IS / TOU — la déduction ne s'applique qu'avec cette démarche ».
- Si éligible TOU : badge vert. Sinon : badge orange « nécessite rectification IS » (sans bloquer l'affichage — c'est ce que veut un courtier qui simule l'effet d'un rachat).
- Le KPI bouge donc dès la première saisie.

**Frontalier GE** (`engine.ts` + `cross-border.ts`)
- Étendre `CrossBorderInput` avec les déductions CH (`pillar3aContributions`, `lppBuyback`, `mortgageInterest`, `realEstateMaintenance`, `healthInsurancePremiums`, `childCareCosts`, `donations`).
- Recalculer `genevaSourceTax` sur l'assiette nette CH (mêmes règles que TOU GE) quand au moins une déduction est saisie.
- Note explicite : « Effet appliqué uniquement si TOU GE demandée (quasi-résident ≥ 90 % revenu CH). »

**Frontalier accord 1983 (4.5 %)**
- La retenue 4.5 % CH reste insensible (c'est légal : brut × 4.5 %).
- En revanche : déduire les déductions FR-éligibles de l'assiette `taxableFR` AVANT le barème français (hypothèses : intérêts d'emprunt résidence principale FR, frais de garde FR, dons FR). Le 3a et le rachat LPP CH ne sont **pas** déductibles côté FR → on les laisse de côté avec note explicite ligne par ligne.
- Champs concernés affichent automatiquement « ⚠️ non déductible (accord 1983 : imposition exclusive France) » dans la bulle.

### 2. Bulles d'information sur chaque montant

Au niveau **inputs** (chaque champ déduction/revenu), ajout d'un tooltip `<InfoLabel tip={...}>` qui dit :
- À quoi sert le champ (« Cotisation versée sur un compte 3e pilier A en 2026 »).
- Plafond / règle (« max 7 258 CHF affilié LPP, 36 288 CHF non-affilié »).
- **Effet réel sur le calcul actuel** selon le régime détecté : « ✅ déductible intégralement », « ⚠️ déductible uniquement via TOU/rectification IS », « ❌ non déductible (accord 1983) ».

Au niveau **résultats** (carte Synthèse + carte Breakdown + Source/TOU + Frontalier), conversion de chaque `MoneyTile` / `PctTile` en version avec icône `Info` et tooltip explicatif :
- **Impôt total** : « = IFD + cantonal + communal + église + impôt fortune. Détail dans le panneau "Comment ce résultat est calculé". »
- **Net annuel** : « = Brut − impôt − charges sociales (LAMal/CMU si frontalier). Valeur locative exclue. »
- **Taux effectif** : « impôt total / revenu brut. »
- **Taux marginal** : « taux appliqué au prochain franc gagné — sert à chiffrer une optimisation. »
- **Part suisse / étrangère** : « répartition de l'impôt entre CH (retenue source) et pays de résidence (barème + crédit d'impôt). »
- **Charges sociales** : « cotisation CMU ou LAMal (frontalier uniquement). »
- **IFD / Cantonal / Fortune / Église** : formule courte + référence légale.
- **Impôt source / Taux IS** : « basé sur le barème {scale} appliqué au salaire mensuel × 12. Hors gratifications irrégulières. »
- **Éligibilité TOU** : « ≥ 90 % du revenu mondial gagné en Suisse → permet la taxation ordinaire ultérieure avec déductions. »

Composant utilisé : `MoneyTile`/`PctTile` existants étendus avec une prop optionnelle `info` qui rend un `<Tooltip>`/`<HoverCard>` autour de l'icône `Info`.

### 3. Scénarios — vérification

Avec la correction #1, `buildScenarios` produira automatiquement des deltas non nuls sur « +3a max », « +Rachat LPP 20 000 » et « +Don 5 000 » même en source/frontalier. Aucun changement de logique nécessaire dans `scenarios.ts`, juste la propagation moteur.

---

## Fichiers touchés

- `src/lib/tax-global/engine.ts` — branchement déductions source/frontalier, badge TOU implicite.
- `src/lib/tax/cross-border.ts` — extension `CrossBorderInput` + nouvelle assiette nette pour GE et accord 1983.
- `src/lib/tax-global/types.ts` — extension `TaxGlobalTrace` avec le détail des déductions appliquées/rejetées par régime.
- `src/routes/_app/calculators/tax-global.tsx` — tooltips sur tous les champs (inputs) ET sur toutes les tuiles (résultats). Note d'avertissement automatique dans la section Déductions quand le régime est source ou frontalier accord 1983.
- `src/components/calculators/CalcUI.tsx` — `MoneyTile` et `PctTile` reçoivent une prop optionnelle `info?: React.ReactNode` qui rend une icône `Info` avec tooltip.
- `src/lib/i18n/{fr,en,de,it}.ts` — clés `calc.global.tip.*` pour chaque bulle (input + résultat).

## Vérification après implémentation

- Sur le client `09278d25...` (frontalier suspecté) : taper 7 056 CHF en 3a → KPI baisse, scénario « +3a max » affiche un delta cohérent.
- Saisir 20 000 CHF rachat LPP en mode résident GE puis basculer en frontalier GE → la première baisse l'impôt, la seconde affiche un delta + warning « TOU requise ».
- Aucun test unitaire existant ne doit casser (`bun test`).

## Questions

Aucune, je commence directement après ton approbation.
