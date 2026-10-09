-- Le modele economique abandonne les abonnements a quota (limite de X
-- clients/societes par mois selon le plan) au profit d'une facturation
-- uniquement a la commission : ces garde-fous n'ont plus de sens et
-- bloquaient desormais des courtiers legitimes sans raison. On supprime
-- les 4 triggers + fonctions qui les imposaient cote base. La table
-- plan_quota_events (registre d'evenements) est laissee en place, inerte :
-- aucun cout, aucune exposition (pas de policy RLS authenticated), et
-- recuperable si ce modele revenait un jour.
drop trigger if exists trg_enforce_client_limit on public.clients;
drop trigger if exists trg_enforce_client_limit_on_identity_change on public.clients;
drop trigger if exists trg_enforce_company_limit on public.companies;
drop trigger if exists trg_enforce_company_limit_on_identity_change on public.companies;

drop function if exists public.enforce_client_limit();
drop function if exists public.enforce_client_limit_on_identity_change();
drop function if exists public.enforce_company_limit();
drop function if exists public.enforce_company_limit_on_identity_change();
