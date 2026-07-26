-- Podsetnici v2 + Nagrade — 2026-07-26.
--
-- Two changes, one migration, because they ship as one product change:
-- reminders go from ONE conditional nudge to TWO daily ones, and completing a
-- day now grants something you keep.
--
-- ---------------------------------------------------------------------------
-- 1. Reminders: one conditional -> two daily
-- ---------------------------------------------------------------------------
--
-- v1 shipped a single reminder ("danas nisi ništa uneo") that fired ONLY on a
-- day with zero logs. It worked exactly as designed and was therefore almost
-- never seen: a user who logs every day never has an empty day. The owner's
-- call (2026-07-26) is two reminders that arrive REGARDLESS of logging:
--
--   * morning (default 10:00) — start the day, log breakfast
--   * evening (default 20:00) — the recap, which is worth most precisely on
--     the days you DID log (it can say how much budget is left)
--
-- `no_log_*` is not kept alongside them: three switches on one screen is the
-- kind of chrome this app deliberately refuses (see the "super jednostavno"
-- rule). The morning reminder is its successor, so the old columns are
-- BACKFILLED into it and then dropped — a user who had reminders on at 12:00
-- keeps a morning reminder at 12:00 and never has to re-arm anything.
--
-- Times remain bare Belgrade wall-clock `time` values (single-market app), and
-- each reminder keeps its OWN `*_last_sent` date guard so neither can fire
-- twice in a day and the every-15-min cron stays safely re-runnable.

alter table public.reminder_settings
  add column if not exists morning_enabled   boolean not null default true,
  add column if not exists morning_time      time    not null default '10:00',
  add column if not exists morning_last_sent date,
  add column if not exists evening_enabled   boolean not null default true,
  add column if not exists evening_time      time    not null default '20:00',
  add column if not exists evening_last_sent date,
  -- The "3 obroka" celebration push. Separate from the two clock reminders
  -- because it is EARNED, not scheduled — a user may well want the trophy
  -- without the nagging.
  add column if not exists award_enabled     boolean not null default true;

-- Carry v1 users over: their single reminder becomes their morning one.
-- Guarded so re-running the migration cannot overwrite a time the user has
-- since changed (the column is dropped below, so this only ever runs once).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reminder_settings'
      and column_name = 'no_log_enabled'
  ) then
    execute $backfill$
      update public.reminder_settings
      set morning_enabled = no_log_enabled,
          morning_time    = no_log_time
    $backfill$;
  end if;
end $$;

alter table public.reminder_settings
  drop column if exists no_log_enabled,
  drop column if exists no_log_time,
  drop column if exists no_log_last_sent;

comment on table public.reminder_settings is
  'User-owned reminder preferences: two daily Web Push reminders (morning + evening recap), each with an enabled flag, a Belgrade wall-clock time, and the last Belgrade day it fired; plus the earned "3 obroka" award push.';
comment on column public.reminder_settings.morning_time is
  'Belgrade local time of the morning nudge — bare time, no timezone (single-market app).';
comment on column public.reminder_settings.evening_time is
  'Belgrade local time of the evening recap. Sent regardless of logging: on a logged day it reports remaining kcal, on an empty day it says the day is still blank.';
comment on column public.reminder_settings.morning_last_sent is
  'Belgrade calendar day the morning reminder last went out — the once-a-day guard that makes the every-15-min cron safely retryable.';
comment on column public.reminder_settings.evening_last_sent is
  'Belgrade calendar day the evening recap last went out. Same once-a-day guard as morning_last_sent.';
comment on column public.reminder_settings.award_enabled is
  'Whether the earned "pun dan" (3 logged meals) celebration push is sent. Independent of the two scheduled reminders.';

-- ---------------------------------------------------------------------------
-- 2. Nagrade: what a completed day leaves behind
-- ---------------------------------------------------------------------------
--
-- Logging three meals in a day grants the "pun-dan" award for that Belgrade
-- day. One row per (user, day, kind), which is what makes the grant IDEMPOTENT:
-- the log route tries to grant on every insert and the primary key silently
-- absorbs every attempt after the first, so a user cannot farm the celebration
-- by deleting and re-adding a third meal.
--
-- `kind` is text rather than an enum on purpose — a future badge is a new
-- string, not a migration that rewrites a type. The streak (how many
-- consecutive days) is NOT stored: it is derived from these rows by
-- `src/lib/awards/streak.ts`, so it can never drift out of sync with the
-- awards it counts.

create table if not exists public.awards (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  kind       text not null default 'pun-dan',
  created_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);

comment on table public.awards is
  'User-owned earned awards, one row per (user, Belgrade day, kind). "pun-dan" is granted on the third logged meal of a day. Idempotent by primary key: re-granting the same day is a no-op.';
comment on column public.awards.day is
  'The Belgrade calendar day the award was earned for — not the insert timestamp, so a late-evening grant belongs to the day it was earned.';
comment on column public.awards.kind is
  'Award identifier. Text, not an enum: a new badge should be a new string, never a type migration.';

-- Streak reads walk a user''s awards backwards from today, newest first.
create index if not exists awards_user_day_idx
  on public.awards (user_id, day desc);

alter table public.awards enable row level security;

-- Same own-row shape as reminder_settings / step_counts / water_intake.
-- The log route grants awards through the SESSION client, so this insert
-- policy is what enforces "you can only ever earn your own award".
drop policy if exists "awards_select_own" on public.awards;
create policy "awards_select_own"
  on public.awards for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "awards_insert_own" on public.awards;
create policy "awards_insert_own"
  on public.awards for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "awards_delete_own" on public.awards;
create policy "awards_delete_own"
  on public.awards for delete
  to authenticated
  using (user_id = auth.uid());

-- No update policy: an award is earned or it is not. Nothing about an existing
-- row is ever meant to change.
