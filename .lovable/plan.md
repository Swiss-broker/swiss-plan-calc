## Audit Calculateur Fiscal Global

Verdict global : le moteur délègue proprement aux sous-calculateurs existants, mais il reste **3 zones à corriger** (prefill incomplet, scénarios partiels, KPI résident incohérents) pour que tout soit propre quel que soit le profil.

## 1. Prefill depuis la fiche client (`src/lib/clients/to-calculator-input.ts`, fn `toTaxGlobalInput`)

Aujourd'hui le mapping ignore plusieurs champs présents dans le formulaire — d'où l'impression de "pas synchronisé".

À ajouter :
- `civilStatus` : passer **les 7 statuts** (`single` / `married` / `registered_partnership` / `cohabiting` / `divorced` / `separated` / `widowed`) au lieu de forcer `single | married`. Mapper `cohabiting` depuis `civil_status` si présent en DB, sinon laisser le défaut.
- `imputedRent` ← `assets.real_estate_rental_value` quand le bien est occupé par le propriétaire (heuristique : si `real_estate_value > 0` et `real_estate_rental_value > 0`, considérer comme valeur locative ; sinon on garde 0 et c'est `rentalIncome` qui est rempli — clarifier la règle).
- `lppBuyback` ← somme de `pension.lpp_buybacks_done` de l'année en cours (déductible une seule fois).
- `healthInsurancePremiums`, `childCareCosts`, `donations` : pas en DB clients aujourd'hui → laisser à 0 (commentaire explicite : « non persisté, à saisir manuellement »).
- `foreignIncome` : pas en DB → laisser 0.
- `taxYear` : `new Date().getFullYear()`.
- `spouseEmployed` : conserver la déduction `spouseSalary > 0` ✓.
- `bonus`, `otherIncome`, `pillar3aContributions`, `mortgageInterest`, `realEstateMaintenance`, `netWealth`, `confession`, `age`, `permit`, `country`, `canton` ✓ déjà mappés.

Resserrer aussi le cast `civilStatus` côté `TaxGlobalInput` (actuellement `as "single" | "married"` qui ment au type).

## 2. Scénarios (`src/lib/tax-global/scenarios.ts`)

Corrections :
- `isMarried` ne couvre que `married` → inclure aussi `registered_partnership` pour doubler le plafond 3a (même règle fiscale CH).
- **Frontalier accord 1983 (VD/VS/NE/JU/FR)** : le 3a et le rachat LPP **ne réduisent pas** l'impôt français (imposition exclusive en France). Ne pas afficher ces scénarios pour `cross_border_fr_1983`, ou les afficher avec un libellé « pas d'impact fiscal direct » (delta = 0).
- **Frontalier GE** : 3a/LPP peuvent peser sur le calcul TOU si éligible — garder mais ajouter une note.
- Nouveau scénario universel **« CMU vs LAMal »** pour frontaliers : 2 variantes (`recommended = "CMU"` vs `"LAMal"`) avec delta sur le `socialChargesCHF` (les chiffres sont déjà dans `result.health`).
- Scénario **TOU explicite** : à proposer aussi quand baseline = `tou` (montrer le gain vs source pur) et quand baseline = `source_taxed` non éligible (afficher le scénario en grisé avec raison).
- Scénario **« Don 5 000 CHF »** pour résident ordinaire et TOU (déductible jusqu'à 20% du revenu net, illustratif).
- Scénario **« Permis C »** ✓ déjà présent, OK.

## 3. Moteur (`src/lib/tax-global/engine.ts`)

Corrections d'incohérences :
- **Résident ordinaire** : `effectiveRate` vient de `income.effectiveRate` (basé sur le revenu imposable), mais on affiche `grossIncomeCHF` calculé différemment. Recalculer `effectiveRate = totalTax / grossIncomeCHF` pour cohérence avec la tuile « Net annuel ».
- **Résident** : `socialChargesCHF` reste à 0 alors qu'on a la LAMal CH. Soit on l'ajoute via une estimation (`lamalAdultMonthlyCHF * 12 + enfants`), soit on l'expose comme une tuile « non incluse » (préférer **l'ajouter** pour aligner avec le calcul frontalier).
- **Résident avec `foreignIncome > 0`** : exposer `foreignShareCHF` = 0 mais ajouter la note "exonéré conventionnel, taux effectif". Garder la `note` actuelle ✓.
- **Source non éligible TOU** : `marginalRate` utilise `touComparison.marginalRate` (= marginal de l'ordinaire) → c'est trompeur. Utiliser `source.rate` (taux moyen IS) ou recalculer une marginale source.
- **Imputed rent (valeur locative)** : actuellement ajoutée à `grossIncomeCHF` résident → fausse le « Net annuel » (revenu fictif, pas de cash). L'exclure du gross ou afficher une tuile dédiée « dont valeur locative ».
- **Frontalier** : `crossBorder.totalTax` inclut déjà la part suisse + part étrangère, donc `swissShareCHF + foreignShareCHF ≈ totalTaxCHF` ✓ ; vérifier le côté GE où `foreignTax` n'est qu'une estimation (le noter dans `notes`).

## 4. UI (`src/routes/_app/calculators/tax-global.tsx`)

- Afficher la tuile **Santé recommandée** (LAMal CH) aussi pour les résidents (pas seulement frontaliers).
- Afficher le bloc **Charges sociales** dès qu'il existe (pas conditionné à `isFrontalier`).
- Utiliser `showFortune` pour masquer le champ « Fortune nette » dans les régimes source/frontalier où la fortune n'entre pas dans le calcul.
- Ajouter dans la pill du régime détecté la justification (`result.notes[0]`) en tooltip.

## 5. Vérifs sans code

- `usePrefillFromClient(clientId, "tax-global")` ✓ branché.
- `KIND_LABELS` / `KIND_ROUTES` (historique) : ne pas créer de kind `tax_global` (éviterait une migration enum DB) — continuer à logger sous `income_tax`.
- Routes des 4 anciens calculateurs : conservées (déjà décidé).

## Fichiers modifiés

- `src/lib/clients/to-calculator-input.ts` (toTaxGlobalInput)
- `src/lib/tax-global/scenarios.ts`
- `src/lib/tax-global/engine.ts`
- `src/routes/_app/calculators/tax-global.tsx`