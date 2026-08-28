-- Rappels internes J+1/J+3/J+7/J+14 apres un RDV termine. Meme mecanique
-- que le job de relance documentaire J+2 (enable_pg_cron_and_document_
-- reminders.sql) : une fonction periodique SECURITY DEFINER, un registre
-- anti-doublon (ici appointment_followup_reminders, cree juste avant).
--
-- IMPORTANT : ce job ne fait que creer une notification interne pour le
-- courtier. Il n'envoie jamais d'e-mail au client tout seul -- c'est le
-- courtier qui decide ensuite, depuis la fiche client, s'il veut envoyer
-- quelque chose (via le compositeur d'e-mails existant, jamais automatique).
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'feedback_reply', 'admin_message', 'announcement', 'plan_change',
    'payment_received', 'wiki_update', 'team_member_joined',
    'document_received', 'documents_pending_j2', 'appointment_followup'
  ]));

create or replace function public.run_appointment_followup_reminders()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  _row record;
  _offset integer;
begin
  foreach _offset in array array[1, 3, 7, 14]
  loop
    for _row in
      select a.id as appointment_id, a.broker_id, a.client_id, a.title,
             c.first_name, c.last_name
      from public.appointments a
      left join public.clients c on c.id = a.client_id
      where a.status = 'termine'
        and a.completed_at is not null
        and a.completed_at <= now() - (_offset || ' days')::interval
        and not exists (
          select 1 from public.appointment_followup_reminders r
          where r.appointment_id = a.id and r.offset_days = _offset
        )
    loop
      insert into public.notifications (broker_id, type, title, body, link)
      values (
        _row.broker_id,
        'appointment_followup',
        'Suivi RDV : J+' || _offset,
        'Le rendez-vous "' || _row.title || '"' ||
          case when _row.first_name is not null
            then ' avec ' || _row.first_name || ' ' || _row.last_name
            else ''
          end ||
          ' est termine depuis ' || _offset || ' jours. Pensez a faire le suivi.',
        case when _row.client_id is not null then '/clients/' || _row.client_id else '/calendar' end
      );

      insert into public.appointment_followup_reminders (appointment_id, offset_days)
      values (_row.appointment_id, _offset);
    end loop;
  end loop;
end;
$function$;

revoke all on function public.run_appointment_followup_reminders() from public, anon, authenticated;

select cron.schedule(
  'appointment-followup-reminders-daily',
  '15 8 * * *',
  $$select public.run_appointment_followup_reminders();$$
);
