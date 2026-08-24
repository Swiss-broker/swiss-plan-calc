-- Correction : la policy précédente ("admins can read own admin_users row",
-- restreinte à user_id = auth.uid()) était trop stricte. Le vrai problème
-- initial était qual=true pour authenticated (n'importe quel COURTIER
-- pouvait lire toute la table), pas le fait que des ADMINS lisent la ligne
-- d'un autre admin. La page "Abonnements" du panel admin a justement besoin
-- d'afficher quel admin a fait un changement manuel de plan. On adopte donc
-- le même schéma que toutes les autres policies admin_read_* de ce projet :
-- accès géré par l'appartenance à admin_users, pas par self-row.
DROP POLICY IF EXISTS "admins can read own admin_users row" ON public.admin_users;
CREATE POLICY "admin_read_admin_users" ON public.admin_users
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users a2 WHERE a2.user_id = auth.uid()));
