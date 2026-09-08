-- La table public.clients utilise des GRANT au niveau colonne (et non un
-- GRANT global sur la table) pour le rôle authenticated. `alter table ...
-- add column` n'hérite PAS automatiquement de ces privilèges : la
-- migration précédente (20260908090000_client_income_currency.sql) a bien
-- ajouté les 4 nouvelles colonnes mais sans leur donner le droit UPDATE
-- pour authenticated, contrairement à toutes les autres colonnes de la
-- table. Résultat : l'enregistrement de la fiche client échouait avec
-- "permission denied for table clients" dès que le formulaire envoyait
-- une de ces colonnes dans son UPDATE.
grant update (
  income_currency,
  income_conversion_rate,
  spouse_income_currency,
  spouse_income_conversion_rate
) on public.clients to authenticated;
