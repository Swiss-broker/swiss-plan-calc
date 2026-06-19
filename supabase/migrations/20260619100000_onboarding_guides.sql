-- Suivi des guides interactifs déjà vus par chaque courtier
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guides_seen TEXT[] NOT NULL DEFAULT '{}';
