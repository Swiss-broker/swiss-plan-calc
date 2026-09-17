-- La suppression définitive d'un lead archivé (admin_delete_archived_demo_requests)
-- échouait sur un lead converti : client_invites référence demo_requests
-- sans ON DELETE CASCADE. client_invites n'est qu'un token d'onboarding
-- (voir 20260908130000_create_client_invites.sql), pas une donnée client
-- réelle — il n'a plus de sens une fois le lead source supprimé.
alter table public.client_invites
  drop constraint client_invites_demo_request_id_fkey,
  add constraint client_invites_demo_request_id_fkey
    foreign key (demo_request_id) references public.demo_requests(id) on delete cascade;
