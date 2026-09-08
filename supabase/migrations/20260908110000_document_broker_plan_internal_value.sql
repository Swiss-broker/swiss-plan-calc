-- Documente la valeur 'internal' de broker_plan (comptes Karlyta/James),
-- déjà présente en base sans migration correspondante. Aucune donnée
-- touchée : ADD VALUE IF NOT EXISTS est un no-op puisque la valeur existe
-- déjà. Isolée seule dans son fichier car ADD VALUE ne peut pas être
-- annulée dans une transaction, ni utilisée dans la même transaction
-- qu'une requête qui s'en sert immédiatement après.
ALTER TYPE public.broker_plan ADD VALUE IF NOT EXISTS 'internal';
