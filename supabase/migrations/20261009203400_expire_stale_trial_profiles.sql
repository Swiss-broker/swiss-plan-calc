-- Cotisation annuelle SwissBroker Pro : il n'existe plus d'essai gratuit à
-- durée indéterminée. Les quelques comptes encore en 'trial' (anciens
-- leads/tests jamais convertis, confirmé sans risque avant exécution) sont
-- basculés en 'expired' comme n'importe quel abonnement non renouvelé.
update public.profiles set plan = 'expired' where plan = 'trial';
