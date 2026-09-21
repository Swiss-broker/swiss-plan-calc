-- Permet la création manuelle d'un lead ("Nouveau RDV" côté panel
-- Commercial), pour un contact reçu hors Cal.com (téléphone, en direct).
-- Jusqu'ici seule capture-demo-lead (service role, bypass RLS) pouvait
-- insérer dans demo_requests — aucune policy INSERT n'existait pour un
-- compte staff authentifié. Un commercial ne peut créer un lead que déjà
-- assigné à lui-même (même symétrie que commercial_update_own_demo_requests),
-- un admin peut assigner librement.
create policy staff_insert_demo_requests
  on public.demo_requests
  for insert
  to public
  with check (is_admin(auth.uid()) or assigned_to = auth.uid());
