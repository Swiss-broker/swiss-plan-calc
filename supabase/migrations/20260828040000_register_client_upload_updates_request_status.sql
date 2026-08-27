-- Etend register_client_upload (inchange dans sa logique de validation du
-- lien) pour : 1) faire progresser le statut de suivi documentaire vers
-- "recu" (nouvelle table client_document_requests), 2) notifier le
-- courtier qu'un document a ete depose, avec un anti-spam de 5 minutes
-- si le client depose plusieurs fichiers d'affilee.
create or replace function public.register_client_upload(
  _token text,
  _category public.client_document_category,
  _original_filename text,
  _storage_path text,
  _mime_type text,
  _size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _link public.client_document_links%rowtype;
  _doc_id uuid;
  _client_first_name text;
begin
  select * into _link from public.client_document_links where token = _token for update;
  if not found then raise exception 'LINK_NOT_FOUND'; end if;
  if _link.revoked then raise exception 'LINK_REVOKED'; end if;
  if _link.expires_at < now() then raise exception 'LINK_EXPIRED'; end if;
  if _link.upload_count >= _link.max_uploads then raise exception 'LINK_QUOTA_REACHED'; end if;

  insert into public.client_documents (
    client_id, broker_id, category, original_filename, storage_path,
    mime_type, size_bytes, uploaded_by, upload_link_id
  ) values (
    _link.client_id, _link.broker_id, _category, _original_filename, _storage_path,
    _mime_type, _size_bytes, 'client_link', _link.id
  ) returning id into _doc_id;

  update public.client_document_links
  set upload_count = upload_count + 1, last_used_at = now()
  where id = _link.id;

  -- Un nouveau depot fait toujours repasser la ligne de suivi a "recu"
  -- (y compris si elle etait "verifie" : un nouveau fichier remplace
  -- l'ancien, il doit etre revu) et l'associe au document deposant.
  insert into public.client_document_requests (
    client_id, broker_id, category, status, received_at, document_id, link_id
  ) values (
    _link.client_id, _link.broker_id, _category, 'recu', now(), _doc_id, _link.id
  )
  on conflict (client_id, category) do update
  set status = 'recu',
      received_at = now(),
      verified_at = null,
      document_id = excluded.document_id,
      link_id = excluded.link_id,
      updated_at = now();

  select first_name into _client_first_name from public.clients where id = _link.client_id;

  if not exists (
    select 1 from public.notifications
    where broker_id = _link.broker_id
      and type = 'document_received'
      and link = '/clients/' || _link.client_id
      and created_at > now() - interval '5 minutes'
  ) then
    insert into public.notifications (broker_id, type, title, body, link)
    values (
      _link.broker_id,
      'document_received',
      'Nouveaux documents reçus',
      coalesce(_client_first_name, 'Votre client') || ' a transmis des documents.',
      '/clients/' || _link.client_id
    );
  end if;

  return _doc_id;
end;
$$;
