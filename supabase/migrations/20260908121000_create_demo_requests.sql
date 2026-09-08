-- Table des demandes de démo (leads commerciaux), alimentée par une future
-- Edge Function recevant le webhook Cal.com. Aucune valeur par défaut ne
-- doit être ajustée après coup : CREATE TABLE IF NOT EXISTS rend cette
-- migration rejouable sans risque.
CREATE TABLE IF NOT EXISTS public.demo_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  email          text NOT NULL,
  company_name   text,
  phone          text,
  status         text NOT NULL DEFAULT 'pending',
  notes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to    uuid REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  demo_date      timestamptz,
  follow_up_date timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Verrouille status aux 4 valeurs métier attendues (même idiome que
-- admin_users.role à l'étape précédente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demo_requests_status_check'
  ) THEN
    ALTER TABLE public.demo_requests
      ADD CONSTRAINT demo_requests_status_check
      CHECK (status IN ('pending', 'contacted', 'converted', 'lost'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS demo_requests_assigned_to_idx ON public.demo_requests (assigned_to);
CREATE INDEX IF NOT EXISTS demo_requests_status_idx ON public.demo_requests (status);

-- updated_at : réutilise le trigger déjà existant dans ce projet
-- (touch_updated_at), pas de nouvelle fonction.
DROP TRIGGER IF EXISTS trg_demo_requests_updated ON public.demo_requests;
CREATE TRIGGER trg_demo_requests_updated
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- SELECT : admin voit tout, commercial voit uniquement ses leads assignés.
DROP POLICY IF EXISTS admin_read_demo_requests ON public.demo_requests;
CREATE POLICY admin_read_demo_requests ON public.demo_requests
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS commercial_read_own_demo_requests ON public.demo_requests;
CREATE POLICY commercial_read_own_demo_requests ON public.demo_requests
  FOR SELECT USING (assigned_to = auth.uid());

-- UPDATE : admin modifie tout (y compris assigned_to). Commercial modifie
-- uniquement ses propres leads, et WITH CHECK l'empêche de faire bouger
-- assigned_to (voir explication ci-dessus) : c'est ce qui réserve
-- l'assignation à is_admin() sans policy ni trigger séparés.
DROP POLICY IF EXISTS admin_update_demo_requests ON public.demo_requests;
CREATE POLICY admin_update_demo_requests ON public.demo_requests
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS commercial_update_own_demo_requests ON public.demo_requests;
CREATE POLICY commercial_update_own_demo_requests ON public.demo_requests
  FOR UPDATE USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

-- INSERT : aucune policy pour authenticated/anon, volontairement. Seul
-- service_role (bypass RLS nativement) pourra insérer — depuis la future
-- Edge Function recevant le webhook Cal.com.

-- DELETE : aucune policy — personne ne peut supprimer un lead via l'API.
