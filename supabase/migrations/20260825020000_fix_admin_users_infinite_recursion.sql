-- INCIDENT CRITIQUE : la policy "admin_read_admin_users" sur admin_users
-- se référençait elle-même (EXISTS (SELECT 1 FROM admin_users ...)),
-- causant une récursion infinie à chaque évaluation. Comme presque toutes
-- les tables (profiles, clients, plan_events, client_errors, etc.) ont
-- une policy "admin_read_*" qui interroge admin_users en sous-requête,
-- cette récursion se déclenchait sur quasiment toutes les lectures de
-- l'app, pour tous les utilisateurs (courtiers et admins) — plus aucune
-- page ne pouvait charger le profil ou les clients d'un courtier.
--
-- Fix standard : une fonction SECURITY DEFINER, possédée par le
-- propriétaire de la table, contourne le RLS pour cette vérification
-- interne (le propriétaire d'une table n'est jamais soumis à ses propres
-- policies RLS), donc plus de récursion.

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = _uid);
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy admin_read_admin_users on public.admin_users;
create policy admin_read_admin_users
on public.admin_users
for select
to authenticated
using (public.is_admin(auth.uid()));
