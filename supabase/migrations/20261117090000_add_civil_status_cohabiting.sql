-- Union libre / concubinage : statut distinct de « célibataire » sur la fiche
-- client. Fiscalement, chaque partenaire est imposé séparément (barème
-- personne seule, barème H possible pour le parent qui assume l'entretien
-- des enfants), mais le conseiller doit pouvoir l'enregistrer tel quel :
-- c'est lui qui conditionne le choix du barème H entre les deux parents.
alter type public.civil_status add value if not exists 'cohabiting';
