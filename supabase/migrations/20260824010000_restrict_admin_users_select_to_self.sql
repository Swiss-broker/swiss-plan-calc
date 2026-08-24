-- "admins can read admin_users" avait qual=true pour le rôle authenticated :
-- n'importe quel courtier connecté (pas seulement un admin) pouvait lire
-- toute la table admin_users (email, display_name, settings de chaque
-- administrateur). Découvert en auditant l'application admin séparée
-- (swiss-broker-admin), qui partage ce même projet Supabase. Aucun usage
-- réel ne nécessite de lire la ligne d'un AUTRE admin (AuthContext.
-- checkAdminAccess et Settings.tsx de l'app admin ne lisent/écrivent que
-- la ligne de l'appelant), donc on restreint à self-read, symétrique de
-- la policy UPDATE existante.
DROP POLICY IF EXISTS "admins can read admin_users" ON public.admin_users;
CREATE POLICY "admins can read own admin_users row" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
