-- Le registre plan_quota_events vient d'etre cree : il faut le remplir avec
-- les clients et societes deja crees ce mois-ci, sinon un courtier qui a
-- deja utilise une partie de son quota ce mois se retrouverait avec un
-- registre vide et pourrait re-consommer tout son quota depuis zero.
insert into public.plan_quota_events (broker_id, entity_type, entity_id, occurred_at)
select broker_id, 'client', id, created_at
from public.clients
where created_at >= date_trunc('month', now());

insert into public.plan_quota_events (broker_id, entity_type, entity_id, occurred_at)
select broker_id, 'company', id, created_at
from public.companies
where created_at >= date_trunc('month', now());
