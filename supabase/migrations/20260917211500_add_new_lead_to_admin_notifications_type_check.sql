-- Bug introduit par la migration précédente (notify_admins_new_demo_request) :
-- elle insère type='new_lead' dans admin_notifications, mais la contrainte
-- CHECK n'autorisait pas cette valeur. Le trigger AFTER INSERT levait donc
-- une exception à CHAQUE réservation Cal.com, ce qui annulait la transaction
-- entière — y compris l'insertion du lead dans demo_requests. Toutes les
-- réservations depuis le déploiement du trigger ont donc été perdues.
alter table public.admin_notifications drop constraint admin_notifications_type_check;

alter table public.admin_notifications add constraint admin_notifications_type_check
  check (type = any (array[
    'feedback_reply', 'new_payment', 'new_feedback', 'system_error',
    'payment_sync_issue', 'new_lead'
  ]));
