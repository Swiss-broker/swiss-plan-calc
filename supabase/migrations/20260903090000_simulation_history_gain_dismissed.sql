-- Permet d'archiver une "optimisation identifiée" (bloc synthèse RDV) sans
-- supprimer la simulation sous-jacente. Utilisé quand le gain chiffré n'est
-- pas pertinent pour un client donné (ex: écart de rente AVS non actionnable
-- au-delà de 5 ans de régularisation rétroactive, cf. AVS_2026.retroactiveContributionYears).
alter table public.simulation_history
  add column if not exists gain_dismissed boolean not null default false;

comment on column public.simulation_history.gain_dismissed is
  'Masque ce gain du bloc "Optimisations identifiées" (carte fiche client + PDF synthèse RDV) sans supprimer la simulation. Action réversible.';
