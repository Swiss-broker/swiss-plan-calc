-- Correctif immédiat : is_admin(uuid) est référencé par ~20 policies RLS
-- (admin_users, profiles, appointments, demo_requests, notifications...)
-- qui s'évaluent sous le rôle 'authenticated'. La révocation précédente
-- aurait cassé l'accès admin sur toutes ces tables. is_staff(uuid), lui,
-- n'est référencé par aucune policy (vérifié) : sa révocation reste sûre.
grant execute on function public.is_admin(uuid) to anon, authenticated;
