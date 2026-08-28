-- enforce_client_limit() (BEFORE INSERT) protege deja la limite mensuelle
-- de clients, mais ne se declenche jamais sur UPDATE : un courtier pouvait
-- reecrire completement l'identite d'une fiche existante (nom, prenom,
-- date de naissance, genre, nationalite, email) pour "devenir" un nouveau
-- client sans jamais consommer son quota mensuel -- et, accessoirement,
-- reutiliser un deblocage PDF deja paye pour cette ligne.
--
-- Seuil delibere : au moins 2 des 6 champs d'identite doivent changer en
-- un seul UPDATE pour declencher ce controle. Une correction ponctuelle
-- (faute de frappe sur le nom, date de naissance corrigee) ne touche
-- quasiment jamais plus d'un champ a la fois et reste donc libre ; un
-- vrai recyclage de fiche vers une personne differente change forcement
-- plusieurs de ces champs en meme temps.
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
  if new.gender is distinct from old.gender then v_changed := v_changed + 1; end if;
  if new.nationality is distinct from old.nationality then v_changed := v_changed + 1; end if;
  if new.email is distinct from old.email then v_changed := v_changed + 1; end if;

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

  -- Un changement d'identite substantiel repart comme une creation neuve :
  -- la ligne compte desormais pour le quota du mois en cours, exactement
  -- comme si elle venait d'etre inseree.
  new.created_at := now();

  return new;
end;
$function$;

revoke all on function public.enforce_client_limit_on_identity_change() from public, anon, authenticated;

create trigger trg_enforce_client_limit_on_identity_change
  before update on public.clients
  for each row execute function public.enforce_client_limit_on_identity_change();
