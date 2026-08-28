-- Jusqu'ici, la comparaison "identite actuelle vs instantane pris au
-- paiement" (qui decide si le PDF de synthese reste debloque) n'etait
-- calculee que cote navigateur (SessionSummaryTab.tsx) : rdv_invoices.
-- pdf_unlocked restait physiquement a true en base pour toujours, meme
-- apres un changement d'identite. Un utilisateur technique pouvait donc
-- contourner le bouton grise et regenerer le PDF via un appel direct.
--
-- Cette fonction rend pdf_unlocked vrai au sens propre : des qu'un champ
-- d'identite change sur clients, toute facture ayant deja servi a debloquer
-- ce client est reverrouillee en base si l'identite ne correspond plus a
-- l'instantane pris au paiement -- avant meme que l'ecran n'ait le temps
-- de le recalculer. Meme exception que deja prevue cote frontend : une
-- facture sans instantane (anterieure a l'introduction du snapshot) n'est
-- jamais reverrouillee retroactivement, faute de reference a comparer.
create or replace function public.sync_pdf_unlock_with_identity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  update public.rdv_invoices
  set pdf_unlocked = false
  where client_id = new.id
    and pdf_unlocked = true
    and not (
      snapshot_first_name is null and snapshot_last_name is null and
      snapshot_date_of_birth is null and snapshot_gender is null and
      snapshot_nationality is null and snapshot_email is null
    )
    and (
      snapshot_first_name is distinct from new.first_name or
      snapshot_last_name is distinct from new.last_name or
      snapshot_date_of_birth is distinct from new.date_of_birth or
      snapshot_gender is distinct from new.gender::text or
      snapshot_nationality is distinct from new.nationality or
      snapshot_email is distinct from new.email
    );

  return new;
end;
$function$;

revoke all on function public.sync_pdf_unlock_with_identity() from public, anon, authenticated;

create trigger trg_sync_pdf_unlock_with_identity
  after update on public.clients
  for each row
  when (
    new.first_name is distinct from old.first_name or
    new.last_name is distinct from old.last_name or
    new.date_of_birth is distinct from old.date_of_birth or
    new.gender is distinct from old.gender or
    new.nationality is distinct from old.nationality or
    new.email is distinct from old.email
  )
  execute function public.sync_pdf_unlock_with_identity();
