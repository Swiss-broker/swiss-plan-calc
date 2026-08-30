-- Filet de securite pour une panne de webhook Stripe (voir commentaire de
-- l'edge function check-stuck-rdv-payments) : toutes les 30 minutes, on
-- verifie directement aupres de Stripe si des factures RDV restees
-- "pending" trop longtemps ont en realite ete payees. Si oui, la facture
-- est corrigee automatiquement et les admins sont alertes (cloche + e-mail,
-- voir trg_admin_notifications_email) qu'une vraie panne du webhook a eu
-- lieu.
-- Meme mecanisme de jeton que send-admin-alert-email (voir
-- admin_alert_email_trigger.sql) : verify_internal_alert_token contre
-- Supabase Vault, jamais une valeur en clair ici. Le jeton
-- 'internal_alert_cron_token' est cree une seule fois via
-- `select vault.create_secret(...)`, hors migration.
create or replace function public.run_check_stuck_rdv_payments()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'net', 'vault'
as $function$
begin
  perform net.http_post(
    url := 'https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/check-stuck-rdv-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_alert_cron_token')
    ),
    body := '{}'::jsonb
  );
end;
$function$;

revoke all on function public.run_check_stuck_rdv_payments() from public, anon, authenticated;

select cron.schedule(
  'check-stuck-rdv-payments',
  '*/30 * * * *',
  $$select public.run_check_stuck_rdv_payments();$$
);
