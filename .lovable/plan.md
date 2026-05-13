# Audit du projet — points à améliorer

Globalement le socle est solide (calculateurs cantonaux, fiche client, prefill, synthèse PDF, comparateur d'investissements intégré). Voici ce que j'améliorerais, par ordre de priorité.

## 1. Cohérence des calculs (priorité haute)

**a. Source unique de vérité pour le revenu imposable**
Aujourd'hui plusieurs endroits recomposent le revenu (salaire + bonus + 13e + autres) : `to-calculator-input.ts`, `canton-compare`, formulaire impôts, prévoyance. Risque d'écarts entre écrans.
→ Centraliser dans `src/lib/clients/income.ts` : `getGrossIncome(client)`, `getTaxableIncome(client, deductions)`. Tous les calculateurs l'appellent.

**b. Impôt sur prestation 2e pilier — vérifier tous les cantons**
On a corrigé la prise en compte du montant projeté LPP+rachats. À auditer : barèmes par canton, séparation capital/rente, prise en compte de l'âge et de l'état civil dans `tax-prestation`.

**c. Comparateur cantonal — déductions sociales**
Vérifier que AVS/AI/APG, AC, LAA, LPP sont déduites de manière homogène avant impôt cantonal/communal/fédéral pour les 26 cantons.

**d. Arrondis & devises**
Standardiser via `src/lib/format/money.ts` (CHF, 2 décimales, arrondi bancaire) au lieu d'arrondis ad-hoc.

## 2. Suivi client (priorité haute)

**a. Historique des simulations versionné**
Aujourd'hui on sauvegarde une simulation par calculateur. Ajouter : versions horodatées, libellé ("avant rachat", "scénario A"), possibilité de comparer 2 versions côte à côte.

**b. Indicateurs de fraîcheur**
Badge "données client modifiées depuis la dernière simulation" sur `ClientCalculatorBar` pour inviter à rafraîchir.

**c. Synthèse PDF — table des matières + page de garde**
Ajouter sommaire cliquable, page de garde avec logo conseiller, signature et date de validité.

**d. Export Excel des simulations**
Pour les conseillers qui veulent retravailler les chiffres.

## 3. Sécurité (priorité haute)

**a. Audit RLS systématique**
Lancer le scanner sur toutes les tables (`clients`, `simulations`, `synthesis_reports`...) et vérifier que chaque policy filtre par `auth.uid()`. Aujourd'hui je n'ai pas la garantie que toutes les tables sont couvertes.

**b. Rôles dans une table dédiée**
Si des rôles existent (admin, conseiller), s'assurer qu'ils sont dans `user_roles` + fonction `has_role()` SECURITY DEFINER, jamais sur `profiles`.

**c. Validation côté serveur**
Toutes les server functions doivent valider les entrées avec Zod (montants > 0, années plausibles, canton dans liste blanche). À auditer.

**d. PII dans les logs**
Vérifier qu'aucun `console.log` ne sort nom/AVS/revenu en clair côté serveur.

**e. Rate limiting sur génération PDF**
Les générations PDF sont coûteuses — protéger contre l'abus.

## 4. UX & qualité (priorité moyenne)

- Validation visuelle dans les formulaires (revenu négatif, âge incohérent)
- Tooltips explicatifs sur les champs fiscaux complexes (rachat LPP, pilier 3a max)
- Mode "comparaison rapide" entre 2 scénarios sur la même fiche client
- i18n : vérifier que les 4 langues (fr/de/it/en) sont à jour sur les nouveaux libellés du comparateur d'investissements

## 5. Tests (priorité moyenne)

- Couverture des fonctions de calcul fiscal par canton (snapshots de référence)
- Tests d'intégration prefill → calculateur → synthèse
- Tests de non-régression sur 2-3 profils clients types

## 6. Performance (priorité basse)

- Lazy-load des routes calculateurs lourds
- Mémoïser les calculs cantonaux dans `canton-compare` (recalcul à chaque keystroke aujourd'hui ?)

---

## Ce que je propose comme prochaine étape

Dis-moi lequel de ces blocs tu veux que j'attaque en premier. Ma recommandation :
1. **Section 1a** (source unique du revenu) — élimine la classe de bugs que tu rencontres
2. **Section 3a + 3b** (audit RLS + rôles) — sécurité avant tout
3. **Section 2a** (historique versionné des simulations) — vraie valeur métier

Sinon, si pour toi tout est fonctionnellement OK aujourd'hui, on peut s'arrêter là et ne traiter que les bugs au cas par cas.
