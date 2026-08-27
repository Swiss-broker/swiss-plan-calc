-- Nouvelle catégorie de document manquante : la police/le compte de libre
-- passage (avoir de prévoyance en cas de sortie du 2e pilier sans nouvel
-- employeur), distincte de l'attestation LPP et du 3e pilier.
alter type public.client_document_category add value if not exists 'libre_passage';
