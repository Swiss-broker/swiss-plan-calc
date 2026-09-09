-- Sans ceci, un compte role='commercial' ne peut jamais lire sa propre
-- ligne dans admin_users (seule policy SELECT existante : is_admin(),
-- donc role='admin' strict) — AuthContext.checkAdminAccess le déconnecte
-- immédiatement faute de résultat, quel que soit le bouton de connexion
-- cliqué. admin_read_admin_users reste inchangée (un admin voit toute la
-- table, nécessaire pour peupler le dropdown "Assigner à" et l'historique
-- des changements de plan sur Abonnements).
CREATE POLICY "self_read_admin_users" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
