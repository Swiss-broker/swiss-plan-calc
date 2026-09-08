-- Extension du choix de devise de saisie (CHF/EUR) aux onglets Fiscalité
-- (intérêts hypothécaires résidence France) et Patrimoine (comptes
-- bancaires, titres, immobilier, dette hypothécaire). LPP/3a restent
-- volontairement CHF uniquement (certificats suisses toujours en CHF).

alter table public.clients
  add column mortgage_interest_currency text not null default 'CHF'
    check (mortgage_interest_currency in ('CHF', 'EUR')),
  add column mortgage_interest_conversion_rate numeric;

comment on column public.clients.mortgage_interest_currency is
  'Devise dans laquelle le courtier saisit les intérêts hypothécaires France (mortgage_interest_france reste stocké en CHF).';
comment on column public.clients.mortgage_interest_conversion_rate is
  'Taux EUR->CHF utilisé lors de la dernière saisie/conversion des intérêts hypothécaires.';

-- La table clients utilise des GRANT au niveau colonne pour authenticated
-- (pas de GRANT UPDATE global sur la table) : il faut l'accorder
-- explicitement pour ces 2 nouvelles colonnes, comme pour toutes les
-- autres (cf. migration client_income_currency_grants).
grant update (mortgage_interest_currency, mortgage_interest_conversion_rate)
  on public.clients to authenticated;

alter table public.client_assets
  add column assets_currency text not null default 'CHF'
    check (assets_currency in ('CHF', 'EUR')),
  add column assets_conversion_rate numeric;

comment on column public.client_assets.assets_currency is
  'Devise dans laquelle le courtier saisit le patrimoine (bank_accounts, securities, real_estate_value, mortgage_debt restent stockés en CHF).';
comment on column public.client_assets.assets_conversion_rate is
  'Taux EUR->CHF utilisé lors de la dernière saisie/conversion du patrimoine.';
-- client_assets a un GRANT UPDATE global sur la table pour authenticated
-- (vérifié via information_schema.table_privileges), donc pas besoin de
-- grant colonne par colonne ici.
