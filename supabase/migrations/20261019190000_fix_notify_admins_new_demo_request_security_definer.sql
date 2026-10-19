-- Corrige la notification admin lors d'une nouvelle demande de démo, cassée
-- pour les insertions faites depuis l'onglet "Inscription" (admin/commercial
-- authentifié, RLS active) : jusqu'ici, seul capture-demo-lead (clé service
-- role, RLS contournée) insérait dans demo_requests, donc le trigger
-- on_new_demo_request -> notify_admins_new_demo_request() (SECURITY INVOKER
-- par défaut) écrivait toujours avec des privilèges élevés sans jamais
-- heurter l'absence de policy INSERT sur admin_notifications (réservée au
-- backend). Un staff authentifié qui insère directement via l'UI
-- "Inscription" hérite lui de sa propre session dans le trigger, qui échoue
-- alors avec "new row violates row-level security policy for table
-- admin_notifications" (repéré en test). SECURITY DEFINER fait tourner la
-- fonction avec les privilèges de son propriétaire, peu importe qui déclenche
-- l'insertion sur demo_requests -- même mécanisme que les autres fonctions
-- déjà corrigées pour ce problème (voir 20261013085441_fix_function_search_path.sql).
create or replace function public.notify_admins_new_demo_request()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.admin_notifications (admin_id, type, title, body, link)
  select user_id, 'new_lead',
    'Nouvelle demande de démo',
    new.name || ' vient de réserver une démo',
    '/leads/' || new.id::text
  from public.admin_users
  where role = 'admin';
  return new;
end;
$function$;
