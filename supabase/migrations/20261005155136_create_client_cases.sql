-- Dossiers client : regroupent les simulations faites pour un même projet
-- (ex. "Projection retraite 2026"), au lieu de tout empiler à plat dans
-- simulation_history. Permet à la synthèse PDF de ne reprendre que les
-- simulations d'un (ou plusieurs) dossier précis, plutôt que toutes les
-- simulations jamais faites pour un client. "closed" se rouvre ("open") :
-- ce n'est jamais une suppression, juste un statut d'organisation.
CREATE TABLE IF NOT EXISTS public.client_cases (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_cases_status_check'
  ) THEN
    ALTER TABLE public.client_cases
      ADD CONSTRAINT client_cases_status_check
      CHECK (status IN ('open', 'closed'));
  END IF;
END $$;

ALTER TABLE public.client_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers view own client cases"
  ON public.client_cases FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers insert own client cases"
  ON public.client_cases FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers update own client cases"
  ON public.client_cases FOR UPDATE
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers delete own client cases"
  ON public.client_cases FOR DELETE
  USING (auth.uid() = broker_id);

CREATE INDEX IF NOT EXISTS idx_client_cases_client
  ON public.client_cases(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_cases_broker
  ON public.client_cases(broker_id);

CREATE TRIGGER trg_client_cases_touch
  BEFORE UPDATE ON public.client_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Rattache (optionnellement) une simulation à un dossier. NULL = simulation
-- enregistrée avant cette fonctionnalité, ou depuis le menu latéral hors
-- fiche client (sans client ni dossier) — traitée côté application comme
-- appartenant au dossier virtuel "Historique" (jamais une vraie ligne ici,
-- calculé à l'affichage pour ne rien réécrire en masse sur les anciennes
-- simulations).
ALTER TABLE public.simulation_history
  ADD COLUMN IF NOT EXISTS case_id UUID NULL REFERENCES public.client_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sim_history_case
  ON public.simulation_history(case_id);
