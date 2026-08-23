-- Suite immédiate de lock_broker_self_update_paths : les policies INSERT
-- ouvraient exactement les mêmes brèches, en pire — un courtier n'avait
-- même pas besoin d'une ligne existante, juste d'insérer directement la
-- ligne qu'il voulait.

-- rdv_invoices : un courtier pouvait insérer sa propre facture déjà
-- status='paid', pdf_unlocked=true, avec le montant de son choix, sans
-- jamais passer par stripe-rdv-invoice ni par un paiement Stripe réel.
DROP POLICY IF EXISTS "Brokers insert their own invoices" ON public.rdv_invoices;

-- broker_connect_accounts : un courtier pouvait insérer directement sa
-- ligne avec onboarding_complete=true et un stripe_account_id de son
-- choix (y compris celui d'un autre compte Stripe connecté), sans jamais
-- passer par stripe-connect-onboard ni par une vérification Stripe réelle.
DROP POLICY IF EXISTS "Brokers insert their own connect account" ON public.broker_connect_accounts;

-- user_feedback : la création d'un ticket de feedback est légitime côté
-- client (FeedbackWidget.tsx), mais uniquement pour ses propres champs de
-- contenu. status/admin_reply/admin_reply_at/admin_reply_by ne doivent
-- jamais pouvoir être fixés dès la création par le courtier lui-même.
REVOKE INSERT ON public.user_feedback FROM authenticated, anon;
GRANT INSERT (broker_id, category, subject, message, page_path, rating, context)
  ON public.user_feedback TO authenticated;
