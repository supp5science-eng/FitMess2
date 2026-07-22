-- F0xx: meal photos for the "Slikaj obrok" flow.
--
-- Product decision (2026-07-22): a photographed meal's PHOTO is kept for ~1 day
-- (shown on "Početna" under "Obroci danas" next to its nutrition), then
-- auto-deleted. The LOG row itself (name + grams + macros, already denormalized
-- on public.logs) is never touched, so the meal's INFO lives on in Analitika
-- after the photo is gone -- exactly the two-window retention model 0010 set up
-- for logs, applied to the (much shorter-lived) image.
--
-- Storage choice: the small DISPLAY thumbnail is kept as base64 text in this
-- own-row table, NOT Supabase Storage. It's tiny and short-lived, trivially
-- pruned by pg_cron, needs no bucket/object-lifecycle/orphan-file handling, and
-- reuses the exact RLS + retention patterns already in this schema (0004 own-row
-- logs, 0010 nightly pg_cron prune). One photo per log (log_id PRIMARY KEY,
-- ON DELETE CASCADE), so deleting a meal removes its photo automatically.

create table if not exists public.meal_photos (
  log_id       uuid primary key references public.logs (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  image_base64 text not null,
  mime_type    text not null default 'image/jpeg',
  created_at   timestamptz not null default now()
);

comment on table public.meal_photos is
  'Short-lived (~1 day) base64 display thumbnail for a "Slikaj obrok" meal log. Pruned nightly by pg_cron; the referenced logs row (with its macro snapshot) is never touched, so the meal''s data survives in Analitika after the photo is gone. One row per log (log_id PK, ON DELETE CASCADE).';

-- Prune scans by age; reads join on log_id (the PK, already indexed).
create index if not exists meal_photos_created_at_idx
  on public.meal_photos (created_at);

alter table public.meal_photos enable row level security;

-- Own-row read: a user only ever sees photos they uploaded.
drop policy if exists "meal_photos_select_own" on public.meal_photos;
create policy "meal_photos_select_own"
  on public.meal_photos for select
  to authenticated
  using (user_id = auth.uid());

-- Own-row insert: the row must be attributed to the caller AND may only attach
-- to one of the caller's OWN logs (the EXISTS guard stops anyone inserting a
-- photo against another user's log id).
drop policy if exists "meal_photos_insert_own" on public.meal_photos;
create policy "meal_photos_insert_own"
  on public.meal_photos for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.logs l
      where l.id = log_id and l.user_id = auth.uid()
    )
  );

-- Own-row delete (also covered by the log's ON DELETE CASCADE, but explicit for
-- a direct "remove my photo" path).
drop policy if exists "meal_photos_delete_own" on public.meal_photos;
create policy "meal_photos_delete_own"
  on public.meal_photos for delete
  to authenticated
  using (user_id = auth.uid());

-- Nightly prune: drop meal photos older than ~1 day. The home screen only ever
-- shows today's logs, so a photo is only needed for the calendar day it was
-- taken; this frees the image bytes the morning after. Runs at 03:15 UTC, just
-- before the existing logs prune (03:30), both quiet-hour jobs.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'fitmess-prune-meal-photos') then
    perform cron.unschedule('fitmess-prune-meal-photos');
  end if;
end;
$$;

select cron.schedule(
  'fitmess-prune-meal-photos',
  '15 3 * * *',
  $$delete from public.meal_photos where created_at < now() - interval '1 day';$$
);
