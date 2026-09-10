-- Nouveau plan 'demo' : comptes @swissbrokerpro.ch (admins et commerciaux,
-- voir admin_users) utilisés uniquement pour le panel team et un mode démo
-- dédié sur l'app courtier — jamais un compte de production. Même
-- traitement que 'internal' (court-circuit de la porte de paiement), mais
-- distingué pour pouvoir : afficher un bandeau "Mode démo" (TÂCHE 2),
-- court-circuiter le paiement RDV sans jamais toucher au flux Stripe réel
-- (TÂCHE 3), et repérer ces comptes sans ambiguïté dans un futur audit.
ALTER TYPE public.broker_plan ADD VALUE IF NOT EXISTS 'demo';
