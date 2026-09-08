-- Prérequis pour la FK de demo_requests.assigned_to : admin_users.user_id
-- n'a qu'un index unique, pas de contrainte UNIQUE, et une FK exige une
-- contrainte. On formalise l'index existant en contrainte, sans le
-- recréer (USING INDEX) : aucune donnée touchée, opération quasi
-- instantanée, la colonne était déjà de facto unique depuis le début.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_user_id_key'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_user_id_key UNIQUE USING INDEX admin_users_user_id_idx;
  END IF;
END $$;
