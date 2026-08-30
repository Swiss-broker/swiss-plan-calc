-- Alertes admin pour les "pannes silencieuses" : jusqu'ici, une erreur JS
-- cote courtier (client_errors) etait visible seulement si un admin pensait
-- a ouvrir la page Erreurs du panel. On ajoute un vrai declencheur, sur le
-- meme modele que les notifications existantes (feedback_reply, new_payment,
-- new_feedback) deja envoyees a chaque admin via admin_notifications.
alter table public.admin_notifications drop constraint admin_notifications_type_check;
alter table public.admin_notifications add constraint admin_notifications_type_check
  check (type = any (array[
    'feedback_reply', 'new_payment', 'new_feedback',
    'system_error', 'payment_sync_issue'
  ]));

-- Anti-repetition : si la meme erreur (meme message) a deja declenche une
-- alerte admin dans les 30 dernieres minutes, on ne renvoie pas une nouvelle
-- alerte identique. Sans ca, une erreur qui se reproduit chez plusieurs
-- courtiers en meme temps inonderait la cloche admin et la boite mail.
create or replace function public.notify_admins_client_error()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (
    select 1 from public.admin_notifications
    where type = 'system_error'
      and body = new.message
      and created_at >= now() - interval '30 minutes'
  ) then
    return new;
  end if;

  insert into public.admin_notifications (admin_id, type, title, body, link)
  select user_id, 'system_error',
    'Erreur détectée côté courtier',
    new.message,
    '/errors'
  from public.admin_users;

  return new;
end;
$function$;

revoke all on function public.notify_admins_client_error() from public, anon, authenticated;

create trigger trg_client_errors_notify_admins
  after insert on public.client_errors
  for each row execute function public.notify_admins_client_error();
