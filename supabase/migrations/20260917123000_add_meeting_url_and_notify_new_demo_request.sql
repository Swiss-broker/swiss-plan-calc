-- Ajoute le lien de la visio Cal Video (rempli par capture-demo-lead depuis
-- payload.metadata.videoCallUrl) et notifie les admins à chaque nouvelle
-- réservation démo, sur le même modèle que on_new_payment.
alter table public.demo_requests add column meeting_url text;

create or replace function public.notify_admins_new_demo_request()
returns trigger as $$
begin
  insert into public.admin_notifications (admin_id, type, title, body, link)
  select user_id, 'new_lead',
    'Nouvelle demande de démo',
    new.name || ' vient de réserver une démo',
    '/leads/' || new.id::text
  from public.admin_users
  where role = 'admin';
  return new;
end;
$$ language plpgsql;

create trigger on_new_demo_request
  after insert on public.demo_requests
  for each row execute function public.notify_admins_new_demo_request();
