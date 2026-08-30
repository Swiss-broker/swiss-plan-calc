-- Envoie un e-mail au(x) admin(s) uniquement pour les deux types d'alerte
-- qui signalent une vraie panne (system_error, payment_sync_issue) : les
-- autres types existants (feedback_reply, new_payment, new_feedback) restent
-- de simples notifications dans la cloche, comme avant -- un e-mail a chaque
-- paiement recu serait juste du bruit.
--
-- pg_net (HTTP asynchrone depuis Postgres) est le mecanisme standard Supabase
-- pour qu'un trigger appelle une Edge Function sans bloquer la transaction.
create extension if not exists pg_net;

-- Verifie un jeton interne contre Supabase Vault, jamais contre une valeur
-- en clair dans le code source : les Edge Functions appelees uniquement par
-- des triggers/cron (verify_jwt=false, obligatoire car ni pg_net ni pg_cron
-- ne portent de session utilisateur) l'utilisent pour s'assurer que seul
-- notre propre Postgres peut les declencher. secret_name distingue plusieurs
-- jetons (un par Edge Function protegee de cette facon).
create or replace function public.verify_internal_alert_token(secret_name text, token text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp', 'vault'
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = secret_name and decrypted_secret = token
  );
$$;

revoke all on function public.verify_internal_alert_token(text, text) from public, anon, authenticated;
grant execute on function public.verify_internal_alert_token(text, text) to service_role;

-- Le jeton lui-meme (nomme 'internal_alert_email_token' dans Vault) est cree
-- une seule fois via `select vault.create_secret(...)`, hors migration :
-- jamais versionne, puisque c'est justement la valeur secrete elle-meme.

-- admin_notifications recoit deja une ligne PAR admin (voir les triggers
-- existants notify_admins_*, qui font un select user_id from admin_users) :
-- ce trigger-ci ne doit donc cibler QUE l'admin de la ligne (new.admin_id),
-- jamais "tous les admins" a nouveau, sinon chacun recevrait un e-mail par
-- admin existant au lieu d'un seul.
create or replace function public.trigger_admin_alert_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'net', 'vault'
as $function$
begin
  perform net.http_post(
    url := 'https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/send-admin-alert-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_alert_email_token')
    ),
    body := jsonb_build_object('admin_id', new.admin_id, 'title', new.title, 'body', new.body, 'link', new.link, 'type', new.type)
  );
  return new;
end;
$function$;

revoke all on function public.trigger_admin_alert_email() from public, anon, authenticated;

create trigger trg_admin_notifications_email
  after insert on public.admin_notifications
  for each row
  when (new.type in ('system_error', 'payment_sync_issue'))
  execute function public.trigger_admin_alert_email();
