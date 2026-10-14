-- Suivi de la fonctionnalité "Avantages" (ristournes, commission 40-50‰) :
-- fenêtre explicative affichée une fois après activation de l'abonnement,
-- case "j'ai déjà eu mon rendez-vous" dans le profil, rappel mensuel
-- (bannière + email) tant que la case n'est pas cochée. Le "vu une fois"
-- de la fenêtre elle-même réutilise profiles.guides_seen (mécanisme déjà
-- en place, voir GuideContext.tsx) avec un guideId "advantages-modal" —
-- pas besoin de colonne dédiée pour ça.
alter table public.profiles
  add column advantages_call_done boolean not null default false,
  add column advantages_reminder_last_shown_at timestamptz,
  add column advantages_email_last_sent_at timestamptz;

comment on column public.profiles.advantages_call_done is
  'Coché par le courtier une fois qu''il a eu son rendez-vous sur les avantages (ristournes, commission). Stoppe les rappels mensuels (bannière + email).';
comment on column public.profiles.advantages_reminder_last_shown_at is
  'Dernier affichage de la bannière de rappel "avantages" (throttle mensuel côté client).';
comment on column public.profiles.advantages_email_last_sent_at is
  'Dernier envoi de l''email de rappel "avantages" (throttle mensuel côté cron).';

-- Cron mensuel : appelle l'edge function send-advantages-reminder-emails,
-- même mécanisme de jeton interne (Vault) que
-- run_check_stuck_rdv_payments (voir 20260830210000_check_stuck_rdv_payments_cron.sql).
-- Le secret 'internal_advantages_reminder_token' a été créé une seule fois
-- via select vault.create_secret(...), hors migration.
create or replace function public.run_send_advantages_reminder_emails()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'net', 'vault'
as $function$
begin
  perform net.http_post(
    url := 'https://ihepboeaudnxqxijeykl.supabase.co/functions/v1/send-advantages-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_advantages_reminder_token')
    ),
    body := '{}'::jsonb
  );
end;
$function$;

revoke all on function public.run_send_advantages_reminder_emails() from public, anon, authenticated;

select cron.schedule(
  'send-advantages-reminder-emails',
  '0 9 1 * *',
  $$select public.run_send_advantages_reminder_emails();$$
);
