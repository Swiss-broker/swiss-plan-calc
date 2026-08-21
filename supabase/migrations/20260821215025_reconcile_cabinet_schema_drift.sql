-- Réconciliation de dérive de schéma : gestion cabinet (hiérarchie
-- directeur/courtier, invitations, annonces d'équipe).
--
-- Ces colonnes et tables existent déjà en production mais n'étaient
-- jusqu'ici versionnées nulle part dans supabase/migrations/ — elles ont
-- été ajoutées directement en base, hors du flux de migrations normal
-- (découvert lors du scoping du backlog "Gestion cabinet", 08/2026).
-- Conséquence concrète : reconstruire la base uniquement depuis les
-- migrations versionnées aurait produit un schéma incomplet, sans la
-- fonctionnalité cabinet.
--
-- Cette migration ne modifie RIEN en production (tout existe déjà,
-- IF NOT EXISTS partout) : elle documente et versionne fidèlement l'état
-- réel de la base, vérifié colonne par colonne, contrainte par contrainte
-- et index par index via introspection SQL directe au moment de l'écriture.

-- === profiles : hiérarchie cabinet (root_director → director → courtier) ===
-- Un "cabinet" n'est pas une entité à part : son identité EST le profil du
-- root_director (cabinet_root_id pointe vers lui). manager_id = le
-- root_director ou director qui a invité ce profil.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cabinet_root_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cabinet_role TEXT
    CHECK (cabinet_role = ANY (ARRAY['root_director', 'director', 'courtier'])),
  ADD COLUMN IF NOT EXISTS monthly_target_amount INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_target_clients INTEGER;

CREATE INDEX IF NOT EXISTS idx_profiles_cabinet_root_id ON public.profiles USING btree (cabinet_root_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles USING btree (manager_id);

-- monthly_target_amount / monthly_target_clients : présentes en base mais
-- non lues ni écrites nulle part dans le code applicatif actuel (vérifié) —
-- reliquat d'une fonctionnalité d'objectifs mensuels jamais branchée, ou
-- ajoutées pour un test. Conservées telles quelles pour fidélité au schéma
-- réel ; à clarifier séparément si elles doivent être supprimées ou finies.

-- === cabinet_invites : invitations à rejoindre un cabinet ===
CREATE TABLE IF NOT EXISTS public.cabinet_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_root_id UUID NOT NULL REFERENCES public.profiles(id),
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL CHECK (role = ANY (ARRAY['director', 'courtier'])),
  payer TEXT NOT NULL DEFAULT 'cabinet' CHECK (payer = ANY (ARRAY['cabinet', 'self'])),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'accepted', 'revoked'])),
  token TEXT NOT NULL UNIQUE,
  stripe_subscription_item_id TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cabinet_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cabinet_invites_invited_by ON public.cabinet_invites USING btree (invited_by);

-- Aucune policy RLS définie (vérifié : 0 ligne dans pg_policies) — c'est
-- voulu, pas un oubli : RLS activée + zéro policy = accès direct refusé à
-- tout rôle non privilégié. Cette table n'est lue/écrite que par les Edge
-- Functions (cabinet-add-seat, cabinet-cancel-invite, team-dashboard-data,
-- team-post-announcement, ...) via la clé service_role, qui contourne RLS.

-- === team_announcements : annonces du directeur à son équipe ===
CREATE TABLE IF NOT EXISTS public.team_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_root_id UUID NOT NULL REFERENCES public.profiles(id),
  posted_by UUID NOT NULL REFERENCES public.profiles(id),
  target_id UUID REFERENCES public.profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_team_announcements_cabinet_root ON public.team_announcements USING btree (cabinet_root_id);

-- Même logique que cabinet_invites : aucune policy RLS (vérifié), accès
-- exclusivement via Edge Functions avec la clé service_role.
