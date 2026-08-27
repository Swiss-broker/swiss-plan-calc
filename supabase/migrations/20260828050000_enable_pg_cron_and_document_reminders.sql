create extension if not exists pg_cron with schema extensions;

-- Relance interne J+2 : pour chaque client ayant au moins une demande de
-- document "demande" depuis 2 jours ou plus sans avoir encore recu de
-- rappel, une SEULE notification groupee est creee pour le courtier
-- (jamais d'email envoye au client : notification interne uniquement,
-- conformement a la regle "pas d'automatisation agressive").
create or replace function public.run_document_request_reminders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _row record;
begin
  for _row in
    select r.client_id, r.broker_id, c.first_name,
           count(*) filter (where r.status = 'demande') as pending_count
    from public.client_document_requests r
    join public.clients c on c.id = r.client_id
    where r.status = 'demande'
      and r.requested_at <= now() - interval '2 days'
      and r.reminder_sent_at is null
    group by r.client_id, r.broker_id, c.first_name
  loop
    insert into public.notifications (broker_id, type, title, body, link)
    values (
      _row.broker_id,
      'documents_pending_j2',
      'Documents toujours en attente',
      coalesce(_row.first_name, 'Ce client') || ' n''a pas encore transmis '
        || case when _row.pending_count > 1 then 'les documents demandés.' else 'le document demandé.' end,
      '/clients/' || _row.client_id
    );

    update public.client_document_requests
    set reminder_sent_at = now()
    where client_id = _row.client_id
      and status = 'demande'
      and reminder_sent_at is null;
  end loop;
end;
$$;

revoke all on function public.run_document_request_reminders() from public, anon, authenticated;

select cron.schedule(
  'document-request-reminders-daily',
  '0 8 * * *',
  $$select public.run_document_request_reminders();$$
);
