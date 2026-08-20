-- Sépare l'ancienne valeur "executive" (libellée "Plan cadres / 1e", qui
-- mélangeait deux régimes LPP fiscalement différents : sur-obligatoire
-- classique ~362'880 CHF de plafond vs plan 1e jusqu'à 860'000 CHF) en
-- ajoutant une valeur distincte "plan_1e". "extra_mandatory" couvre déjà le
-- cas sur-obligatoire/cadres classique. "executive" reste dans l'enum pour
-- compatibilité (aucune ligne existante ne l'utilise au moment de cette
-- migration — vérifié), mais n'est plus proposé dans le formulaire fiche
-- client (voir ClientWizard.tsx) : les nouveaux choix sont mandatory,
-- extra_mandatory, plan_1e, mixed.
ALTER TYPE public.lpp_plan_type ADD VALUE IF NOT EXISTS 'plan_1e';
