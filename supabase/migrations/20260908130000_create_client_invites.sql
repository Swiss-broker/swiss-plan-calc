-- Invitations d'onboarding post-démo (générées par une future Edge
-- Function au webhook Stripe, validées par une future route publique
-- d'onboarding). Même esprit que client_document_links : token unique,
-- expiration, révocation — jamais manipulée directement par un client
-- authentifié.
CREATE TABLE IF NOT EXISTS public.client_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id),
  email           text NOT NULL,
  plan            text NOT NULL,
  token           text NOT NULL UNIQUE,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at         timestamptz,
  revoked         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Verrouille plan aux 3 offres attendues, même idiome que
-- demo_requests.status et admin_users.role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_invites_plan_check'
  ) THEN
    ALTER TABLE public.client_invites
      ADD CONSTRAINT client_invites_plan_check
      CHECK (plan IN ('starter', 'pro', 'cabinet'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_invites_demo_request_id_idx
  ON public.client_invites (demo_request_id);

-- RLS activée, AUCUNE policy : ni admin, ni commercial, ni personne
-- d'authentifié n'a d'accès direct. Seul service_role (bypass RLS
-- natif) pourra lire/écrire cette table, depuis les futures Edge
-- Functions (génération au webhook Stripe, validation à l'onboarding).
ALTER TABLE public.client_invites ENABLE ROW LEVEL SECURITY;
