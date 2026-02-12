


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_user_role" AS ENUM (
    'admin',
    'reviewer',
    'employee'
);


ALTER TYPE "public"."app_user_role" OWNER TO "postgres";


CREATE TYPE "public"."performance_rating" AS ENUM (
    'EXCEEDS',
    'MEETS',
    'NEEDS_DEVELOPMENT'
);


ALTER TYPE "public"."performance_rating" OWNER TO "postgres";


CREATE TYPE "public"."review_cycle_status" AS ENUM (
    'draft',
    'calibrating',
    'finalized'
);


ALTER TYPE "public"."review_cycle_status" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'draft',
    'submitted',
    'finalized'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."reviewer_type" AS ENUM (
    'primary',
    'self',
    'secondary',
    'peer'
);


ALTER TYPE "public"."reviewer_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_release_employee_cycle"("p_cycle_id" "uuid", "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_row_id uuid;
  v_before jsonb;
  v_after  jsonb;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  -- Admin gate
  if not exists (select 1 from public.admin_users au where au.id = v_actor) then
    raise exception 'Not authorized';
  end if;

  -- Capture BEFORE state (for audit)
  select to_jsonb(p)
    into v_before
  from public.cycle_employee_summary_public p
  where p.cycle_id = p_cycle_id
    and p.employee_id = p_employee_id;

  if v_before is null then
    raise exception 'No public summary row found for cycle %, employee %', p_cycle_id, p_employee_id;
  end if;

  -- Release (idempotent: do not overwrite if already released)
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
         updated_at  = now()
   where p.cycle_id = p_cycle_id
     and p.employee_id = p_employee_id
  returning p.id into v_row_id;

  -- Capture AFTER state (for audit)
  select to_jsonb(p)
    into v_after
  from public.cycle_employee_summary_public p
  where p.id = v_row_id;

  -- Audit row (matches your schema)
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


ALTER FUNCTION "public"."admin_release_employee_cycle"("p_cycle_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_employee_id uuid;
  v_cycle_id uuid;
  v_released_at timestamptz;
begin
  -- find review context
  select employee_id, cycle_id
    into v_employee_id, v_cycle_id
  from reviews
  where id = p_review_id;

  if not found then
    raise exception 'Review not found';
  end if;

  -- check release state
  select released_at
    into v_released_at
  from cycle_employee_summary_public
  where employee_id = v_employee_id
    and cycle_id = v_cycle_id;

  if v_released_at is not null then
    raise exception 'Cannot reopen review after release';
  end if;

  -- reopen review
  update reviews
     set status = 'draft',
         submitted_at = null,
         updated_at = now()
   where id = p_review_id;
end;
$$;


ALTER FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_minimum_reviews_submitted"("p_cycle_id" "uuid", "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  primary_count integer;
  self_count integer;
begin
  select count(*) into primary_count
  from public.reviews
  where cycle_id = p_cycle_id
    and employee_id = p_employee_id
    and reviewer_type = 'primary'
    and status in ('submitted', 'finalized');

  select count(*) into self_count
  from public.reviews
  where cycle_id = p_cycle_id
    and employee_id = p_employee_id
    and reviewer_type = 'self'
    and status in ('submitted', 'finalized');

  if primary_count < 1 then
    raise exception 'Cannot finalize. Primary review not submitted for employee=% in cycle=%', p_employee_id, p_cycle_id;
  end if;

  if self_count < 1 then
    raise exception 'Cannot finalize. Self review not submitted for employee=% in cycle=%', p_employee_id, p_cycle_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_minimum_reviews_submitted"("p_cycle_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_weighted_score"("rubric" "text", "category_scores" "jsonb") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  rec record;
  total numeric := 0;
  raw numeric;
begin
  for rec in
    select code, weight
    from public.rubric_categories
    where rubric_id = rubric
      and is_scored = true
  loop
    raw := null;

    if category_scores ? rec.code then
      raw := (category_scores ->> rec.code)::numeric;
    end if;

    if raw is null then
      raise exception 'Missing category score for %', rec.code;
    end if;

    if raw < 0 or raw > 100 then
      raise exception 'Category % score must be between 0 and 100. Got=%', rec.code, raw;
    end if;

    total := total + (raw * (rec.weight::numeric / 100.0));
  end loop;

  return round(total, 2);
end;
$$;


ALTER FUNCTION "public"."compute_weighted_score"("rubric" "text", "category_scores" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_employee_from_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  role_id_to_set uuid;
begin
  if exists (select 1 from public.admin_users au where au.id = new.id) then
    select id into role_id_to_set
    from public.job_roles
    where is_default_admin = true
    limit 1;
  else
    select id into role_id_to_set
    from public.job_roles
    where is_default_employee = true
    limit 1;
  end if;

  if role_id_to_set is null then
    raise exception
      'No default job role configured. Set job_roles.is_default_employee and/or job_roles.is_default_admin.';
  end if;

  insert into public.employees (id, job_role_id, hire_date)
  values (new.id, role_id_to_set, null)
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_employee_from_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_primary_only_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  rtype public.reviewer_type;
begin
  select reviewer_type into rtype
  from public.reviews
  where id = new.review_id;

  if rtype is distinct from 'primary' then
    raise exception 'Scores can only be recorded for PRIMARY reviews. review_id=% has reviewer_type=%', new.review_id, rtype;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_primary_only_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_employee_cycle_summary"("p_cycle_id" "uuid", "p_employee_id" "uuid", "p_final_narrative" "text", "p_calibration_adjustment" integer, "p_calibration_reason" "text", "p_computed_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_job_role_id uuid;
  v_rubric_id text;          -- rubrics.id is TEXT (e.g., 'RUBRIC_DRIVER_V1')
  v_primary_review_id uuid;
  v_scores jsonb;
  v_base numeric;
  v_final numeric;
  v_rating public.performance_rating;
  v_now timestamptz := now();
begin
  -- Gate checks
  perform public.assert_minimum_reviews_submitted(p_cycle_id, p_employee_id);

  -- Calibration validation
  if p_calibration_adjustment is not null then
    if p_calibration_adjustment > 5 or p_calibration_adjustment < -5 then
      raise exception 'Calibration adjustment must be between -5 and 5.';
    end if;

    if p_calibration_adjustment <> 0
       and (p_calibration_reason is null or length(trim(p_calibration_reason)) = 0) then
      raise exception 'Calibration reason is required when adjustment is non-zero.';
    end if;
  end if;

  -- Get employee job_role_id (UUID-based)
  select e.job_role_id
    into v_job_role_id
  from public.employees e
  where e.id = p_employee_id;

  if v_job_role_id is null then
    raise exception 'Employee job_role_id not found for employee_id=%', p_employee_id;
  end if;

  -- Get active rubric for that job_role_id (UUID-based link)
  select r.id
    into v_rubric_id
  from public.rubrics r
  where r.role_id = v_job_role_id
    and r.is_active = true
  order by r.version desc
  limit 1;

  if v_rubric_id is null then
    raise exception 'Active rubric not found for job_role_id=%', v_job_role_id;
  end if;

  -- Find submitted primary review
  select rv.id
    into v_primary_review_id
  from public.reviews rv
  where rv.cycle_id = p_cycle_id
    and rv.employee_id = p_employee_id
    and rv.reviewer_type = 'primary'
    and rv.status in ('submitted', 'finalized')
  order by rv.updated_at desc
  limit 1;

  if v_primary_review_id is null then
    raise exception 'Primary review not found or not submitted for employee=% in cycle=%',
      p_employee_id, p_cycle_id;
  end if;

  -- Pull category scores for that primary review
  select rs.category_scores
    into v_scores
  from public.review_scores rs
  where rs.review_id = v_primary_review_id;

  if v_scores is null then
    raise exception 'Primary review has no score record. review_id=%', v_primary_review_id;
  end if;

  -- Compute base and final
  v_base := public.compute_weighted_score(v_rubric_id, v_scores);

  v_final := v_base + coalesce(p_calibration_adjustment, 0);
  if v_final > 100 then v_final := 100; end if;
  if v_final < 0 then v_final := 0; end if;

  v_rating := public.score_to_rating(v_final);

  -- Upsert internal summary
  insert into public.cycle_employee_summary (
    cycle_id,
    employee_id,
    primary_review_id,
    primary_final_score,
    performance_rating,
    final_narrative_employee_visible,
    admin_calibration_notes,
    calibration_reason,
    finalized_at,
    computed_at,
    computed_by
  ) values (
    p_cycle_id,
    p_employee_id,
    v_primary_review_id,
    v_final,
    v_rating,
    p_final_narrative,
    null,
    p_calibration_reason,
    v_now,
    v_now,
    p_computed_by
  )
  on conflict (cycle_id, employee_id) do update
  set primary_review_id = excluded.primary_review_id,
      primary_final_score = excluded.primary_final_score,
      performance_rating = excluded.performance_rating,
      final_narrative_employee_visible = excluded.final_narrative_employee_visible,
      calibration_reason = excluded.calibration_reason,
      finalized_at = excluded.finalized_at,
      computed_at = excluded.computed_at,
      computed_by = excluded.computed_by,
      updated_at = now();

  -- Upsert employee-safe summary
  insert into public.cycle_employee_summary_public (
    cycle_id,
    employee_id,
    performance_rating,
    final_narrative_employee_visible,
    finalized_at
  ) values (
    p_cycle_id,
    p_employee_id,
    v_rating,
    p_final_narrative,
    v_now
  )
  on conflict (cycle_id, employee_id) do update
  set performance_rating = excluded.performance_rating,
      final_narrative_employee_visible = excluded.final_narrative_employee_visible,
      finalized_at = excluded.finalized_at,
      updated_at = now();

  -- Write computed values back to primary review_scores
  update public.review_scores
  set base_score = v_base,
      calibration_adjustment = coalesce(p_calibration_adjustment, 0),
      final_score = v_final,
      updated_at = now()
  where review_id = v_primary_review_id;

end;
$$;


ALTER FUNCTION "public"."finalize_employee_cycle_summary"("p_cycle_id" "uuid", "p_employee_id" "uuid", "p_final_narrative" "text", "p_calibration_adjustment" integer, "p_calibration_reason" "text", "p_computed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_employee_code"("p_role" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_job_role_id uuid;
  v_prefix text;
  v_next integer;
begin
  select jr.id,
         coalesce(jr.employee_code_prefix, 'EMP')
    into v_job_role_id, v_prefix
  from public.job_roles jr
  where upper(jr.code) = upper(p_role)
  limit 1;

  if v_job_role_id is null then
    raise exception 'Invalid job role code: %', p_role;
  end if;

  insert into public.employee_code_counters(job_role_id, next_num)
  values (v_job_role_id, 2)
  on conflict (job_role_id)
  do update set next_num = public.employee_code_counters.next_num + 1
  returning (public.employee_code_counters.next_num - 1) into v_next;

  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;


ALTER FUNCTION "public"."generate_employee_code"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_employee_code"("p_job_role_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_prefix text;
  v_next integer;
begin
  select coalesce(employee_code_prefix, 'EMP')
    into v_prefix
  from public.job_roles
  where id = p_job_role_id;

  if v_prefix is null then
    raise exception 'Invalid job_role_id: %', p_job_role_id;
  end if;

  insert into public.employee_code_counters(job_role_id, next_num)
  values (p_job_role_id, 2)
  on conflict (job_role_id)
  do update set next_num = public.employee_code_counters.next_num + 1
  returning (public.employee_code_counters.next_num - 1)
  into v_next;

  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;


ALTER FUNCTION "public"."generate_employee_code"("p_job_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_full_name text;
  v_user_role_text text;
  v_user_role public.app_user_role;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'New User'
  );

  v_user_role_text := coalesce(new.raw_user_meta_data->>'user_role', 'employee');

  v_user_role :=
    case v_user_role_text
      when 'admin' then 'admin'::public.app_user_role
      when 'reviewer' then 'reviewer'::public.app_user_role
      when 'employee' then 'employee'::public.app_user_role
      else 'employee'::public.app_user_role
    end;

  insert into public.profiles (
    id, full_name, user_role, is_active, can_review, email, created_at, updated_at
  )
  values (
    new.id, v_full_name, v_user_role, true, false, new.email, now(), now()
  )
  on conflict (id) do update set
    full_name  = excluded.full_name,
    user_role  = excluded.user_role,
    email      = excluded.email,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_cycle_reviewer_rules"("p_cycle_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.cycle_reviewer_rules (cycle_id, reviewer_type, is_scored)
  values
    (p_cycle_id, 'primary', true),
    (p_cycle_id, 'self', false),
    (p_cycle_id, 'peer', false),
    (p_cycle_id, 'secondary', false)
  on conflict (cycle_id, reviewer_type) do nothing;
end;
$$;


ALTER FUNCTION "public"."init_cycle_reviewer_rules"("p_cycle_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."init_cycle_rubrics"("p_cycle_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_prev_cycle_id uuid;
begin
  -- find the most recent existing cycle (excluding the new one)
  select rc.id
    into v_prev_cycle_id
  from public.review_cycles rc
  where rc.id <> p_cycle_id
  order by rc.start_date desc, rc.created_at desc
  limit 1;

  -- If we have a previous cycle and it has assignments, copy them
  if v_prev_cycle_id is not null then
    insert into public.cycle_rubrics (cycle_id, job_role_id, rubric_id)
    select p_cycle_id, cr.job_role_id, cr.rubric_id
    from public.cycle_rubrics cr
    where cr.cycle_id = v_prev_cycle_id
    on conflict (cycle_id, job_role_id) do nothing;

    -- If copy inserted something, we are done
    if found then
      return;
    end if;
  end if;

  -- Fallback: seed from "latest active rubric per role"
  -- If you only ever have 1 rubric per role, this just works.
  insert into public.cycle_rubrics (cycle_id, job_role_id, rubric_id)
  select
    p_cycle_id,
    r.role_id as job_role_id,
    r.id as rubric_id
  from (
    select distinct on (role_id)
      id, role_id, updated_at
    from public.rubrics
    where is_active = true
    order by role_id, updated_at desc
  ) r
  on conflict (cycle_id, job_role_id) do nothing;
end;
$$;


ALTER FUNCTION "public"."init_cycle_rubrics"("p_cycle_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_role = 'admin'
      and p.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_employee_code"("p_role" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
begin
  return public.generate_employee_code(p_role);
end;
$$;


ALTER FUNCTION "public"."make_employee_code"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_employee_number"("p_role" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  v_job_role_id uuid;
  v_next integer;
begin
  select jr.id
    into v_job_role_id
  from public.job_roles jr
  where upper(jr.code) = upper(p_role)
  limit 1;

  if v_job_role_id is null then
    raise exception 'Invalid job role code: %', p_role;
  end if;

  insert into public.employee_code_counters(job_role_id, next_num)
  values (v_job_role_id, 2)
  on conflict (job_role_id)
  do update set next_num = public.employee_code_counters.next_num + 1
  returning (public.employee_code_counters.next_num - 1) into v_next;

  return v_next;
end;
$$;


ALTER FUNCTION "public"."next_employee_number"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_review_edits_after_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.status = 'submitted' then
    -- allow admins to reopen by changing status only
    if new.status is distinct from old.status and public.is_admin(auth.uid()) then
      return new;
    end if;

    raise exception 'Review is already submitted and cannot be edited';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_review_edits_after_submit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_score_edits_after_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  review_status text;
begin
  select status into review_status
  from public.reviews
  where id = new.review_id;

  if review_status = 'submitted' then
    raise exception 'Scores cannot be edited after review submission';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_score_edits_after_submit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rating_to_value"("r" "public"."performance_rating") RETURNS smallint
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case r
    when 'EXCEEDS' then 5
    when 'MEETS' then 3
    when 'NEEDS_DEVELOPMENT' then 1
    else null
  end;
$$;


ALTER FUNCTION "public"."rating_to_value"("r" "public"."performance_rating") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."score_to_rating"("score" numeric) RETURNS "public"."performance_rating"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
begin
  if score is null then
    return null;
  end if;

  if score >= 85 then
    return 'EXCEEDS';
  elsif score >= 70 then
    return 'MEETS';
  else
    return 'NEEDS_DEVELOPMENT';
  end if;
end;
$$;


ALTER FUNCTION "public"."score_to_rating"("score" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."score_to_rating_value"("score" numeric) RETURNS smallint
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select public.rating_to_value(public.score_to_rating(score));
$$;


ALTER FUNCTION "public"."score_to_rating_value"("score" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_employee_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.employee_code is null or new.employee_code = '' then
    if new.job_role_id is not null then
      new.employee_code := public.generate_employee_code(new.job_role_id);
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_employee_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform public.init_cycle_reviewer_rules(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  perform public.init_cycle_rubrics(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_employee"("p_id" "uuid", "p_job_role_id" "uuid", "p_hire_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.employees (id, job_role_id, hire_date, created_at, updated_at)
  values (p_id, p_job_role_id, p_hire_date, now(), now())
  on conflict (id) do update set
    job_role_id = excluded.job_role_id,
    hire_date = excluded.hire_date,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."upsert_employee"("p_id" "uuid", "p_job_role_id" "uuid", "p_hire_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_rubric_weights"("rubric" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  total_weight integer;
begin
  select coalesce(sum(weight), 0) into total_weight
  from public.rubric_categories
  where rubric_id = rubric
    and is_scored = true;

  if total_weight <> 100 then
    raise exception 'Rubric % weights must total 100. Current total=%', rubric, total_weight;
  end if;
end;
$$;


ALTER FUNCTION "public"."validate_rubric_weights"("rubric" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "before_state" "jsonb",
    "after_state" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_employee_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "computed_weighted_score" numeric,
    "calibration_adjustment" numeric DEFAULT 0 NOT NULL,
    "final_score" numeric GENERATED ALWAYS AS ((COALESCE("computed_weighted_score", (0)::numeric) + "calibration_adjustment")) STORED,
    "final_rating" "text",
    "summary_employee_visible_final" "text",
    "released_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cycle_employee_outcomes_final_rating_chk" CHECK ((("final_rating" IS NULL) OR ("final_rating" = ANY (ARRAY['exceeds'::"text", 'meets'::"text", 'needs_development'::"text"]))))
);


ALTER TABLE "public"."cycle_employee_outcomes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_employee_summary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "primary_review_id" "uuid" NOT NULL,
    "primary_final_score" numeric(5,2),
    "performance_rating" "public"."performance_rating",
    "final_narrative_employee_visible" "text",
    "admin_calibration_notes" "text",
    "calibration_reason" "text",
    "finalized_at" timestamp with time zone,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "computed_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "performance_rating_value" smallint
);


ALTER TABLE "public"."cycle_employee_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_employee_summary_public" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "performance_rating" "public"."performance_rating" NOT NULL,
    "final_narrative_employee_visible" "text" NOT NULL,
    "finalized_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "released_at" timestamp with time zone,
    "released_by" "uuid",
    "performance_rating_value" smallint,
    "summary_employee_visible" "text",
    "final_score" numeric
);


ALTER TABLE "public"."cycle_employee_summary_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_reviewer_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "reviewer_type" "public"."reviewer_type" NOT NULL,
    "is_scored" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cycle_reviewer_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cycle_rubrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "job_role_id" "uuid" NOT NULL,
    "rubric_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cycle_rubrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_code_counters" (
    "next_num" integer DEFAULT 1 NOT NULL,
    "job_role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."employee_code_counters" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employee_cycle_results_view" AS
 SELECT "cycle_id",
    "employee_id",
    "performance_rating",
    "performance_rating_value",
    "final_score",
    "final_narrative_employee_visible" AS "summary_employee_visible",
    "released_at",
    "updated_at"
   FROM "public"."cycle_employee_summary_public" "p"
  WHERE (("employee_id" = "auth"."uid"()) AND ("released_at" IS NOT NULL));


ALTER VIEW "public"."employee_cycle_results_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" NOT NULL,
    "hire_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "employee_code" "text",
    "job_role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_roles" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_code_prefix" "text"
);


ALTER TABLE "public"."job_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "user_role" "public"."app_user_role" DEFAULT 'employee'::"public"."app_user_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "can_review" boolean DEFAULT false NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewer_type" "public"."reviewer_type" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."review_cycle_status" DEFAULT 'draft'::"public"."review_cycle_status" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_cycles_dates_valid" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."review_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_scores" (
    "review_id" "uuid" NOT NULL,
    "category_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "base_score" numeric(5,2),
    "calibration_adjustment" integer,
    "final_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_scores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."review_scores_employee_view" AS
 SELECT "review_id",
    "base_score",
    "calibration_adjustment",
    "final_score",
    "created_at",
    "updated_at"
   FROM "public"."review_scores" "rs";


ALTER VIEW "public"."review_scores_employee_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviewer_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_type" "public"."reviewer_type" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "is_scored" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reviewer_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewer_type" "public"."reviewer_type" NOT NULL,
    "status" "public"."review_status" DEFAULT 'draft'::"public"."review_status" NOT NULL,
    "summary_employee_visible" "text",
    "submitted_at" timestamp with time zone,
    "finalized_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_assignment_alignment" CHECK (("reviewer_id" IS NOT NULL))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."reviews_employee_view" AS
 SELECT "id",
    "assignment_id",
    "cycle_id",
    "employee_id",
    "reviewer_type",
    "status",
    "summary_employee_visible",
    "submitted_at",
    "finalized_at",
    "created_at",
    "updated_at"
   FROM "public"."reviews" "r"
  WHERE (("employee_id" = "auth"."uid"()) AND ("finalized_at" IS NOT NULL));


ALTER VIEW "public"."reviews_employee_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubric_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubric_id" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "weight" integer NOT NULL,
    "description" "text",
    "is_scored" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rubric_category_weight_valid" CHECK ((("weight" >= 0) AND ("weight" <= 100)))
);


ALTER TABLE "public"."rubric_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubric_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "guidance" "text",
    "sort_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rubric_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubrics" (
    "id" "text" NOT NULL,
    "version" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."rubrics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_employee_outcomes"
    ADD CONSTRAINT "cycle_employee_outcomes_cycle_id_employee_id_key" UNIQUE ("cycle_id", "employee_id");



ALTER TABLE ONLY "public"."cycle_employee_outcomes"
    ADD CONSTRAINT "cycle_employee_outcomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "cycle_employee_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_employee_summary_public"
    ADD CONSTRAINT "cycle_employee_summary_public_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_reviewer_rules"
    ADD CONSTRAINT "cycle_reviewer_rules_cycle_id_reviewer_type_key" UNIQUE ("cycle_id", "reviewer_type");



ALTER TABLE ONLY "public"."cycle_reviewer_rules"
    ADD CONSTRAINT "cycle_reviewer_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_rubrics"
    ADD CONSTRAINT "cycle_rubrics_cycle_id_job_role_id_key" UNIQUE ("cycle_id", "job_role_id");



ALTER TABLE ONLY "public"."cycle_rubrics"
    ADD CONSTRAINT "cycle_rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_code_counters"
    ADD CONSTRAINT "employee_code_counters_pkey" PRIMARY KEY ("job_role_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_roles"
    ADD CONSTRAINT "job_roles_code_unique" UNIQUE ("code");



ALTER TABLE ONLY "public"."job_roles"
    ADD CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_unique" UNIQUE ("cycle_id", "employee_id", "reviewer_id", "reviewer_type");



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_pkey" PRIMARY KEY ("review_id");



ALTER TABLE ONLY "public"."reviewer_rules"
    ADD CONSTRAINT "reviewer_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_assignment_id_unique" UNIQUE ("assignment_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_one_per_assignment" UNIQUE ("assignment_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubric_categories"
    ADD CONSTRAINT "rubric_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubric_questions"
    ADD CONSTRAINT "rubric_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cycle_employee_summary_public"
    ADD CONSTRAINT "uq_public_summary_one_per_employee_cycle" UNIQUE ("cycle_id", "employee_id");



ALTER TABLE ONLY "public"."reviewer_rules"
    ADD CONSTRAINT "uq_reviewer_type" UNIQUE ("reviewer_type");



ALTER TABLE ONLY "public"."rubric_categories"
    ADD CONSTRAINT "uq_rubric_category_code" UNIQUE ("rubric_id", "code");



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "uq_summary_one_per_employee_cycle" UNIQUE ("cycle_id", "employee_id");



CREATE UNIQUE INDEX "employee_code_counters_job_role_id_key" ON "public"."employee_code_counters" USING "btree" ("job_role_id");



CREATE UNIQUE INDEX "employees_employee_code_key" ON "public"."employees" USING "btree" ("employee_code");



CREATE UNIQUE INDEX "employees_employee_code_unique" ON "public"."employees" USING "btree" ("employee_code");



CREATE INDEX "idx_audit_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_cycle_emp_summary_public_release" ON "public"."cycle_employee_summary_public" USING "btree" ("cycle_id", "employee_id", "released_at");



CREATE INDEX "idx_cycle_employee_summary_public_released" ON "public"."cycle_employee_summary_public" USING "btree" ("cycle_id", "employee_id", "released_at");



CREATE INDEX "idx_cycle_rubrics_cycle" ON "public"."cycle_rubrics" USING "btree" ("cycle_id");



CREATE INDEX "idx_cycle_rubrics_role" ON "public"."cycle_rubrics" USING "btree" ("job_role_id");



CREATE INDEX "idx_reviews_cycle_employee" ON "public"."reviews" USING "btree" ("cycle_id", "employee_id");



CREATE INDEX "idx_reviews_reviewer" ON "public"."reviews" USING "btree" ("reviewer_id", "cycle_id");



CREATE INDEX "idx_summary_cycle" ON "public"."cycle_employee_summary" USING "btree" ("cycle_id");



CREATE UNIQUE INDEX "job_roles_id_key" ON "public"."job_roles" USING "btree" ("id");



CREATE UNIQUE INDEX "profiles_email_unique" ON "public"."profiles" USING "btree" ("email");



CREATE UNIQUE INDEX "uniq_active_reviewer_once_per_employee_cycle" ON "public"."review_assignments" USING "btree" ("cycle_id", "employee_id", "reviewer_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "uniq_primary_per_employee_cycle" ON "public"."review_assignments" USING "btree" ("cycle_id", "employee_id") WHERE (("reviewer_type" = 'primary'::"public"."reviewer_type") AND ("is_active" = true));



CREATE UNIQUE INDEX "uniq_secondary_per_employee_cycle" ON "public"."review_assignments" USING "btree" ("cycle_id", "employee_id") WHERE (("reviewer_type" = 'secondary'::"public"."reviewer_type") AND ("is_active" = true));



CREATE UNIQUE INDEX "uniq_self_per_employee_cycle" ON "public"."review_assignments" USING "btree" ("cycle_id", "employee_id") WHERE (("reviewer_type" = 'self'::"public"."reviewer_type") AND ("is_active" = true));



CREATE UNIQUE INDEX "uq_review_per_assignment" ON "public"."reviews" USING "btree" ("assignment_id");



CREATE OR REPLACE TRIGGER "trg_block_review_updates_after_submit" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_review_edits_after_submit"();



CREATE OR REPLACE TRIGGER "trg_block_score_updates_after_submit" BEFORE UPDATE ON "public"."review_scores" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_score_edits_after_submit"();



CREATE OR REPLACE TRIGGER "trg_cycle_employee_summary_public_updated_at" BEFORE UPDATE ON "public"."cycle_employee_summary_public" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cycle_employee_summary_updated_at" BEFORE UPDATE ON "public"."cycle_employee_summary" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cycle_reviewer_rules_set_updated_at" BEFORE UPDATE ON "public"."cycle_reviewer_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cycle_rubrics_set_updated_at" BEFORE UPDATE ON "public"."cycle_rubrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_primary_only_scores" BEFORE INSERT OR UPDATE ON "public"."review_scores" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_primary_only_scores"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_review_assignments_updated_at" BEFORE UPDATE ON "public"."review_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_review_cycles_init_cycle_reviewer_rules" AFTER INSERT ON "public"."review_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"();



CREATE OR REPLACE TRIGGER "trg_review_cycles_init_cycle_rubrics" AFTER INSERT ON "public"."review_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"();



CREATE OR REPLACE TRIGGER "trg_review_cycles_updated_at" BEFORE UPDATE ON "public"."review_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_review_scores_updated_at" BEFORE UPDATE ON "public"."review_scores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reviewer_rules_updated_at" BEFORE UPDATE ON "public"."reviewer_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rubric_categories_updated_at" BEFORE UPDATE ON "public"."rubric_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rubric_questions_updated_at" BEFORE UPDATE ON "public"."rubric_questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rubrics_updated_at" BEFORE UPDATE ON "public"."rubrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_employee_code" BEFORE INSERT ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_employee_code"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cycle_employee_outcomes"
    ADD CONSTRAINT "cycle_employee_outcomes_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_employee_outcomes"
    ADD CONSTRAINT "cycle_employee_outcomes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "cycle_employee_summary_computed_by_fkey" FOREIGN KEY ("computed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "cycle_employee_summary_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "cycle_employee_summary_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_employee_summary"
    ADD CONSTRAINT "cycle_employee_summary_primary_review_id_fkey" FOREIGN KEY ("primary_review_id") REFERENCES "public"."reviews"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cycle_employee_summary_public"
    ADD CONSTRAINT "cycle_employee_summary_public_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_employee_summary_public"
    ADD CONSTRAINT "cycle_employee_summary_public_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_reviewer_rules"
    ADD CONSTRAINT "cycle_reviewer_rules_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_rubrics"
    ADD CONSTRAINT "cycle_rubrics_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cycle_rubrics"
    ADD CONSTRAINT "cycle_rubrics_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cycle_rubrics"
    ADD CONSTRAINT "cycle_rubrics_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "public"."job_roles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_assignments"
    ADD CONSTRAINT "review_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_cycles"
    ADD CONSTRAINT "review_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_scores"
    ADD CONSTRAINT "review_scores_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."review_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubric_categories"
    ADD CONSTRAINT "rubric_categories_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubric_questions"
    ADD CONSTRAINT "rubric_questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."rubric_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rubrics"
    ADD CONSTRAINT "rubrics_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



CREATE POLICY "admin update app_settings" ON "public"."app_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."id" = "auth"."uid"()))));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_users_admin_only_select" ON "public"."admin_users" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admin_users_admin_only_write" ON "public"."admin_users" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "admins can read employees" ON "public"."employees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."id" = "auth"."uid"()))));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_admin_write" ON "public"."app_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "app_settings_read_all" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "assignments_admin_all" ON "public"."review_assignments" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "assignments_reviewer_select" ON "public"."review_assignments" FOR SELECT USING ((("reviewer_id" = "auth"."uid"()) AND ("is_active" = true)));



CREATE POLICY "audit_admin_insert" ON "public"."audit_log" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "audit_admin_select" ON "public"."audit_log" FOR SELECT USING ("public"."is_admin"());



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_employee_outcomes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_employee_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_employee_summary_public" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cycle_reviewer_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cycle_reviewer_rules_admin_all" ON "public"."cycle_reviewer_rules" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "cycle_reviewer_rules_read_authed" ON "public"."cycle_reviewer_rules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cycle_rubrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cycle_rubrics_admin_all" ON "public"."cycle_rubrics" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "cycle_rubrics_read_authed" ON "public"."cycle_rubrics" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_admin_all" ON "public"."employees" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "employees_select_admin" ON "public"."employees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "au"
  WHERE ("au"."id" = "auth"."uid"()))));



CREATE POLICY "employees_self_select" ON "public"."employees" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."job_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_roles_admin_all" ON "public"."job_roles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "job_roles_read_all" ON "public"."job_roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self_or_admin" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "profiles_select_self_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "profiles_update_self_or_admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "public_summary_admin_all" ON "public"."cycle_employee_summary_public" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "public_summary_employee_select" ON "public"."cycle_employee_summary_public" FOR SELECT USING ((("employee_id" = "auth"."uid"()) AND ("finalized_at" IS NOT NULL)));



CREATE POLICY "read app_settings" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."review_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_cycles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_cycles_admin_all" ON "public"."review_cycles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_cycles_read_all_authed" ON "public"."review_cycles" FOR SELECT USING (true);



ALTER TABLE "public"."review_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_scores_admin_all" ON "public"."review_scores" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "review_scores_reviewer_select" ON "public"."review_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."review_assignments" "ra" ON (("ra"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "review_scores"."review_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"())))));



CREATE POLICY "review_scores_reviewer_update" ON "public"."review_scores" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."review_assignments" "ra" ON (("ra"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "review_scores"."review_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."review_assignments" "ra" ON (("ra"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "review_scores"."review_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"())))));



CREATE POLICY "review_scores_reviewer_upsert" ON "public"."review_scores" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."review_assignments" "ra" ON (("ra"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "review_scores"."review_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"())))));



CREATE POLICY "review_scores_reviewer_write" ON "public"."review_scores" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."review_assignments" "ra" ON (("ra"."id" = "r"."assignment_id")))
  WHERE (("r"."id" = "review_scores"."review_id") AND ("r"."reviewer_id" = "auth"."uid"()) AND ("r"."reviewer_type" = 'primary'::"public"."reviewer_type") AND ("ra"."is_active" = true)))));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_admin_all" ON "public"."reviews" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "reviews_reviewer_insert" ON "public"."reviews" FOR INSERT WITH CHECK ((("reviewer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."review_assignments" "ra"
  WHERE (("ra"."id" = "reviews"."assignment_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"()))))));



CREATE POLICY "reviews_reviewer_select" ON "public"."reviews" FOR SELECT USING ((("reviewer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."review_assignments" "ra"
  WHERE (("ra"."id" = "reviews"."assignment_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"()))))));



CREATE POLICY "reviews_reviewer_update" ON "public"."reviews" FOR UPDATE USING ((("reviewer_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."review_status", 'submitted'::"public"."review_status"])) AND (EXISTS ( SELECT 1
   FROM "public"."review_assignments" "ra"
  WHERE (("ra"."id" = "reviews"."assignment_id") AND ("ra"."is_active" = true) AND ("ra"."reviewer_id" = "auth"."uid"())))))) WITH CHECK (("reviewer_id" = "auth"."uid"()));



CREATE POLICY "summary_admin_all" ON "public"."cycle_employee_summary" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "summary_primary_reviewer_select" ON "public"."cycle_employee_summary" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "cycle_employee_summary"."primary_review_id") AND ("r"."reviewer_id" = "auth"."uid"()) AND ("r"."reviewer_type" = 'primary'::"public"."reviewer_type")))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_release_employee_cycle"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_release_employee_cycle"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_release_employee_cycle"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_reopen_review"("p_review_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assert_minimum_reviews_submitted"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assert_minimum_reviews_submitted"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_minimum_reviews_submitted"("p_cycle_id" "uuid", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_weighted_score"("rubric" "text", "category_scores" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_weighted_score"("rubric" "text", "category_scores" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_weighted_score"("rubric" "text", "category_scores" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_employee_from_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_employee_from_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_employee_from_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_primary_only_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_primary_only_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_primary_only_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finalize_employee_cycle_summary"("p_cycle_id" "uuid", "p_employee_id" "uuid", "p_final_narrative" "text", "p_calibration_adjustment" integer, "p_calibration_reason" "text", "p_computed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."finalize_employee_cycle_summary"("p_cycle_id" "uuid", "p_employee_id" "uuid", "p_final_narrative" "text", "p_calibration_adjustment" integer, "p_calibration_reason" "text", "p_computed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_employee_cycle_summary"("p_cycle_id" "uuid", "p_employee_id" "uuid", "p_final_narrative" "text", "p_calibration_adjustment" integer, "p_calibration_reason" "text", "p_computed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_job_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_job_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_employee_code"("p_job_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."init_cycle_reviewer_rules"("p_cycle_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."init_cycle_reviewer_rules"("p_cycle_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."init_cycle_reviewer_rules"("p_cycle_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."init_cycle_rubrics"("p_cycle_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."init_cycle_rubrics"("p_cycle_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."init_cycle_rubrics"("p_cycle_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."make_employee_code"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."make_employee_code"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_employee_code"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."next_employee_number"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."next_employee_number"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_employee_number"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_review_edits_after_submit"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_review_edits_after_submit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_review_edits_after_submit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_score_edits_after_submit"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_score_edits_after_submit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_score_edits_after_submit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rating_to_value"("r" "public"."performance_rating") TO "anon";
GRANT ALL ON FUNCTION "public"."rating_to_value"("r" "public"."performance_rating") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rating_to_value"("r" "public"."performance_rating") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."score_to_rating"("score" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."score_to_rating"("score" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."score_to_rating"("score" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."score_to_rating_value"("score" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."score_to_rating_value"("score" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."score_to_rating_value"("score" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_employee_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_employee_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_employee_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_reviewer_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_after_review_cycle_insert_init_cycle_rubrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_employee"("p_id" "uuid", "p_job_role_id" "uuid", "p_hire_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_employee"("p_id" "uuid", "p_job_role_id" "uuid", "p_hire_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_employee"("p_id" "uuid", "p_job_role_id" "uuid", "p_hire_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_rubric_weights"("rubric" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_rubric_weights"("rubric" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_rubric_weights"("rubric" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_employee_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."cycle_employee_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_employee_outcomes" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_employee_summary" TO "anon";
GRANT ALL ON TABLE "public"."cycle_employee_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_employee_summary" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_employee_summary_public" TO "anon";
GRANT ALL ON TABLE "public"."cycle_employee_summary_public" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_employee_summary_public" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_reviewer_rules" TO "anon";
GRANT ALL ON TABLE "public"."cycle_reviewer_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_reviewer_rules" TO "service_role";



GRANT ALL ON TABLE "public"."cycle_rubrics" TO "anon";
GRANT ALL ON TABLE "public"."cycle_rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."cycle_rubrics" TO "service_role";



GRANT ALL ON TABLE "public"."employee_code_counters" TO "anon";
GRANT ALL ON TABLE "public"."employee_code_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_code_counters" TO "service_role";



GRANT ALL ON TABLE "public"."employee_cycle_results_view" TO "anon";
GRANT ALL ON TABLE "public"."employee_cycle_results_view" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_cycle_results_view" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."job_roles" TO "anon";
GRANT ALL ON TABLE "public"."job_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."job_roles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."review_assignments" TO "anon";
GRANT ALL ON TABLE "public"."review_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."review_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."review_cycles" TO "anon";
GRANT ALL ON TABLE "public"."review_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."review_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."review_scores" TO "anon";
GRANT ALL ON TABLE "public"."review_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."review_scores" TO "service_role";



GRANT ALL ON TABLE "public"."review_scores_employee_view" TO "anon";
GRANT ALL ON TABLE "public"."review_scores_employee_view" TO "authenticated";
GRANT ALL ON TABLE "public"."review_scores_employee_view" TO "service_role";



GRANT ALL ON TABLE "public"."reviewer_rules" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_rules" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."reviews_employee_view" TO "anon";
GRANT ALL ON TABLE "public"."reviews_employee_view" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews_employee_view" TO "service_role";



GRANT ALL ON TABLE "public"."rubric_categories" TO "anon";
GRANT ALL ON TABLE "public"."rubric_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."rubric_categories" TO "service_role";



GRANT ALL ON TABLE "public"."rubric_questions" TO "anon";
GRANT ALL ON TABLE "public"."rubric_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."rubric_questions" TO "service_role";



GRANT ALL ON TABLE "public"."rubrics" TO "anon";
GRANT ALL ON TABLE "public"."rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."rubrics" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







