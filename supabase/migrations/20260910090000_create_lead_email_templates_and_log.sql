-- Système d'emails commerciaux (leads démo/vente), parallèle et
-- indépendant du système client existant (email_templates /
-- client_email_log) : mêmes principes (surcharge par personne, journal en
-- lecture seule pour l'auteur), adapté à demo_requests/admin_users au lieu
-- de clients/profiles.

-- Surcharges de modèles par commercial (ou admin utilisant le panel
-- commercial) : en l'absence de ligne ici pour une clé donnée, c'est le
-- modèle par défaut (src/lib/salesTemplates.ts, swiss-broker-admin) qui
-- fait foi — même logique que email_templates pour les courtiers.
CREATE TABLE IF NOT EXISTS public.lead_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN (
    'confirmation_demo', 'envoi_offre', 'relance_j3', 'relance_j7', 'relance_finale_j14'
  )),
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commercial_id, template_key)
);

ALTER TABLE public.lead_email_templates ENABLE ROW LEVEL SECURITY;

-- is_admin() peut tout voir (supervision), mais n'édite que ses propres
-- surcharges au même titre que n'importe quel commercial : aucune policy
-- ne permet à un admin de modifier la surcharge de quelqu'un d'autre, ce
-- n'était pas demandé et casserait la personnalisation de chacun.
CREATE POLICY "lead_email_templates_select" ON public.lead_email_templates
  FOR SELECT TO authenticated
  USING (auth.uid() = commercial_id OR is_admin(auth.uid()));

CREATE POLICY "lead_email_templates_insert" ON public.lead_email_templates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = commercial_id);

CREATE POLICY "lead_email_templates_update" ON public.lead_email_templates
  FOR UPDATE TO authenticated
  USING (auth.uid() = commercial_id)
  WITH CHECK (auth.uid() = commercial_id);

CREATE POLICY "lead_email_templates_delete" ON public.lead_email_templates
  FOR DELETE TO authenticated
  USING (auth.uid() = commercial_id);

-- Journal des emails envoyés à un lead. Écriture uniquement via
-- send-lead-email (service role, RLS contournée) : aucune policy
-- INSERT/UPDATE/DELETE pour authenticated, exactement comme
-- client_email_log n'en a pas non plus.
CREATE TABLE IF NOT EXISTS public.lead_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id) ON DELETE CASCADE,
  commercial_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text,
  subject text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_email_log ENABLE ROW LEVEL SECURITY;

-- Visibilité alignée sur demo_requests (pas sur commercial_id figé au
-- moment de l'envoi) : si un lead est réassigné, le nouveau commercial
-- voit l'historique complet des échanges avec ce lead, et l'ancien
-- commercial le perd — cohérent avec le fait qu'il perd déjà l'accès au
-- lead lui-même dans ce cas.
CREATE POLICY "lead_email_log_select" ON public.lead_email_log
  FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.demo_requests d
      WHERE d.id = lead_email_log.demo_request_id AND d.assigned_to = auth.uid()
    )
  );
