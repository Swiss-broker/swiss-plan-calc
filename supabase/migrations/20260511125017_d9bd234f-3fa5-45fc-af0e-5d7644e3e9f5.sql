
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdf_primary_color TEXT NOT NULL DEFAULT '#0F4C81',
  ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS pdf_footer_note TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS arrival_year_ch INTEGER,
  ADD COLUMN IF NOT EXISTS cross_border_start_year INTEGER,
  ADD COLUMN IF NOT EXISTS avs_contribution_start_year INTEGER;
