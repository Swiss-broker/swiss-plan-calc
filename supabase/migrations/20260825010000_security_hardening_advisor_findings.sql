-- Durcissement sécurité suite à l'audit (Supabase security advisor) :
-- 1. search_path figé sur les fonctions notify_* (trigger, SECURITY DEFINER)
--    -- sans ça, un search_path modifiable est une faille PostgreSQL connue.
-- 2. Retrait de l'accès public/anon sur des fonctions internes qui ne sont
--    invoquées que par des triggers Postgres (qui n'ont pas besoin d'un
--    droit EXECUTE explicite pour l'appelant) : elles n'ont jamais eu
--    besoin d'être exposées via /rest/v1/rpc/<fonction>.
-- 3. Anti brute-force sur les liens de simulation protégés par mot de
--    passe : verrouillage 15 minutes après 10 tentatives infructueuses.

-- 1. search_path figé
alter function public.notify_admin_message() set search_path = public, pg_temp;
alter function public.notify_admins_feedback_reply() set search_path = public, pg_temp;
alter function public.notify_admins_new_feedback() set search_path = public, pg_temp;
alter function public.notify_admins_new_payment() set search_path = public, pg_temp;
alter function public.notify_feedback_message() set search_path = public, pg_temp;
alter function public.notify_feedback_reply() set search_path = public, pg_temp;

-- 2. Retrait de l'exposition publique des fonctions trigger internes
revoke execute on function public.enforce_client_limit() from public;
revoke execute on function public.enforce_company_limit() from public;
revoke execute on function public.notify_admin_message() from public;
revoke execute on function public.notify_admins_feedback_reply() from public;
revoke execute on function public.notify_admins_new_feedback() from public;
revoke execute on function public.notify_admins_new_payment() from public;
revoke execute on function public.notify_feedback_message() from public;
revoke execute on function public.notify_feedback_reply() from public;

-- hash_share_password : uniquement utilisé par un courtier authentifié
-- pour créer un lien protégé (ShareSimulationButton.tsx) ; anon n'en a
-- jamais eu besoin.
revoke execute on function public.hash_share_password(uuid, text) from anon;

-- 3. Anti brute-force sur les liens de simulation protégés par mot de passe
alter table public.simulation_shares
  add column failed_password_attempts integer not null default 0,
  add column locked_until timestamptz;

drop function public.access_shared_simulation(text, text);

create function public.access_shared_simulation(_token text, _password text default null::text)
returns table(
  kind text,
  title text,
  note text,
  inputs jsonb,
  summary jsonb,
  tags text[],
  simulation_created_at timestamp with time zone,
  shared_at timestamp with time zone,
  expires_at timestamp with time zone,
  remaining_views integer,
  broker_display text,
  error_code text
)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
DECLARE
  _share public.simulation_shares%ROWTYPE;
  _sim public.simulation_history%ROWTYPE;
  _profile public.profiles%ROWTYPE;
  _provided_hash TEXT;
BEGIN
  SELECT * INTO _share FROM public.simulation_shares WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARE_NOT_FOUND'; END IF;
  IF _share.revoked THEN RAISE EXCEPTION 'SHARE_REVOKED'; END IF;
  IF _share.expires_at IS NOT NULL AND _share.expires_at < now() THEN
    RAISE EXCEPTION 'SHARE_EXPIRED';
  END IF;
  IF _share.max_views IS NOT NULL AND _share.view_count >= _share.max_views THEN
    RAISE EXCEPTION 'SHARE_MAX_VIEWS';
  END IF;

  IF _share.password_hash IS NOT NULL THEN
    IF _share.locked_until IS NOT NULL AND _share.locked_until > now() THEN
      RAISE EXCEPTION 'SHARE_LOCKED';
    END IF;

    IF _password IS NULL OR _password = '' THEN
      RAISE EXCEPTION 'SHARE_PASSWORD_REQUIRED';
    END IF;

    _provided_hash := encode(extensions.digest(_password || _share.id::text, 'sha256'), 'hex');
    IF _provided_hash <> _share.password_hash THEN
      -- Une RAISE EXCEPTION ici annulerait toute la transaction de cet
      -- appel RPC, y compris ce compteur : on renvoie donc un code
      -- d'erreur en ligne plutôt qu'une exception, pour que
      -- l'incrémentation soit bien persistée même en cas de mauvais mot
      -- de passe.
      UPDATE public.simulation_shares
      SET failed_password_attempts = failed_password_attempts + 1,
          locked_until = CASE WHEN failed_password_attempts + 1 >= 10 THEN now() + interval '15 minutes' ELSE locked_until END
      WHERE id = _share.id;

      RETURN QUERY SELECT
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB, NULL::TEXT[],
        NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::INTEGER, NULL::TEXT,
        'SHARE_PASSWORD_INVALID'::TEXT;
      RETURN;
    END IF;

    UPDATE public.simulation_shares
    SET failed_password_attempts = 0, locked_until = NULL
    WHERE id = _share.id;
  END IF;

  SELECT * INTO _sim FROM public.simulation_history WHERE id = _share.simulation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHARE_NOT_FOUND'; END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _share.broker_id;

  UPDATE public.simulation_shares
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = _share.id;

  RETURN QUERY SELECT
    _sim.kind::TEXT,
    _sim.title,
    _sim.note,
    _sim.inputs,
    _sim.summary,
    _sim.tags,
    _sim.created_at,
    _share.created_at,
    _share.expires_at,
    CASE WHEN _share.max_views IS NULL THEN NULL ELSE (_share.max_views - _share.view_count - 1) END,
    COALESCE(NULLIF(TRIM(CONCAT(_profile.first_name, ' ', _profile.last_name)), ''), _profile.brokerage_name, _profile.email),
    NULL::TEXT;
END;
$function$;
