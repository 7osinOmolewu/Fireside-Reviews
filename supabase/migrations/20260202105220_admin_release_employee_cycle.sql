-- 20260202105220_admin_release_employee_cycle.sql
-- Admin: release employee review outcome for a given cycle
-- Idempotent, audited, admin-only

create or replace function public.admin_release_employee_cycle(
  p_cycle_id uuid,
  p_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row_id uuid;
  v_before jsonb;
  v_after  jsonb;
begin
  -- Must be authenticated
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  -- Must be admin
  if not exists (
    select 1
    from public.admin_users au
    where au.id = v_actor
  ) then
    raise exception 'Not authorized';
  end if;

  -- Capture BEFORE state for audit
  select to_jsonb(p)
    into v_before
  from public.cycle_employee_summary_public p
  where p.cycle_id = p_cycle_id
    and p.employee_id = p_employee_id;

  if v_before is null then
    raise exception
      'No public summary row found for cycle %, employee %',
      p_cycle_id,
      p_employee_id;
  end if;

  -- Release (idempotent)
  update public.cycle_employee_summary_public p
     set released_at = coalesce(p.released_at, now()),
         released_by = coalesce(p.released_by, v_actor),
         performance_rating_value =
           case p.performance_rating
             when 'EXCEEDS' then 5
             when 'MEETS' then 3
             when 'NEEDS_DEVELOPMENT' then 1
             else null
           end,
         updated_at = now()
   where p.cycle_id = p_cycle_id
     and p.employee_id = p_employee_id
  returning p.id into v_row_id;

  -- Capture AFTER state for audit
  select to_jsonb(p)
    into v_after
  from public.cycle_employee_summary_public p
  where p.id = v_row_id;

  -- Write audit log
  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    created_at
  )
  values (
    v_actor,
    'release_employee_cycle',
    'cycle_employee_summary_public',
    v_row_id,
    v_before,
    v_after,
    now()
  );
end;
$$;
