-- Le cabinet (hiérarchie multi-courtiers) disparaît du produit (Phase 5) :
-- un compte encore marqué cabinet_role='root_director'/'director' ne doit
-- plus avoir accès aux agendas d'autres courtiers via cette fonction. On ne
-- touche ni cabinet_role ni manager_id eux-mêmes (données historiques
-- conservées), seulement la logique d'autorisation qui en dépendait.
create or replace function public.can_view_broker_appointments(_viewer_id uuid, _owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select _viewer_id = _owner_id;
$$;
