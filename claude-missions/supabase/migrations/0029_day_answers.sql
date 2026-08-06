-- "Je li sreda stvarno bio dan od 420 kcal?" — the answer, given a home.
--
-- Problem this solves (2026-08-06): `src/lib/home/day-trust.ts` refuses to
-- believe a day whose logged total falls below BMR and counts it AS A DAY ON
-- PLAN instead. That default is right — a forgotten lunch must never read as a
-- 400 kcal day — but it IS a guess, and for someone who genuinely ate lightly
-- it is silently the wrong one. The user's correction has always beaten the
-- heuristic; what it lacked was somewhere durable to live.
--
-- Until now the answers sat in the `fm_dani` COOKIE. That was acceptable while
-- nothing on screen actually asked (the question died with the plan card on
-- 2026-08-01 and came back on 2026-08-06). It stops being acceptable the moment
-- we ask people to think about a past day and tap an answer:
--
--   * a new phone, a cleared browser, or an expired cookie loses every answer,
--     and the plan quietly reverts to assumptions the user already corrected;
--   * the answers never appeared in "Moji podaci" even though they are the
--     user's own statements about their own days.
--
-- One row per (user, day). Re-answering the same day UPDATES rather than piles
-- up — the newest answer is the only one that means anything, and the cookie
-- format it replaces was newest-wins too.
--
-- `answered_on` is the Belgrade day the answer was GIVEN (not the day it is
-- about). It is kept for the same reason the cookie carried it: pruning by
-- "when did we last hear about this" without having to parse the subject day.
--
-- Retention: rows follow the user (`on delete cascade`), and nothing prunes
-- them on a timer. The plan only ever looks 21 days back
-- (`DAY_ANSWER_KEEP_DAYS`), so old rows are inert rather than harmful, and an
-- answer is a statement the user made — the export should still be able to show
-- it a year later.

create table if not exists public.day_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Belgrade calendar day the answer is ABOUT, "YYYY-MM-DD".
  day_key     date not null,
  -- 'complete' = "it really was a light day" (believe the log as written).
  -- 'partial'  = "I didn't log it all"       (keep treating it as on plan).
  answer      text not null check (answer in ('complete', 'partial')),
  -- Belgrade calendar day the answer was GIVEN.
  answered_on date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, day_key)
);

comment on table public.day_answers is
  'User corrections to the plan''s trust verdict about a past day (see src/lib/home/day-trust.ts). One row per user per day; re-answering updates in place. Replaces the fm_dani cookie, which did not survive a device change and was missing from the data export.';
comment on column public.day_answers.day_key is
  'The Belgrade calendar day the answer is ABOUT.';
comment on column public.day_answers.answered_on is
  'The Belgrade calendar day the answer was GIVEN — kept so answers can be aged out by recency without parsing the subject day.';

create index if not exists day_answers_user_id_day_key_idx
  on public.day_answers (user_id, day_key desc);

alter table public.day_answers enable row level security;

drop policy if exists "day_answers_select_own" on public.day_answers;
create policy "day_answers_select_own"
  on public.day_answers for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "day_answers_insert_own" on public.day_answers;
create policy "day_answers_insert_own"
  on public.day_answers for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "day_answers_update_own" on public.day_answers;
create policy "day_answers_update_own"
  on public.day_answers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "day_answers_delete_own" on public.day_answers;
create policy "day_answers_delete_own"
  on public.day_answers for delete
  to authenticated
  using (user_id = auth.uid());
