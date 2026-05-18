## État actuel vs ta spec

La refonte précédente a déjà fait **70%** du job :
- ✅ 2 options seulement (plus de 3ᵉ tuile)
- ✅ Recommandation chiffrée CMU vs LAMal
- ✅ Détail du calcul repliable
- ✅ PDF + historique + synthèse RDV alignés sur 2 options

Mais il reste **3 écarts importants** vs ta spec officielle.

## Ce qui reste à corriger

### 1. ❌ Bug majeur sur l'abattement (formule fiscalement fausse)

Actuellement le code fait : `abattement = 27'000 € × nombre de parts fiscales`.
C'est **faux** pour la cotisation CMU frontalier, qui est **individuelle** :
- Abattement = **25% du PASS**, forfaitaire, **PAS multiplié par les parts**.
- PASS 2026 = **47'100 €** (à confirmer côté Urssaf/ameli au moment de coder).
- Donc abattement effectif = **11'775 €** quelle que soit la situation familiale.

Conséquence sur le cas test 95'000 CHF aujourd'hui : on calcule 5'820 € au lieu de **7'038 €** (6'703 CHF). LAMal sort gagnant dans les deux cas, mais le chiffre CMU est sous-estimé de ~1'200 €/an.

### 2. ❌ Libellés "CNTFS" encore visibles partout

Toujours présents dans :
- Titre du calculateur (`head meta`), titre de carte recommandée, sous-titre, tuile, encart détail
- `src/components/clients/ClientCalculatorBar.tsx` (label "CNTFS / LAMal")
- `src/lib/i18n/fr.ts | en.ts | de.ts | it.ts` (titre + description)
- `src/lib/pdf/synthesis-report.ts` (3 occurrences)
- `src/lib/pdf/reports.ts` (titre PDF "CMU/CNTFS vs LAMal")
- `src/lib/simulations/extract-gain.ts` (label "CMU/CNTFS")

Spec : ne plus utiliser "CNTFS" comme régime. Garder uniquement la mention "CMU (gérée par le CNTFS via l'URSSAF)" dans la note pédagogique.

### 3. ❌ Parts fiscales utilisées à tort

Le champ "situation civile" et "enfants à charge" pilotent encore le calcul (via parts fiscales). À transformer en **info contextuelle uniquement** (les enfants/conjoint n'impactent ni l'abattement ni l'assiette CMU). Le bloc conjoint (salaire conjoint EUR, couverture propre) doit disparaître du calcul CMU — on garde au mieux un libellé informatif.

## Plan d'implémentation

### A. Moteur `src/lib/health-france/index.ts`
1. Ajouter constante `PASS_2026_EUR = 47_100` (vérifier valeur officielle Urssaf au moment du build, ajuster si nécessaire).
2. Remplacer `cmuAbatementPerPartEUR` par `cmuAbatementRate = 0.25` (× PASS).
3. Supprimer la fonction `computeParts()` et le champ `partsFiscales` du résultat.
4. Retirer `spouseFrenchSalaryEUR` / `spouseHasOwnCoverage` du calcul (champs conservés en input mais ignorés, ou supprimés totalement — voir question).
5. Mettre à jour le `cmuBreakdown` pour refléter les 4 étapes de ta spec (RFR → PASS → abattement → assiette → cotisation).
6. Ajouter une note explicite "déclaration individuelle, basée sur revenus N-2".

### B. UI `src/routes/_app/calculators/health-insurance-france.tsx`
1. Renommer le titre → `"Assurance santé frontaliers (CMU vs LAMal)"`.
2. Sous-titre carte profil → `"Comparez la cotisation CMU (régime français géré par le CNTFS via l'URSSAF) et l'assurance privée suisse (LAMal)."`.
3. Renommer tuile "CMU/CNTFS (France)" → **"CMU (France)"**.
4. Renommer section détail → **"CMU — Cotisation maladie frontalier (Urssaf)"**.
5. Bloc conjoint : soit le retirer, soit le marquer "info contextuelle, sans impact sur la cotisation CMU".
6. Ajouter la phrase de recommandation officielle (droit d'option dans les 3 mois, lieu de consultation, ayants droit).

### C. i18n (4 langues)
Renommer dans `fr.ts | en.ts | de.ts | it.ts` :
- `calc.health_france.title` → "Assurance santé frontaliers (CMU vs LAMal)" / "Cross-border health insurance (CMU vs LAMal)" / "Krankenversicherung Grenzgänger (CMU vs LAMal)" / "Assicurazione malattia frontalieri (CMU vs LAMal)".
- Description : remplacer la mention "CMU, CNTFS et LAMal" par "CMU (gérée par le CNTFS) vs LAMal".

### D. Surfaces dérivées
- `ClientCalculatorBar.tsx` → label "CMU / LAMal".
- `extract-gain.ts` → label "Droit d'option santé : CMU vs LAMal".
- `pdf/reports.ts` → titre PDF "CMU vs LAMal", retirer "CNTFS" du titre/situation.
- `pdf/synthesis-report.ts` → remplacer "CMU/CNTFS" par "CMU" partout, garder une seule mention "(gérée par le CNTFS via l'URSSAF)" dans la phrase narrative.

### E. Cas test de validation (après code)
Inputs : 95'000 CHF, taux 1.05, LAMal 3'600 → attendu : RFR 99'750 €, abattement 11'775 €, assiette 87'975 €, cotisation **7'038 € ≈ 6'703 CHF**, reco = **LAMal**, économie ≈ 3'100 CHF/an.

## Question avant de coder

Deux points où je veux ton OK explicite avant d'implémenter :

1. **Champs conjoint** (salaire conjoint EUR + "conjoint a sa propre couverture") : je les **supprime complètement** du formulaire, ou je les garde **affichés mais désactivés/marqués "info"** ?
2. **Vérification PASS 2026** : je fige `47'100 €` (valeur communément admise pour 2026) ou tu veux que je relance un `websearch` Urssaf/ameli avant d'écrire la constante ?
