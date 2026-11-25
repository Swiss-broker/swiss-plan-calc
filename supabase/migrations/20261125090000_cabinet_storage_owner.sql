-- Après le départ d'un collaborateur, les fichiers qu'il a déposés restent
-- rangés sous son dossier mais appartiennent au cabinet : il ne doit plus
-- pouvoir les lire ni les supprimer. Le dossier personnel ne donne accès
-- qu'aux fichiers qui ne sont pas rattachés au client d'un autre courtier
-- (le fichier tout juste déposé, avant l'enregistrement de sa fiche, reste
-- accessible à son auteur).
-- La vérification passe par une fonction security definer : une simple
-- sous-requête serait filtrée par les droits du courtier lui-même, qui ne
-- voit justement plus la fiche transférée.
create or replace function public.client_document_owner(_path text)
returns uuid language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select broker_id from public.client_documents where storage_path = _path limit 1;
$$;
revoke all on function public.client_document_owner(text) from public, anon;
grant execute on function public.client_document_owner(text) to authenticated, service_role;

drop policy if exists "Brokers read own client documents" on storage.objects;
create policy "Brokers read own client documents" on storage.objects
  for select using (
    bucket_id = 'client-documents'
    and (auth.uid())::text = (storage.foldername(name))[1]
    and coalesce(public.client_document_owner(name), auth.uid()) = auth.uid()
  );
drop policy if exists "Brokers delete own client documents" on storage.objects;
create policy "Brokers delete own client documents" on storage.objects
  for delete using (
    bucket_id = 'client-documents'
    and (auth.uid())::text = (storage.foldername(name))[1]
    and coalesce(public.client_document_owner(name), auth.uid()) = auth.uid()
  );
