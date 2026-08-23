-- Suite de la vérification de sécurité globale : même défaut que sur
-- profiles (RLS limite les LIGNES modifiables mais pas les COLONNES, et
-- aucune de ces policies n'a de WITH CHECK), retrouvé sur plusieurs autres
-- tables avec un vrai impact financier ou de confidentialité.

-- 1. rdv_invoices : aucune mise à jour légitime ne vient jamais du
--    navigateur (la création passe par stripe-rdv-invoice, la
--    confirmation de paiement par stripe-webhook, tous deux en
--    service_role qui contourne RLS). Sans ce correctif, un courtier
--    pouvait marquer sa propre facture "paid" et débloquer le PDF de
--    synthèse d'un client sans qu'aucun paiement Stripe réel n'ait eu
--    lieu.
DROP POLICY IF EXISTS "Brokers update their own invoices" ON public.rdv_invoices;

-- 2. user_feedback : aucune mise à jour légitime ne vient du navigateur
--    non plus (uniquement insert + select côté courtier). Sans ce
--    correctif, un courtier pouvait réécrire le statut ou la réponse
--    admin de son propre ticket de feedback. La policy admin
--    (admin_update_user_feedback) n'est pas touchée.
DROP POLICY IF EXISTS "Brokers update their own feedback" ON public.user_feedback;

-- 3. broker_connect_accounts : stripe_account_id et onboarding_complete
--    ne doivent plus jamais être modifiables directement par le client —
--    un courtier aurait pu se déclarer "compte bancaire vérifié" sans
--    jamais terminer l'inscription Stripe, ou pire, rediriger les
--    paiements de ses clients vers un autre compte Stripe en modifiant
--    stripe_account_id. Remplacé par la fonction stripe-connect-status
--    qui vérifie réellement auprès de Stripe avant d'écrire en base.
REVOKE UPDATE ON public.broker_connect_accounts FROM authenticated, anon;

-- 4. clients / companies : un courtier édite légitimement presque tous
--    les champs de ses propres clients/sociétés, mais jamais id/broker_id/
--    created_at. Sans ce correctif, un UPDATE sur sa propre ligne pouvait
--    aussi réassigner broker_id vers n'importe quel autre compte, en
--    dehors du circuit de réassignation contrôlé de cabinet-remove-member.
REVOKE UPDATE ON public.clients FROM authenticated, anon;
GRANT UPDATE (
  first_name, last_name, date_of_birth, civil_status, confession, nationality,
  permit, tax_status, source_tax_scale, canton, commune, postal_code, parish,
  country_of_residence, work_status, activity_rate, employer, gross_annual_salary,
  bonus, other_income, spouse_first_name, spouse_last_name, spouse_date_of_birth,
  spouse_gross_annual_salary, children, email, phone, archived, gender, company_id,
  company_role, tax_status_migrated, arrival_year_ch, cross_border_start_year,
  avs_contribution_start_year, spouse_work_location, activity_sector,
  mortgage_interest_france, spouse_salary_is_fictif
) ON public.clients TO authenticated;

REVOKE UPDATE ON public.companies FROM authenticated, anon;
GRANT UPDATE (
  legal_name, legal_form, ide_number, vat_number, founding_year, canton,
  annual_revenue, annual_profit, retained_earnings, notes, archived, headcount_fte
) ON public.companies TO authenticated;

-- 5. simulation_shares : seuls password_hash et revoked sont modifiés
--    depuis le navigateur (voir ShareSimulationButton.tsx) ; token,
--    max_views, expires_at ne doivent être fixés qu'à la création, et
--    broker_id/simulation_id ne doivent jamais changer.
REVOKE UPDATE ON public.simulation_shares FROM authenticated, anon;
GRANT UPDATE (password_hash, revoked) ON public.simulation_shares TO authenticated;
