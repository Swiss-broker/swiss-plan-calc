-- admin_actions
DROP POLICY IF EXISTS admin_insert_own_admin_actions ON public.admin_actions;
CREATE POLICY admin_insert_own_admin_actions ON public.admin_actions
  FOR INSERT WITH CHECK (admin_id = auth.uid() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_read_admin_actions ON public.admin_actions;
CREATE POLICY admin_read_admin_actions ON public.admin_actions
  FOR SELECT USING (public.is_admin(auth.uid()));

-- admin_messages
DROP POLICY IF EXISTS insert_messages ON public.admin_messages;
CREATE POLICY insert_messages ON public.admin_messages
  FOR INSERT WITH CHECK (broker_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS read_own_messages ON public.admin_messages;
CREATE POLICY read_own_messages ON public.admin_messages
  FOR SELECT USING (broker_id = auth.uid() OR public.is_admin(auth.uid()));

-- admin_notifications (garde la restriction "ses propres notifications")
DROP POLICY IF EXISTS admin_read_own_notifications ON public.admin_notifications;
CREATE POLICY admin_read_own_notifications ON public.admin_notifications
  FOR SELECT USING (public.is_admin(auth.uid()) AND admin_id = auth.uid());

DROP POLICY IF EXISTS admin_update_own_notifications ON public.admin_notifications;
CREATE POLICY admin_update_own_notifications ON public.admin_notifications
  FOR UPDATE USING (public.is_admin(auth.uid()) AND admin_id = auth.uid());

-- ai_conversations
DROP POLICY IF EXISTS admin_read_ai_conversations ON public.ai_conversations;
CREATE POLICY admin_read_ai_conversations ON public.ai_conversations
  FOR SELECT USING (public.is_admin(auth.uid()));

-- client_errors
DROP POLICY IF EXISTS admin_read_client_errors ON public.client_errors;
CREATE POLICY admin_read_client_errors ON public.client_errors
  FOR SELECT USING (public.is_admin(auth.uid()));

-- client_pension (PII)
DROP POLICY IF EXISTS "Admins manage all client pension" ON public.client_pension;
CREATE POLICY "Admins manage all client pension" ON public.client_pension
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- clients (PII)
DROP POLICY IF EXISTS "Admins update all clients" ON public.clients;
CREATE POLICY "Admins update all clients" ON public.clients
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_read_clients ON public.clients;
CREATE POLICY admin_read_clients ON public.clients
  FOR SELECT USING (public.is_admin(auth.uid()));

-- companies
DROP POLICY IF EXISTS admin_read_companies ON public.companies;
CREATE POLICY admin_read_companies ON public.companies
  FOR SELECT USING (public.is_admin(auth.uid()));

-- feedback_messages
DROP POLICY IF EXISTS insert_feedback_messages ON public.feedback_messages;
CREATE POLICY insert_feedback_messages ON public.feedback_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_feedback uf WHERE uf.id = feedback_messages.feedback_id AND uf.broker_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS read_feedback_messages ON public.feedback_messages;
CREATE POLICY read_feedback_messages ON public.feedback_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_feedback uf WHERE uf.id = feedback_messages.feedback_id AND uf.broker_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- notifications
DROP POLICY IF EXISTS admin_insert_notifications ON public.notifications;
CREATE POLICY admin_insert_notifications ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS broker_read_own_notifications ON public.notifications;
CREATE POLICY broker_read_own_notifications ON public.notifications
  FOR SELECT USING (broker_id = auth.uid() OR public.is_admin(auth.uid()));

-- plan_events (finances)
DROP POLICY IF EXISTS admin_read_plan_events ON public.plan_events;
CREATE POLICY admin_read_plan_events ON public.plan_events
  FOR SELECT USING (public.is_admin(auth.uid()));

-- profiles (PII)
DROP POLICY IF EXISTS admin_read_profiles ON public.profiles;
CREATE POLICY admin_read_profiles ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- rdv_invoices (finances)
DROP POLICY IF EXISTS admin_read_rdv_invoices ON public.rdv_invoices;
CREATE POLICY admin_read_rdv_invoices ON public.rdv_invoices
  FOR SELECT USING (public.is_admin(auth.uid()));

-- simulation_history
DROP POLICY IF EXISTS admin_read_simulation_history ON public.simulation_history;
CREATE POLICY admin_read_simulation_history ON public.simulation_history
  FOR SELECT USING (public.is_admin(auth.uid()));

-- user_feedback
DROP POLICY IF EXISTS admin_read_user_feedback ON public.user_feedback;
CREATE POLICY admin_read_user_feedback ON public.user_feedback
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admin_update_user_feedback ON public.user_feedback;
CREATE POLICY admin_update_user_feedback ON public.user_feedback
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- wiki_articles / wiki_article_translations
DROP POLICY IF EXISTS admins_full_access_articles ON public.wiki_articles;
CREATE POLICY admins_full_access_articles ON public.wiki_articles
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS admins_full_access_translations ON public.wiki_article_translations;
CREATE POLICY admins_full_access_translations ON public.wiki_article_translations
  FOR ALL USING (public.is_admin(auth.uid()));
