-- La table public.clients utilise des GRANT au niveau colonne (et non un
-- GRANT global sur la table) pour le rôle authenticated. La migration
-- 20261006160000_add_family_allowances_to_clients.sql a ajouté la colonne
-- family_allowances mais, comme deja arrive une fois pour income_currency
-- (voir 20260908091500_client_income_currency_grants.sql), a oublie de lui
-- donner le droit UPDATE pour authenticated. Resultat : l'enregistrement de
-- la fiche client echoue avec "permission denied for table clients" des
-- que le formulaire envoie cette colonne dans son UPDATE -- c'est-a-dire a
-- chaque sauvegarde, puisque le formulaire renvoie tout l'objet client.
grant update (family_allowances) on public.clients to authenticated;
