-- Permet d'archiver un lead (admin ou commercial assigné, via les policies
-- UPDATE déjà existantes) sans le supprimer, puis de le supprimer
-- définitivement une fois archivé — réservé aux admins.
alter table public.demo_requests
  add column archived boolean not null default false,
  add column archived_at timestamptz;

create policy admin_delete_archived_demo_requests
  on public.demo_requests
  for delete
  to public
  using (is_admin(auth.uid()) and archived = true);
