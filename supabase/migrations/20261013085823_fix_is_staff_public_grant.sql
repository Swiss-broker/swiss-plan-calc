-- Le EXECUTE était accordé à PUBLIC (droit par défaut à la création d'une
-- fonction), donc la révocation précédente sur anon/authenticated seule
-- était sans effet : PUBLIC s'applique à tous les rôles, y compris ceux-là.
-- is_staff(uuid) n'est utilisée dans aucune policy RLS (vérifié) : seuls
-- postgres/service_role ont réellement besoin de l'appeler.
revoke execute on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to postgres, service_role;
