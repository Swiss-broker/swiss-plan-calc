-- Journal des actions admin ayant un impact sur les données d'un courtier
-- ou de ses clients (édition de client, publication/retrait wiki, envoi de
-- notification, changement de statut feedback...). Jusqu'ici ces actions
-- n'avaient aucune trace : ni qui, ni quand, ni quoi. plan_events couvre
-- déjà les changements de plan ; cette table couvre le reste.
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_admin_id_idx on public.admin_actions(admin_id);
create index admin_actions_target_idx on public.admin_actions(target_type, target_id);
create index admin_actions_created_at_idx on public.admin_actions(created_at desc);

alter table public.admin_actions enable row level security;

create policy admin_read_admin_actions
on public.admin_actions for select
to authenticated
using (
  exists (select 1 from admin_users where admin_users.user_id = auth.uid())
);

create policy admin_insert_own_admin_actions
on public.admin_actions for insert
to authenticated
with check (
  admin_id = auth.uid()
  and exists (select 1 from admin_users where admin_users.user_id = auth.uid())
);
