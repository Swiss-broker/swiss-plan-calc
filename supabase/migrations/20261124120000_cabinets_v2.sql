-- Cabinets (v2) : un patron crée son cabinet, invite ses collaborateurs,
-- l'argent des rendez-vous des collaborateurs arrive sur le compte de la
-- société (compte Stripe Connect du patron), le patron voit les dossiers et
-- paiements de toute son équipe. Réutilise les colonnes de hiérarchie déjà
-- présentes sur profiles (cabinet_root_id, cabinet_role, manager_id) :
-- patron = cabinet_role 'root_director' et cabinet_root_id = son propre id,
-- collaborateur = cabinet_role 'courtier' et cabinet_root_id = id du patron.
-- Toutes les écritures passent par des Edge Functions (clé de service) :
-- les colonnes cabinet_* ne sont pas modifiables depuis le navigateur.
-- ===== Nettoyage des résidus avant le nouveau système =====
-- 1. Essai « lien d'offre » annulé (24.11.2026) : table vide de sens, plus
--    aucune fonction ni page ne l'utilise.
drop table if exists public.lead_offers;

-- 2. Ancien système cabinet / sièges : invitations de test (révoquées ou
--    invalides) et rôles posés sans fiche cabinet. Les patrons recréent leur
--    cabinet avec le bouton « Créer mon cabinet ».
delete from public.cabinet_invites;
update public.profiles
   set cabinet_role = null, cabinet_root_id = null, manager_id = null
 where cabinet_role is not null or cabinet_root_id is not null or manager_id is not null;

-- 3. Inscription : l'ancien raccourci invite_token (plan 'cabinet' attribué
--    sans paiement) est retiré. L'adhésion à un cabinet passe désormais par
--    la fonction cabinet-accept.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp' as $function$
begin
  insert into public.profiles (id, email, first_name, last_name, plan)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    'trial'::public.broker_plan
  );
  return new;
end;
$function$;


create table if not exists public.cabinets (
  root_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cabinets enable row level security;

alter table public.profiles
  add column if not exists cabinet_payer text check (cabinet_payer in ('cabinet', 'self')),
  add column if not exists cabinet_seat_subscription_id text,
  add column if not exists cabinet_joined_at timestamptz;

alter table public.cabinet_invites drop constraint if exists cabinet_invites_status_check;
alter table public.cabinet_invites
  add constraint cabinet_invites_status_check
  check (status in ('awaiting_payment', 'pending', 'accepted', 'revoked'));
alter table public.cabinet_invites
  add column if not exists stripe_checkout_session_id text,
  add column if not exists accepted_user_id uuid references public.profiles(id) on delete set null;

alter table public.rdv_invoices
  add column if not exists cabinet_root_id uuid references public.profiles(id);
create index if not exists idx_rdv_invoices_cabinet_root_id on public.rdv_invoices (cabinet_root_id);

-- Patron du cabinet d'un courtier donné (null si indépendant).
create or replace function public.cabinet_root_of(_uid uuid)
returns uuid language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select cabinet_root_id from public.profiles where id = _uid;
$$;

-- _viewer est-il le patron du cabinet auquel appartient _broker ?
create or replace function public.is_cabinet_patron_of(_viewer uuid, _broker uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select _viewer is not null and _broker is not null and _viewer <> _broker
    and exists (
      select 1 from public.profiles r
      where r.id = _viewer and r.cabinet_role = 'root_director' and r.cabinet_root_id = _viewer
    )
    and exists (
      select 1 from public.profiles m
      where m.id = _broker and m.cabinet_role = 'courtier' and m.cabinet_root_id = _viewer
    );
$$;

-- Lecture des dossiers de l'équipe par le patron (lecture seule).
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'client_pension', 'client_assets', 'client_cases', 'simulation_history',
    'client_documents', 'client_document_requests', 'client_document_links', 'client_notes', 'client_email_log',
    'client_followups', 'companies'
  ] loop
    execute format('drop policy if exists "Cabinet patron reads team" on public.%I', t);
    execute format(
      'create policy "Cabinet patron reads team" on public.%I for select using (public.is_cabinet_patron_of(auth.uid(), broker_id))',
      t
    );
  end loop;
end $$;

drop policy if exists "Cabinet patron reads team invoices" on public.rdv_invoices;
create policy "Cabinet patron reads team invoices" on public.rdv_invoices
  for select using (cabinet_root_id = auth.uid() or public.is_cabinet_patron_of(auth.uid(), broker_id));

-- Profils : le patron voit la fiche de ses collaborateurs (pas l'inverse :
-- un collaborateur n'a accès qu'au nom du cabinet, via la table cabinets).
drop policy if exists "Cabinet patron reads team profiles" on public.profiles;
create policy "Cabinet patron reads team profiles" on public.profiles
  for select using (public.is_cabinet_patron_of(auth.uid(), id));

-- Fiche du cabinet : lisible par le patron et ses collaborateurs.
drop policy if exists "Cabinet readable by its members" on public.cabinets;
create policy "Cabinet readable by its members" on public.cabinets
  for select using (root_id = auth.uid() or root_id = public.cabinet_root_of(auth.uid()));

-- Agenda : le patron voit aussi les rendez-vous de son équipe.
create or replace function public.can_view_broker_appointments(_viewer_id uuid, _owner_id uuid)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select _viewer_id = _owner_id or public.is_cabinet_patron_of(_viewer_id, _owner_id);
$$;

-- Documents déposés (stockage) : le patron peut ouvrir ceux de son équipe.
drop policy if exists "Cabinet patron reads team documents" on storage.objects;
create policy "Cabinet patron reads team documents" on storage.objects
  for select using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from public.profiles m
      where m.id::text = (storage.foldername(name))[1]
        and m.cabinet_role = 'courtier'
        and m.cabinet_root_id = auth.uid()
    )
  );

revoke all on function public.cabinet_root_of(uuid) from public, anon;
revoke all on function public.is_cabinet_patron_of(uuid, uuid) from public, anon;
grant execute on function public.cabinet_root_of(uuid) to authenticated, service_role;
grant execute on function public.is_cabinet_patron_of(uuid, uuid) to authenticated, service_role;
