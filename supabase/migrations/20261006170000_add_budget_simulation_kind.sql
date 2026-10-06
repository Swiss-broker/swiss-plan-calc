-- Permet de sauvegarder les simulations du nouveau calculateur "Budget"
-- (budget actuel vs budget optimisé, établi en tout début de rendez-vous
-- puis revisité en fin de rendez-vous une fois les optimisations
-- identifiées) dans l'historique client, pour qu'il apparaisse dans la
-- synthèse RDV comme toutes les autres simulations.
alter type simulation_kind add value if not exists 'budget';
