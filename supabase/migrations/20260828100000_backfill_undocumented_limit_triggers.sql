-- Ces deux fonctions/triggers existaient deja en production (crees a un
-- moment donne hors historique de migrations, probablement via le
-- dashboard Supabase) mais n'etaient versionnes nulle part dans ce depot.
-- On les fige ici tels quels, sans changement de comportement, pour que
-- ce garde-fou de quota ne puisse plus jamais disparaitre silencieusement
-- (ex. reconstruction d'un environnement depuis les migrations seules).
create or replace function public.enforce_client_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_plan public.broker_plan;
  v_max integer;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.broker_id;

  v_max := CASE v_plan
    WHEN 'trial' THEN 20
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 20
    WHEN 'cabinet' THEN NULL
    WHEN 'internal' THEN NULL
    WHEN 'enterprise' THEN NULL
    ELSE 0
  END;

  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.clients
    WHERE broker_id = NEW.broker_id
      AND created_at >= date_trunc('month', now());

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: maximum % clients atteint pour ce mois', v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

drop trigger if exists trg_enforce_client_limit on public.clients;
create trigger trg_enforce_client_limit
  before insert on public.clients
  for each row execute function public.enforce_client_limit();

create or replace function public.enforce_company_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_plan public.broker_plan;
  v_max integer;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.broker_id;

  v_max := CASE v_plan
    WHEN 'trial' THEN 4
    WHEN 'starter' THEN 2
    WHEN 'pro' THEN 4
    WHEN 'cabinet' THEN NULL
    WHEN 'internal' THEN NULL
    WHEN 'enterprise' THEN NULL
    ELSE 0
  END;

  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.companies
    WHERE broker_id = NEW.broker_id
      AND created_at >= date_trunc('month', now());

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: maximum % societes atteint pour ce mois', v_max;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

drop trigger if exists trg_enforce_company_limit on public.companies;
create trigger trg_enforce_company_limit
  before insert on public.companies
  for each row execute function public.enforce_company_limit();

revoke all on function public.enforce_client_limit() from public, anon, authenticated;
revoke all on function public.enforce_company_limit() from public, anon, authenticated;
