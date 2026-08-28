-- Workflow de suivi post-rendez-vous (Partie 4 du cahier des charges
-- "cockpit RDV"). Nouveau domaine, aucun calculateur touche.
--
-- completed_at capture le moment exact ou un RDV passe a "termine", pour
-- servir d'ancre fixe aux rappels J+1/J+3/J+7/J+14 : si on utilisait
-- updated_at, corriger une simple faute de frappe dans le titre plus tard
-- decalerait tous les rappels.
alter table public.appointments add column completed_at timestamptz;

create or replace function public.sync_appointment_completed_at()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status = 'termine' then
    if tg_op = 'INSERT' or old.status is distinct from 'termine' or old.completed_at is null then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
    -- Si le RDV redevient "non termine" (reporte par erreur, etc.), on
    -- efface le registre des rappels deja envoyes : une future clotures
    -- doit pouvoir relancer un cycle J+1..J+14 complet.
    if tg_op = 'UPDATE' and old.status = 'termine' then
      delete from public.appointment_followup_reminders where appointment_id = new.id;
    end if;
  end if;
  return new;
end;
$function$;

-- appointment_reports : compte rendu de RDV (redige a la main ou genere
-- via l'IA existante depuis le frontend, cf. ai-chat / AiAnalysis.tsx).
-- Un seul compte rendu par RDV, modifiable, jamais lie aux simulations.
create table public.appointment_reports (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  broker_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  generated_by text not null default 'manuel' check (generated_by in ('manuel', 'ia')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index idx_appointment_reports_client on public.appointment_reports(client_id);

create trigger trg_appointment_reports_updated
  before update on public.appointment_reports
  for each row execute function public.touch_updated_at();

alter table public.appointment_reports enable row level security;

create policy appointment_reports_select
  on public.appointment_reports for select
  using (auth.uid() = broker_id);

create policy appointment_reports_insert
  on public.appointment_reports for insert
  with check (auth.uid() = broker_id);

create policy appointment_reports_update
  on public.appointment_reports for update
  using (auth.uid() = broker_id)
  with check (auth.uid() = broker_id);

create policy appointment_reports_delete
  on public.appointment_reports for delete
  using (auth.uid() = broker_id);

-- client_followups : la liste "PROCHAINES ACTIONS". Une tache peut naitre
-- d'un RDV termine (appointment_id renseigne) ou etre creee librement.
create table public.client_followups (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  title text not null,
  due_date date,
  priority text not null default 'normale' check (priority in ('basse', 'normale', 'haute')),
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'termine')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_client_followups_broker on public.client_followups(broker_id);
create index idx_client_followups_client on public.client_followups(client_id);
create index idx_client_followups_status on public.client_followups(broker_id, status);

create trigger trg_client_followups_updated
  before update on public.client_followups
  for each row execute function public.touch_updated_at();

alter table public.client_followups enable row level security;

create policy client_followups_select
  on public.client_followups for select
  using (auth.uid() = broker_id);

create policy client_followups_insert
  on public.client_followups for insert
  with check (auth.uid() = broker_id);

create policy client_followups_update
  on public.client_followups for update
  using (auth.uid() = broker_id)
  with check (auth.uid() = broker_id);

create policy client_followups_delete
  on public.client_followups for delete
  using (auth.uid() = broker_id);

-- appointment_followup_reminders : registre interne des rappels J+1/3/7/14
-- deja envoyes par RDV, pour que le job periodique ne double jamais un
-- rappel. Jamais lu ni ecrit directement par le navigateur, uniquement par
-- les fonctions SECURITY DEFINER (meme principe que plan_quota_events).
create table public.appointment_followup_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  offset_days integer not null check (offset_days in (1, 3, 7, 14)),
  sent_at timestamptz not null default now(),
  unique (appointment_id, offset_days)
);

create index idx_appointment_followup_reminders_appointment
  on public.appointment_followup_reminders(appointment_id);

alter table public.appointment_followup_reminders enable row level security;

-- La fonction ci-dessus reference cette table avant sa creation dans ce
-- fichier : on (re)cree le trigger seulement maintenant que tout existe.
create trigger trg_appointments_completed_at
  before insert or update on public.appointments
  for each row execute function public.sync_appointment_completed_at();
