-- Corrige un oubli de la migration 20260910120000_add_demo_broker_plan.sql :
-- le plan 'demo' avait bien ete ajoute a PLAN_LIMITS cote frontend (illimite,
-- meme traitement que 'internal'), mais ces 4 fonctions de quota cote base
-- (creees le 28 aout, avant l'existence du plan 'demo') ne le connaissaient
-- pas et le faisaient tomber dans le "else 0" -> un compte demo etait
-- bloque des la toute premiere creation de client ou de societe.
create or replace function public.enforce_client_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_plan public.broker_plan;
  v_max integer;
  v_count integer;
begin
  select plan into v_plan from public.profiles where id = new.broker_id;

  v_max := case v_plan
    when 'trial' then 20
    when 'starter' then 10
    when 'pro' then 20
    when 'cabinet' then null
    when 'internal' then null
    when 'demo' then null
    when 'enterprise' then null
    else 0
  end;

  if v_max is not null then
    select count(*) into v_count
    from public.plan_quota_events
    where broker_id = new.broker_id
      and entity_type = 'client'
      and occurred_at >= date_trunc('month', now());

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % clients atteint pour ce mois', v_max;
    end if;
  end if;

  insert into public.plan_quota_events (broker_id, entity_type, entity_id)
  values (new.broker_id, 'client', new.id);

  return new;
end;
$function$;

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
    when 'demo' then null
    when 'enterprise' then null
    else 0
  end;

  if v_max is not null then
    select count(*) into v_count
    from public.plan_quota_events
    where broker_id = new.broker_id
      and entity_type = 'client'
      and occurred_at >= date_trunc('month', now());

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % clients atteint pour ce mois', v_max;
    end if;
  end if;

  insert into public.plan_quota_events (broker_id, entity_type, entity_id)
  values (new.broker_id, 'client', new.id);

  new.created_at := now();

  return new;
end;
$function$;

create or replace function public.enforce_company_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_plan public.broker_plan;
  v_max integer;
  v_count integer;
begin
  select plan into v_plan from public.profiles where id = new.broker_id;

  v_max := case v_plan
    when 'trial' then 4
    when 'starter' then 2
    when 'pro' then 4
    when 'cabinet' then null
    when 'internal' then null
    when 'demo' then null
    when 'enterprise' then null
    else 0
  end;

  if v_max is not null then
    select count(*) into v_count
    from public.plan_quota_events
    where broker_id = new.broker_id
      and entity_type = 'company'
      and occurred_at >= date_trunc('month', now());

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % societes atteint pour ce mois', v_max;
    end if;
  end if;

  insert into public.plan_quota_events (broker_id, entity_type, entity_id)
  values (new.broker_id, 'company', new.id);

  return new;
end;
$function$;

create or replace function public.enforce_company_limit_on_identity_change()
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
  if new.legal_name is distinct from old.legal_name then v_changed := v_changed + 1; end if;
  if new.ide_number is distinct from old.ide_number then v_changed := v_changed + 1; end if;
  if new.vat_number is distinct from old.vat_number then v_changed := v_changed + 1; end if;

  if v_changed < 2 then
    return new;
  end if;

  select plan into v_plan from public.profiles where id = new.broker_id;

  v_max := case v_plan
    when 'trial' then 4
    when 'starter' then 2
    when 'pro' then 4
    when 'cabinet' then null
    when 'internal' then null
    when 'demo' then null
    when 'enterprise' then null
    else 0
  end;

  if v_max is not null then
    select count(*) into v_count
    from public.plan_quota_events
    where broker_id = new.broker_id
      and entity_type = 'company'
      and occurred_at >= date_trunc('month', now());

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % societes atteint pour ce mois', v_max;
    end if;
  end if;

  insert into public.plan_quota_events (broker_id, entity_type, entity_id)
  values (new.broker_id, 'company', new.id);

  new.created_at := now();

  return new;
end;
$function$;
