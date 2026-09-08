-- Devise de saisie des revenus (client et conjoint), pour les clients
-- frontaliers qui pensent/parlent en euros. Les colonnes de revenu
-- existantes (gross_annual_salary, bonus, other_income,
-- spouse_gross_annual_salary) restent TOUJOURS en CHF : c'est ce que
-- tous les calculateurs et le tableau de bord lisent déjà, donc rien ne
-- change de leur côté. Ces nouvelles colonnes ne servent qu'à
-- l'affichage/ré-édition côté fiche client : income_currency indique
-- dans quelle devise le courtier saisit (client) ; income_conversion_rate
-- garde le taux utilisé pour la dernière conversion EUR -> CHF, pour
-- pouvoir recalculer l'équivalent EUR affiché (CHF stocké / taux) sans
-- perdre le montant d'origine. Même logique côté conjoint.
alter table public.clients
  add column income_currency text not null default 'CHF'
    check (income_currency in ('CHF', 'EUR')),
  add column income_conversion_rate numeric,
  add column spouse_income_currency text not null default 'CHF'
    check (spouse_income_currency in ('CHF', 'EUR')),
  add column spouse_income_conversion_rate numeric;

comment on column public.clients.income_currency is
  'Devise dans laquelle le courtier saisit le salaire/bonus/autres revenus du client (gross_annual_salary, bonus, other_income restent stockés en CHF).';
comment on column public.clients.income_conversion_rate is
  'Taux EUR->CHF utilisé lors de la dernière saisie/conversion des revenus du client, pour recalculer l''équivalent EUR affiché.';
comment on column public.clients.spouse_income_currency is
  'Devise dans laquelle le courtier saisit le salaire du conjoint (spouse_gross_annual_salary reste stocké en CHF).';
comment on column public.clients.spouse_income_conversion_rate is
  'Taux EUR->CHF utilisé lors de la dernière saisie/conversion du salaire du conjoint.';
