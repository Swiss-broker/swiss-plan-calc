-- Permet d'enregistrer le régime d'assurance maladie réellement choisi par
-- un client frontalier (CMU ou LAMal), pour que le calculateur "CMU vs
-- LAMal" et la synthèse PDF cessent de PRÉSUMER systématiquement que la
-- situation actuelle est la CMU et l'optimisation la LAMal : jusqu'ici rien
-- ne demandait jamais au client lequel des deux il a réellement choisi.
-- Nullable = "non renseigné", jamais de valeur par défaut qui prétendrait
-- connaître la réponse.
create type health_insurance_regime as enum ('cmu', 'lamal');

alter table public.clients
  add column health_insurance_regime health_insurance_regime;

comment on column public.clients.health_insurance_regime is
  'Régime santé réellement choisi par un client frontalier (CMU ou LAMal) via le droit d''option. NULL = non renseigné. Sans objet pour un résident suisse (toujours LAMal, pas de choix).';
