-- Permet de sauvegarder les simulations du nouveau calculateur "Caisse
-- maladie résident" (comparatif LAMal actuel vs optimisé pour un client
-- résident) dans l'historique client, pour qu'elles apparaissent dans la
-- synthèse RDV comme toutes les autres simulations.
alter type simulation_kind add value if not exists 'health_insurance_resident';
