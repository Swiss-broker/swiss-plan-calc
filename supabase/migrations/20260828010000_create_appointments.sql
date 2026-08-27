-- Calendrier / rendez-vous (Partie 1 du cahier des charges "cockpit RDV").
-- Nouveau domaine, aucune table existante modifiée, aucun calculateur
-- touché.
--
-- appointments : un rendez-vous appartient toujours à un courtier
-- (broker_id). client_id est optionnel (RDV interne possible, cf.
-- décision explicite du courtier lors du cadrage).
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  appointment_type text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  location text,
  video_link text,
  note text,
  status text not null default 'planifie'
    check (status in ('planifie', 'confirme', 'termine', 'annule', 'reporte')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_broker_id_idx on public.appointments(broker_id);
create index appointments_client_id_idx on public.appointments(client_id);
create index appointments_starts_at_idx on public.appointments(starts_at);

create trigger trg_appointments_updated
before update on public.appointments
for each row execute function public.touch_updated_at();

-- appointment_reminders : plusieurs rappels possibles par RDV (ex. 24h
-- avant + 2h avant). "notified" marque qu'une notification interne a
-- déjà été créée pour ce rappel (un job périodique s'en charge, ajouté
-- dans une prochaine partie — automatisations).
create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  remind_before_minutes integer not null check (remind_before_minutes > 0),
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index appointment_reminders_appointment_id_idx on public.appointment_reminders(appointment_id);
create index appointment_reminders_pending_idx on public.appointment_reminders(notified) where notified = false;

alter table public.appointments enable row level security;
alter table public.appointment_reminders enable row level security;

-- Visibilité cabinet : un root_director voit tous les RDV de son cabinet,
-- un director voit les RDV de ses courtiers directs, tout le monde voit
-- toujours ses propres RDV. Un courtier solo (hors cabinet) ne voit que
-- les siens : "strictement privé par défaut" comme demandé.
--
-- SECURITY DEFINER est indispensable ici : sans ça, la sous-requête sur
-- profiles pour lire le cabinet_role/manager_id d'AUTRUI se heurterait à
-- la RLS de la table profiles elle-même (qui limite un courtier
-- ordinaire à sa propre ligne), et la visibilité cabinet ne fonctionnerait
-- jamais pour personne d'autre qu'un admin. Même schéma que is_admin(),
-- ajouté lors du fix de la récursion RLS sur admin_users.
create or replace function public.can_view_broker_appointments(_viewer_id uuid, _owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    _viewer_id = _owner_id
    or exists (
      select 1
      from public.profiles caller
      join public.profiles owner on owner.id = _owner_id
      where caller.id = _viewer_id
        and (
          (caller.cabinet_role = 'root_director' and owner.cabinet_root_id = caller.id)
          or (caller.cabinet_role = 'director' and owner.manager_id = caller.id)
        )
    );
$$;

revoke all on function public.can_view_broker_appointments(uuid, uuid) from public, anon;
grant execute on function public.can_view_broker_appointments(uuid, uuid) to authenticated;

create policy appointments_select
on public.appointments for select
to authenticated
using (public.can_view_broker_appointments(auth.uid(), broker_id));

-- Création/modification/suppression restées strictement au propriétaire :
-- la visibilité cabinet du directeur ne lui donne pas le droit de
-- modifier l'agenda d'un courtier, seulement de le consulter.
create policy appointments_insert
on public.appointments for insert
to authenticated
with check (broker_id = auth.uid());

create policy appointments_update
on public.appointments for update
to authenticated
using (broker_id = auth.uid())
with check (broker_id = auth.uid());

create policy appointments_delete
on public.appointments for delete
to authenticated
using (broker_id = auth.uid());

create policy admin_read_appointments
on public.appointments for select
to authenticated
using (public.is_admin(auth.uid()));

-- Rappels : détail de préparation personnel, non partagé avec la
-- visibilité cabinet (seul le propriétaire du RDV les voit/gère).
create policy appointment_reminders_all
on public.appointment_reminders for all
to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_reminders.appointment_id
      and a.broker_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_reminders.appointment_id
      and a.broker_id = auth.uid()
  )
);
