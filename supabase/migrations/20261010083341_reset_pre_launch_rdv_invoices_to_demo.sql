-- Reset ponctuel des chiffres du panel admin (Paiements) : avant le vrai
-- lancement, les seules factures RDV non-demo en base venaient des tests
-- internes de l'équipe (Facturer ce RDV sur leurs propres comptes), pas de
-- vrais clients, et remontaient donc à tort comme du chiffre d'affaires.
-- On les marque is_demo=true (comme n'importe quelle facture de démo) :
-- ça les exclut des statistiques admin existantes sans supprimer la ligne.
-- Ne couvre PAS les comptes internes en général (voir conversation) : une
-- future facture réelle sur l'un de ces comptes compte normalement.
update public.rdv_invoices
set is_demo = true
where is_demo = false
  and broker_id in ('e4b22239-4ee2-4f79-b2c4-0d1a26a34093', '8fe00791-7adb-4294-b422-17ac0fd4ea77');
