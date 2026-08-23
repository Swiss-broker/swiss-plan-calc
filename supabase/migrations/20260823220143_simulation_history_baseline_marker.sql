-- Marqueur explicite de "situation actuelle" pour le dossier PDF : le
-- courtier choisit lui-même quelle sauvegarde d'un calculateur, pour un
-- client donné, sert de référence ("situation actuelle"). La sauvegarde la
-- plus récente du même (client_id, kind) devient alors automatiquement la
-- "situation projetée" comparée à cette référence — ce n'est plus une
-- question d'ordre de sauvegarde.
ALTER TABLE public.simulation_history
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

-- Une seule référence active à la fois par client et par calculateur.
CREATE UNIQUE INDEX IF NOT EXISTS simulation_history_one_baseline_per_client_kind
  ON public.simulation_history (client_id, kind)
  WHERE is_baseline = true;
