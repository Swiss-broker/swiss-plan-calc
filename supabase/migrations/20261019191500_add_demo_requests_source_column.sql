-- Distingue les leads créés manuellement (onglet "Inscription", courtier
-- contacté par téléphone etc.) des réservations démo réelles via Cal.com,
-- pour affichage d'un badge dans la liste et la fiche (demandé par Sarah).
alter table public.demo_requests
  add column source text not null default 'cal_com'
  check (source in ('cal_com', 'manual'));

comment on column public.demo_requests.source is
  'Origine du lead : cal_com (réservation démo réelle, défaut) ou manual (créé depuis l''onglet Inscription, sans démo).';
