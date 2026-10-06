-- Allocations familiales annuelles déclarées par le client (CHF/an), saisies
-- telles quelles par le courtier pendant l'entretien — voir Fiscal Global
-- (src/lib/tax-global) : pour un salarié, déjà comprises dans
-- gross_annual_salary (chiffre 1 du certificat de salaire, confirmé ESTV) ;
-- pour un indépendant, revenu distinct ajouté au calcul.
alter table public.clients
  add column family_allowances numeric;

comment on column public.clients.family_allowances is
  'Allocations familiales annuelles déclarées par le client (CHF/an). Salarié : déjà comprises dans gross_annual_salary, affichées à titre de repère uniquement. Indépendant : revenu distinct, ajouté au calcul fiscal.';
