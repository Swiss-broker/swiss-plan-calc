-- Stocke le corps réellement envoyé (édité librement avant envoi, donc
-- potentiellement différent du modèle) pour pouvoir le revoir depuis la
-- fiche lead. NULL pour les lignes déjà existantes, écrites avant cette
-- colonne.
alter table public.lead_email_log add column body text;
