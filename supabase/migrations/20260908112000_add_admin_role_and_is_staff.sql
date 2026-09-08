-- 2a. Colonne role en text + CHECK plutôt qu'un ENUM Postgres : un ENUM
-- aurait exactement le défaut qu'on rattrape avec broker_plan ci-dessus
-- (ADD VALUE non transactionnel, pénible à faire évoluer) ; un CHECK se
-- modifie normalement si vous ajoutez un 3e rôle plus tard.
-- DEFAULT 'admin' : les 2 lignes existantes (Karlyta, James) sont remplies
-- par cet ADD COLUMN lui-même, aucune instruction UPDATE séparée.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

-- Contrainte ajoutée de façon idempotente (Postgres n'a pas de ADD
-- CONSTRAINT IF NOT EXISTS natif).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'commercial'));
  END IF;
END $$;

-- 2b. is_staff(uid) : vrai pour tout membre de admin_users, peu importe
-- le rôle — reproduit ce que faisaient déjà, sans le savoir, la plupart
-- des policies actuelles avant l'ajout du rôle.
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _uid);
$$;

-- 2c. is_admin(uid) redéfinie pour exiger strictement role = 'admin'.
-- Même signature qu'avant (CREATE OR REPLACE) : les 2 policies qui
-- l'appellent déjà (admin_users, appointments) héritent immédiatement de
-- la restriction sans qu'on les touche.
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = _uid AND role = 'admin'
  );
$$;
