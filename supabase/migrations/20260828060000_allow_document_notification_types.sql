-- Ajoute les deux nouveaux types de notification introduits par le suivi
-- documentaire (dépôt client reçu, relance J+2) à la liste autorisée.
-- Au passage, ajoute aussi 'team_member_joined' : ce type était déjà
-- utilisé par supabase/functions/stripe-webhook mais absent de la
-- contrainte, ce qui faisait silencieusement échouer cette notification.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'feedback_reply', 'admin_message', 'announcement', 'plan_change',
    'payment_received', 'wiki_update', 'team_member_joined',
    'document_received', 'documents_pending_j2'
  ]));
