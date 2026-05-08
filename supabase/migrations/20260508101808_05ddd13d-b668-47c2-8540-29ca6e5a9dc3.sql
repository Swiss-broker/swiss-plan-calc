-- Étendre l'enum tax_status pour distinguer les régimes fiscaux suisses
-- Ajout : cross_border_fr_1983 (frontalier français accord 1983)
--        cross_border_ge (frontalier travaillant à GE, IS au barème normal)
--        tou (taxation ordinaire ultérieure choisie)
ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'cross_border_fr_1983';
ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'cross_border_ge';
ALTER TYPE public.tax_status ADD VALUE IF NOT EXISTS 'tou';