-- Journal des changements de plan (broker_plan), qu'ils viennent d'un
-- webhook Stripe (paiement, échec, résiliation) ou d'une action manuelle
-- d'un admin. Sert deux besoins : (1) visibilité admin sur les échecs de
-- paiement/résiliations récents (aujourd'hui invisible : le webhook change
-- juste profiles.plan sans laisser aucune trace de la raison), et (2)
-- traçabilité des changements manuels faits depuis le panel admin.
CREATE TABLE public.plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_plan public.broker_plan,
  new_plan public.broker_plan NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'checkout_completed', 'subscription_deleted', 'payment_failed', 'admin_override'
  )),
  -- Rempli uniquement pour reason='admin_override' : qui a fait le changement.
  changed_by uuid REFERENCES auth.users(id),
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_events_broker_id_created_at_idx ON public.plan_events (broker_id, created_at DESC);
CREATE INDEX plan_events_created_at_idx ON public.plan_events (created_at DESC);

ALTER TABLE public.plan_events ENABLE ROW LEVEL SECURITY;

-- Écriture réservée au service role (edge functions), comme le reste des
-- tables système équivalentes de ce projet : aucun GRANT client.
REVOKE ALL ON public.plan_events FROM authenticated, anon;
GRANT SELECT ON public.plan_events TO authenticated;

CREATE POLICY "admin_read_plan_events" ON public.plan_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
