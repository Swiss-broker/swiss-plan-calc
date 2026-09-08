-- Documente la structure réelle de admin_users (vérifiée en direct :
-- id/user_id/email/display_name/created_at/settings). CREATE TABLE IF
-- NOT EXISTS est un no-op puisque la table existe déjà aujourd'hui.
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb NOT NULL DEFAULT '{"theme": "night", "display_name_override": null}'::jsonb
);

-- Index unique réel constaté en base ; IF NOT EXISTS le rend sûr à rejouer.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users (user_id);

-- RLS déjà active en production ; ré-exécuter est sans risque et garantit
-- qu'une éventuelle recréation de la table ne se retrouve jamais sans RLS.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
