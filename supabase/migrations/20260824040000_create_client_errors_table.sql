-- Journal des erreurs côté client (JS non catchées, promesses rejetées,
-- erreurs de rendu React), pour donner à l'équipe une visibilité qu'elle
-- n'avait pas aujourd'hui : un bug rencontré par un courtier n'était visible
-- que s'il prenait la peine d'envoyer un feedback. Aucun écran blanc muet
-- ne devrait plus se produire sans laisser de trace consultable.
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_errors_created_at_idx ON public.client_errors (created_at DESC);
CREATE INDEX client_errors_broker_id_idx ON public.client_errors (broker_id);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Un courtier connecté peut journaliser une erreur qu'il vient de
-- rencontrer, mais uniquement sous sa propre identité (jamais au nom
-- d'un autre broker_id) ; aucun droit de lecture côté client, ni
-- d'update/delete — ce journal n'est consultable que par l'équipe admin.
REVOKE ALL ON public.client_errors FROM authenticated, anon;
GRANT INSERT (broker_id, message, stack, url, user_agent, context) ON public.client_errors TO authenticated;
GRANT SELECT ON public.client_errors TO authenticated;

CREATE POLICY "broker_insert_own_client_errors" ON public.client_errors
  FOR INSERT TO authenticated
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "admin_read_client_errors" ON public.client_errors
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()));
