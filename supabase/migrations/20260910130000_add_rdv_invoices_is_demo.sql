-- Distingue les factures RDV fictives créées en mode démo (voir
-- demo-rdv-invoice) des vraies factures payées via Stripe. Nécessaire pour
-- ne jamais les confondre avec du vrai chiffre d'affaires lors d'un audit,
-- et pour pouvoir les exclure des agrégats financiers admin.
ALTER TABLE public.rdv_invoices
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
