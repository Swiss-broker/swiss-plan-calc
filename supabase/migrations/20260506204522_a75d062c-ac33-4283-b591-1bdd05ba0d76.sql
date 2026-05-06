-- Enum forme juridique
CREATE TYPE public.company_legal_form AS ENUM ('sarl', 'sa', 'cooperative', 'association', 'other');

-- Table companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  legal_form public.company_legal_form NOT NULL DEFAULT 'sarl',
  ide_number text,
  vat_number text,
  founding_year integer,
  canton char(2),
  annual_revenue numeric,
  annual_profit numeric,
  retained_earnings numeric,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_ide_format CHECK (ide_number IS NULL OR ide_number ~ '^CHE-\d{3}\.\d{3}\.\d{3}$'),
  CONSTRAINT companies_founding_year_range CHECK (founding_year IS NULL OR (founding_year BETWEEN 1800 AND 2100))
);

CREATE INDEX idx_companies_broker_id ON public.companies(broker_id);
CREATE INDEX idx_companies_broker_archived ON public.companies(broker_id, archived);

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers view their own companies"
  ON public.companies FOR SELECT
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers create their own companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = broker_id);

CREATE POLICY "Brokers update their own companies"
  ON public.companies FOR UPDATE
  USING (auth.uid() = broker_id);

CREATE POLICY "Brokers delete their own companies"
  ON public.companies FOR DELETE
  USING (auth.uid() = broker_id);

-- Trigger updated_at (réutilise touch_updated_at existant)
CREATE TRIGGER companies_touch_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ajout colonne company_id sur clients avec FK ON DELETE SET NULL
ALTER TABLE public.clients
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_company_id ON public.clients(company_id) WHERE company_id IS NOT NULL;