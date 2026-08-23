-- Tables remplacées par simulation_history, jamais alimentées par le code
-- applicatif (0 ligne, aucun chemin d'INSERT/SELECT dans src/), confirmées
-- via un audit exhaustif du code client et des edge functions. Les seuls
-- usages restants (nettoyage à la suppression d'un client, réassignation
-- lors d'un retrait de membre de cabinet) ont été retirés du code au
-- préalable dans ce même lot de changements.
DROP TABLE IF EXISTS public.simulations;
DROP TABLE IF EXISTS public.scenarios;
