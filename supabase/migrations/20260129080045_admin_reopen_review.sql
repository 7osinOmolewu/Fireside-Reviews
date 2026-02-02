-- Helper: is admin (admin_users.id = auth.uid())
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = p_user_id
  );
$$;

-- Update your existing locking trigger to allow admin to change status away from submitted
create or replace function public.prevent_review_edits_after_submit()
returns trigger
language plpgsql
as $$
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

-- Admin action: reopen a submitted review
create or replace function public.admin_reopen_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.reviews
     set status = 'draft',
         submitted_at = null,
         updated_at = now()
   where id = p_review_id;

  if not found then
    raise exception 'Review not found';
  end if;
end;
$$;

-- Optional hardening: only admins can execute the admin function
revoke all on function public.admin_reopen_review(uuid) from public;
grant execute on function public.admin_reopen_review(uuid) to authenticated;
