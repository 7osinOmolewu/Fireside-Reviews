-- reviews: block edits after submitted
create or replace function public.prevent_review_edits_after_submit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'submitted' then
    raise exception 'Review is already submitted and cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_review_updates_after_submit on public.reviews;

create trigger trg_block_review_updates_after_submit
before update on public.reviews
for each row
execute function public.prevent_review_edits_after_submit();

-- review_scores: block edits after submitted
create or replace function public.prevent_score_edits_after_submit()
returns trigger
language plpgsql
as $$
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

drop trigger if exists trg_block_score_updates_after_submit on public.review_scores;

create trigger trg_block_score_updates_after_submit
before update on public.review_scores
for each row
execute function public.prevent_score_edits_after_submit();
