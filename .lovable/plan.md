# Plan — PDFs personnalisables, fiche client enrichie, libre passage

## 1. Profil courtier — champs et personnalisation PDF

**Migration `profiles`** : ajouter
- `company_name TEXT` (déjà couvert par `brokerage_name`, on le réutilise — pas de nouveau champ)
- `pdf_primary_color TEXT` (hex, défaut `#0F4C81`)
- `pdf_accent_color TEXT` (hex, défaut `#3B82F6`)
- `pdf_footer_note TEXT` (mention légale optionnelle)

**Page `/account`** : nouveau bloc « Personnalisation des rapports PDF »
- 2 color-pickers (primaire / accent) avec aperçu live d'un mini header
- Champ texte note de pied de page
- Réutilise `brokerage_name`, `first_name`, `last_name`, `phone`, `email` déjà présents

## 2. Refonte du moteur PDF (`src/lib/pdf/builder.ts`)

Problème actuel : chevauchements de texte, header non personnalisé, pas de logo couleur, pas de séparation logique.

**Nouveau `PdfBuilder`** :
- Marges normalisées (20mm), grille verticale avec curseur `y` auto-incrémenté → fini les chevauchements (chaque `addSection`/`addKpiTable`/`addParagraph` recalcule la hauteur et déclenche `addPage()` automatique si dépassement)
- Header coloré (bandeau `pdf_primary_color`) avec : nom complet courtier, cabinet, email/téléphone, et titre du rapport sur fond couleur
- Footer fixe : pagination + `pdf_footer_note` + date génération
- API helpers : `addClientBlock(client)`, `addSituationBlock(...)` (situation actuelle), `addProjectionBlock(...)` (projection), `addSimulationBlock(simulation)` (carte par simulation enregistrée)

**Hook `useBrokerPdfHeader()`** : lit le profil + cache, retourne `PdfHeaderInfo` enrichi (couleurs + identité) à passer à toutes les fonctions `export*Pdf`.

## 3. Structure de contenu — « Situation vs Projection »

Chaque rapport calculateur reprend la même trame :

```
1. En-tête courtier (couleur charte)
2. Identité client (si clientId)
3. SITUATION ACTUELLE   ← encadré gris clair
   - Données saisies
   - Résultats à date
4. PROJECTION           ← encadré couleur primaire
   - Hypothèses (durée, rendement, rachats…)
   - Résultats projetés
5. RECOMMANDATIONS / KPI clés
6. Note méthodologique + footer
```

Modification de `src/lib/pdf/reports.ts` : chaque `export*Pdf` regroupe les sections en deux blocs visuels distincts.

## 4. Rapport client consolidé (multi-simulations)

**Nouveau bouton fiche client** : « Exporter rapport global PDF »
- Récupère toutes les `simulation_history` du client (déjà en place)
- Génère **un seul PDF** structuré :
  - Page 1 : couverture + identité + sommaire
  - Page 2 : synthèse fiscale globale (KPI agrégés)
  - Pages suivantes : un bloc par simulation enregistrée, regroupé par catégorie (Impôts → Prévoyance → Retraite)
- Réutilise `extractKpis()` de `src/lib/history/registry.ts`

Les simulations non sauvegardées n'apparaissent jamais (comportement déjà correct).

## 5. Année d'arrivée en Suisse + années de cotisation AVS

**Migration `clients`** : ajouter
- `arrival_year_ch INTEGER NULL` (résident)
- `cross_border_start_year INTEGER NULL` (frontalier)
- `avs_contribution_start_year INTEGER NULL` (override manuel si ≠ arrivée)

**ClientWizard** : étape « Statut fiscal » → si `tax_status = resident` afficher arrivée Suisse, si `cross_border` afficher début activité CH. Champ optionnel « Début cotisation AVS » (sinon dérivé : max(arrival_year, year_of_18_birthday)).

**`toAvsAiInput`** : mappe `contributionStartYear` depuis le client → le champ se pré-remplit ET reste persistant (il vient du dossier client, pas d'un état local volatile).

**Calculateur AVS standalone** (sans clientId) : on garde la valeur en `localStorage` (clé `avs.contributionStartYear`) pour qu'elle ne s'efface pas entre sessions.

## 6. Recherche d'avoir libre passage (oubli passage précédent)

Sur `/calculators/vested-benefits` et dans la wiki :
- Bloc info avec lien officiel **Centrale du 2ᵉ pilier** : `https://www.zentralstelle.ch/fr/`
- Texte explicatif : démarche gratuite pour retrouver les avoirs LPP/libre passage oubliés
- Bouton CTA externe (target=_blank, rel=noopener)
- Tooltip dans `LppCalculator` (avoir actuel = 0) suggérant cette recherche
- Traduit FR/DE/EN/IT

## Détails techniques

| Fichier | Action |
|---|---|
| `supabase/migrations/...` | ALTER profiles + ALTER clients (3 champs chacune) |
| `src/routes/_app/account.tsx` | bloc personnalisation PDF (couleurs + footer) |
| `src/lib/pdf/builder.ts` | refonte avec curseur y auto + couleurs dynamiques |
| `src/lib/pdf/reports.ts` | sections Situation/Projection systématiques |
| `src/lib/pdf/client-report.ts` (nouveau) | rapport global multi-simulations |
| `src/hooks/useBrokerPdfHeader.ts` (nouveau) | charge profil + couleurs |
| `src/components/clients/ClientWizard.tsx` | nouveaux champs années |
| `src/lib/clients/to-calculator-input.ts` | mappe nouveaux champs vers AVS |
| `src/routes/_app/calculators/avs-ai.tsx` | localStorage fallback |
| `src/routes/_app/calculators/vested-benefits.tsx` | bloc recherche centrale 2P |
| `src/routes/_app/calculators/lpp.tsx` | tooltip recherche centrale 2P si avoir = 0 |
| `src/lib/i18n/{fr,de,en,it}.ts` | nouvelles clés (~40) |

## Périmètre exclu
- Pas de logo image uploadable (uniquement couleurs + texte) — peut être ajouté ultérieurement
- Pas de templates PDF multiples — un seul layout, juste recoloré

## Validation finale en preview
1. Account → modifier couleurs → exporter un PDF impôt revenu → vérifier header coloré
2. Fiche client avec 3 simulations enregistrées → bouton « rapport global » → 1 PDF cohérent
3. Wizard client → renseigner arrivée 2018 → AVS calculator pré-rempli → quitter/revenir → valeur conservée
4. Calculateur libre passage → lien centrale 2P visible et cliquable
