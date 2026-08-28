-- sync_appointment_completed_at() est une fonction declencheur (trigger),
-- jamais destinee a etre appelee directement. Comme toutes les fonctions
-- de trigger de ce projet (enforce_client_limit_on_identity_change etc.),
-- son execution directe via /rest/v1/rpc/... doit etre fermee (repere par
-- l'analyseur de securite Supabase juste apres sa creation).
revoke all on function public.sync_appointment_completed_at() from public, anon, authenticated;
