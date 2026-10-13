-- is_staff()/is_admin() ne sont jamais appelées directement en RPC HTTP
-- par le frontend ou les edge functions (vérifié) : elles ne servent
-- qu'en interne, référencées par d'autres policies RLS côté SQL, ce qui
-- continue de fonctionner sans le droit EXECUTE exposé via PostgREST.
-- Les laisser exécutables par anon/authenticated permettait à n'importe
-- qui (même non connecté) de sonder un UUID arbitraire via
-- /rest/v1/rpc/is_staff pour savoir s'il appartient à un admin/commercial :
-- fuite d'information mineure, sans rapport avec les données clients,
-- mais fermée ici sans aucun risque de régression.
--
-- NOTE (voir migrations suivantes) : cette révocation s'est révélée trop
-- large pour is_admin, qui est en réalité référencée par ~20 policies RLS
-- (admin_users, profiles, appointments, demo_requests...) évaluées sous le
-- rôle 'authenticated'. Corrigé immédiatement dans les deux migrations qui
-- suivent, conservées telles quelles pour que l'historique reflète
-- exactement ce qui a été appliqué en production.
revoke execute on function public.is_staff(uuid) from anon, authenticated;
revoke execute on function public.is_admin(uuid) from anon, authenticated;
