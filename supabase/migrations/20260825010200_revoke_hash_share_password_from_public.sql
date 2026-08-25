-- hash_share_password gardait un GRANT EXECUTE residuel sur le pseudo-role
-- PUBLIC (accorde par defaut a la creation de toute fonction Postgres),
-- ce qui suffisait a lui seul a laisser anon l'executer meme apres avoir
-- revoque le droit direct d'anon. On retire ce droit par defaut ; le
-- grant explicite conserve sur "authenticated" (les courtiers, seuls
-- utilisateurs legitimes de cette fonction) n'est pas touche.
revoke execute on function public.hash_share_password(uuid, text) from public;
