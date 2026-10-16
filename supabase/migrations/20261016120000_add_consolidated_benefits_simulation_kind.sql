-- Permet de sauvegarder un instantané des "Prestations consolidées"
-- (vue dérivée des dernières simulations AVS/AI, LPP et 3a du dossier,
-- actuel vs optimisé) dans l'historique client, pour qu'il apparaisse
-- dans la synthèse PDF du rendez-vous comme toutes les autres
-- simulations. Jusqu'ici cette page n'avait aucun bouton "Enregistrer"
-- faute d'un type reconnu par simulation_history.kind.
alter type simulation_kind add value if not exists 'consolidated_benefits';
