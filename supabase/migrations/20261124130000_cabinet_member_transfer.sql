-- Départ d'un collaborateur : ses clients restent au cabinet. Transfert, en
-- une seule transaction, de tout ce qui concerne ses clients vers le patron.
-- Appelée uniquement par la fonction « cabinet » (clé de service).
create or replace function public.cabinet_transfer_member_data(_member uuid, _root uuid)
returns void language plpgsql security definer
set search_path to 'public', 'pg_temp' as $$
declare t text;
begin
  if _member is null or _root is null or _member = _root then
    raise exception 'invalid transfer';
  end if;
  foreach t in array array[
    'clients', 'client_pension', 'client_assets', 'client_cases', 'simulation_history',
    'simulation_shares', 'client_documents', 'client_document_requests', 'client_document_links',
    'client_notes', 'client_email_log', 'client_followups', 'companies',
    'appointments', 'appointment_reports'
  ] loop
    execute format('update public.%I set broker_id = $1 where broker_id = $2', t) using _root, _member;
  end loop;
  update public.rdv_invoices set broker_id = _root, cabinet_root_id = _root where broker_id = _member;
end $$;
revoke all on function public.cabinet_transfer_member_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cabinet_transfer_member_data(uuid, uuid) to service_role;

-- Les fichiers restent rangés sous le dossier de leur déposant : après un
-- transfert, le nouveau propriétaire du document y accède par la fiche
-- document (client_documents.broker_id), pas par le nom du dossier.
drop policy if exists "Brokers read documents they own" on storage.objects;
create policy "Brokers read documents they own" on storage.objects
  for select using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.client_documents d where d.storage_path = name and d.broker_id = auth.uid())
  );
drop policy if exists "Brokers delete documents they own" on storage.objects;
create policy "Brokers delete documents they own" on storage.objects
  for delete using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.client_documents d where d.storage_path = name and d.broker_id = auth.uid())
  );

-- Nouveaux événements tracés (plan_events, notifications) et rôles réduits à
-- patron / collaborateur (l'ancien rôle « director » n'est plus utilisé).
alter table public.plan_events drop constraint if exists plan_events_reason_check;
alter table public.plan_events add constraint plan_events_reason_check check (reason = any (array[
  'checkout_completed', 'subscription_deleted', 'payment_failed', 'admin_override',
  'cabinet_joined', 'cabinet_removed', 'cabinet_seat_ended'
]));
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'feedback_reply', 'admin_message', 'announcement', 'plan_change', 'payment_received', 'wiki_update',
  'team_member_joined', 'document_received', 'documents_pending_j2', 'appointment_followup',
  'cabinet_payer_changed', 'cabinet_removed', 'cabinet_seat_ended'
]));
alter table public.profiles drop constraint if exists profiles_cabinet_role_check;
alter table public.profiles add constraint profiles_cabinet_role_check check (cabinet_role in ('root_director', 'courtier'));
alter table public.cabinet_invites drop constraint if exists cabinet_invites_role_check;
alter table public.cabinet_invites add constraint cabinet_invites_role_check check (role = 'courtier');

-- Le patron voit les invitations de son cabinet (création et changements :
-- uniquement par la fonction « cabinet »).
drop policy if exists "Cabinet patron reads invites" on public.cabinet_invites;
create policy "Cabinet patron reads invites" on public.cabinet_invites
  for select using (cabinet_root_id = auth.uid());
