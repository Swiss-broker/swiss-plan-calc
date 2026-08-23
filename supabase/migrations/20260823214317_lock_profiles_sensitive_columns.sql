-- Empêche un compte authentifié de modifier lui-même les colonnes
-- sensibles de son propre profil via un appel PostgREST direct (avec son
-- propre jeton, en dehors de l'interface). La policy RLS "Brokers update
-- their own profile" (auth.uid() = id) limite déjà les LIGNES modifiables
-- à la sienne propre, mais RLS ne limite pas les COLONNES : sans ce verrou,
-- n'importe quel compte connecté pouvait s'auto-attribuer un plan payant
-- (plan = 'pro'/'cabinet'), ou même un rôle cabinet (cabinet_role =
-- 'root_director'), avec une simple requête API et son propre jeton, sans
-- jamais passer par Stripe ni par une invitation — contournement complet
-- de la porte de paiement ajoutée côté application.
--
-- plan / cabinet_role / cabinet_root_id / manager_id / email / id /
-- created_at ne doivent être modifiés que par les fonctions serveur
-- (service role, qui contourne RLS et ces GRANT), jamais par le client
-- authentifié directement. Seules les colonnes réellement éditées depuis
-- l'app (profil, préférences, PDF, logo, guides vus) restent ouvertes.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

GRANT UPDATE (
  first_name,
  last_name,
  brokerage_name,
  phone,
  default_canton,
  pdf_primary_color,
  pdf_accent_color,
  pdf_footer_note,
  logo_url,
  guides_seen,
  preferred_language
) ON public.profiles TO authenticated;
