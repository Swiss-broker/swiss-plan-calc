-- Table pour stocker les comptes Stripe Connect des courtiers
CREATE TABLE public.broker_connect_accounts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(broker_id)
);

ALTER TABLE public.broker_connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers view their own connect account"
  ON public.broker_connect_accounts FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers insert their own connect account"
  ON public.broker_connect_accounts FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers update their own connect account"
  ON public.broker_connect_accounts FOR UPDATE
  USING (auth.uid() = broker_id);

-- Table pour les facturations RDV
CREATE TABLE public.rdv_invoices (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount_chf INTEGER NOT NULL, -- en centimes
  stripe_payment_intent_id TEXT,
  stripe_payment_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  pdf_unlocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rdv_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers view their own invoices"
  ON public.rdv_invoices FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers insert their own invoices"
  ON public.rdv_invoices FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers update their own invoices"
  ON public.rdv_invoices FOR UPDATE
  USING (auth.uid() = broker_id);
