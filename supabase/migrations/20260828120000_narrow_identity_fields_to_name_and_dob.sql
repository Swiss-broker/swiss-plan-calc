-- Email, telephone, genre et nationalite peuvent changer legitimement
-- pour la MEME personne (nouvelle adresse mail, naturalisation...) sans
-- que ce soit un changement d'identite. Seuls nom, prenom et date de
-- naissance sont de vrais marqueurs d'identite ici : on restreint les
-- deux controles (quota mensuel et reverrouillage PDF) a ces 3 champs.

create or replace function public.enforce_client_limit_on_identity_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_plan public.broker_plan;
  v_max integer;
  v_count integer;
  v_changed integer := 0;
begin
  if new.first_name is distinct from old.first_name then v_changed := v_changed + 1; end if;
  if new.last_name is distinct from old.last_name then v_changed := v_changed + 1; end if;
  if new.date_of_birth is distinct from old.date_of_birth then v_changed := v_changed + 1; end if;

  if v_changed < 2 then
    return new;
  end if;

  select plan into v_plan from public.profiles where id = new.broker_id;

  v_max := case v_plan
    when 'trial' then 20
    when 'starter' then 10
    when 'pro' then 20
    when 'cabinet' then null
    when 'internal' then null
    when 'enterprise' then null
    else 0
  end;

  if v_max is not null then
    select count(*) into v_count
    from public.clients
    where broker_id = new.broker_id
      and created_at >= date_trunc('month', now())
      and id != new.id;

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % clients atteint pour ce mois', v_max;
    end if;
  end if;

  new.created_at := now();

  return new;
end;
$function$;

-- Le trigger lui-meme n'a pas besoin de changer (il n'a pas de clause WHEN
-- sur des colonnes precises, la fonction filtre elle-meme).

create or replace function public.sync_pdf_unlock_with_identity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_changed integer := 0;
begin
  if new.first_name is distinct from old.first_name then v_changed := v_changed + 1; end if;
  if new.last_name is distinct from old.last_name then v_changed := v_changed + 1; end if;
  if new.date_of_birth is distinct from old.date_of_birth then v_changed := v_changed + 1; end if;

  if v_changed < 2 then
    return new;
  end if;

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
      snapshot_date_of_birth is distinct from new.date_of_birth
    );

  return new;
end;
$function$;

-- La clause WHEN du trigger doit etre recreee : elle filtrait avant meme
-- d'entrer dans la fonction sur 6 colonnes, on la restreint aux 3 qui
-- comptent desormais (la fonction elle-meme applique en plus le seuil
-- "2 champs sur 3").
drop trigger if exists trg_sync_pdf_unlock_with_identity on public.clients;
create trigger trg_sync_pdf_unlock_with_identity
  after update on public.clients
  for each row
  when (
    new.first_name is distinct from old.first_name or
    new.last_name is distinct from old.last_name or
    new.date_of_birth is distinct from old.date_of_birth
  )
  execute function public.sync_pdf_unlock_with_identity();
