-- Durcissement recommandé par le linter sécurité Supabase : ces deux
-- fonctions trigger n'avaient pas de search_path fixé, ce qui les rend
-- théoriquement sensibles à un détournement si un objet de même nom était
-- créé plus tôt dans le search_path résolu. Fix sans risque de régression
-- (le search_path contenait déjà implicitement 'public').
alter function public.notify_admins_new_demo_request() set search_path = public, pg_temp;
alter function public.notify_admins_new_payment() set search_path = public, pg_temp;
