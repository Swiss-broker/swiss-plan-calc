-- Meme faille que sur clients (voir enforce_client_limit_on_identity_change) :
-- enforce_company_limit() ne se declenche que sur INSERT, donc un courtier
-- pouvait recycler une fiche societe existante (raison sociale, IDE, TVA)
-- pour "devenir" une nouvelle societe sans consommer son quota mensuel.
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
    from public.companies
    where broker_id = new.broker_id
      and created_at >= date_trunc('month', now())
      and id != new.id;

    if v_count >= v_max then
      raise exception 'PLAN_LIMIT_REACHED: maximum % societes atteint pour ce mois', v_max;
    end if;
  end if;

  new.created_at := now();

  return new;
end;
$function$;

revoke all on function public.enforce_company_limit_on_identity_change() from public, anon, authenticated;

create trigger trg_enforce_company_limit_on_identity_change
  before update on public.companies
  for each row execute function public.enforce_company_limit_on_identity_change();
