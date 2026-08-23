-- La couleur par défaut du PDF (#0F4C81 bleu marine) ne correspondait à
-- rien : la vraie identité du logiciel est un teal (--primary) et un
-- amber (--accent), voir src/styles.css. Les courtiers qui n'ont jamais
-- personnalisé leur couleur recevaient donc un PDF dans une couleur que
-- le logiciel lui-même n'utilise nulle part.
ALTER TABLE public.profiles ALTER COLUMN pdf_primary_color SET DEFAULT '#008F83';
ALTER TABLE public.profiles ALTER COLUMN pdf_accent_color SET DEFAULT '#F7A224';

-- Rattrape les profils déjà créés avec l'ancien défaut, mais seulement
-- ceux qui n'ont jamais rien personnalisé (correspondance exacte à
-- l'ancienne valeur par défaut) — ne touche à aucune couleur choisie
-- délibérément par un courtier.
UPDATE public.profiles
SET pdf_primary_color = '#008F83'
WHERE pdf_primary_color = '#0F4C81';

UPDATE public.profiles
SET pdf_accent_color = '#F7A224'
WHERE pdf_accent_color = '#3B82F6';
