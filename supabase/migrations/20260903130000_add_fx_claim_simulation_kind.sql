-- Permet de sauvegarder les simulations du calculateur "Réclamation taux de
-- change" dans l'historique client, pour qu'elles apparaissent dans la
-- synthèse RDV comme toutes les autres (jusqu'ici ce calculateur ne
-- produisait qu'un courrier PDF autonome, jamais rattaché au dossier client).
alter type simulation_kind add value if not exists 'fx_claim';
