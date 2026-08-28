-- Ni le comptage de lignes "clients"/"companies" ni le fait de mettre a
-- jour created_at ne suffisent : un courtier avec de la marge sous son
-- quota pouvait recycler LA MEME fiche plusieurs fois dans le mois sans
-- jamais etre bloque, parce que le nombre de LIGNES physiques ne bouge
-- pas quand on recycle une fiche existante. Il faut un vrai registre
-- d'evenements qui ne s'efface jamais dans le mois : chaque creation ET
-- chaque changement d'identite substantiel consomme une unite, pour de
-- bon, meme si c'est toujours la meme ligne qui est reutilisee.
create table public.plan_quota_events (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('client', 'company')),
  entity_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index idx_plan_quota_events_broker_month
  on public.plan_quota_events(broker_id, entity_type, occurred_at);

alter table public.plan_quota_events enable row level security;
-- Aucune policy pour authenticated : ce registre n'est jamais lu ni ecrit
-- directement par le navigateur, uniquement par les triggers SECURITY
-- DEFINER ci-dessous.

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

  -- Toujours mis a jour : reflete que cette ligne represente une identite
  -- differente a partir de maintenant (utile pour l'affichage "client
  -- depuis", independant du registre de quota ci-dessus).
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
