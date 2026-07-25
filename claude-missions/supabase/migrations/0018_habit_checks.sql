-- Navike (habits) — one row per (user, habit, Belgrade calendar day) marking
-- that the user checked that habit off on that day.
--
-- Background: `profiles.rules` (0003_eating_rules.sql) already holds each
-- user's 3–5 generated eating rules with an `enabled` flag, but nothing ever
-- read them back — the settings screen could toggle a rule on and off with no
-- consequence anywhere in the app. This table is what turns those rules into
-- HABITS: `profiles.rules` stays the definition (which habits exist, their
-- Serbian text, whether the user tracks them), and this table is the daily
-- history (did I do it today?), which is what makes streaks possible.
--
-- Append/delete shape rather than a boolean column: checking a habit inserts
-- a row, unchecking deletes it. Absence means "not done", so an untouched day
-- costs nothing, and the whole streak calculation is "which days have a row".
--
-- `habit_id` is the rule id from src/lib/budget/rules.ts's catalog
-- ("protein-2-obroka", "povrce-svaki-dan", …), NOT a foreign key: the rules
-- live inside a jsonb array on profiles, so there is nothing to reference.
-- Regenerating rules can therefore leave behind checks for habits the user no
-- longer tracks — harmless, they simply stop being read (and would light back
-- up if the same habit returns, which is the friendlier behaviour).
--
-- Same user-owned own-row RLS pattern as public.water_intake / public.logs:
-- four policies, each `user_id = auth.uid()`.
--
-- The `day` is a Belgrade CALENDAR day (a bare `date`), assigned in the app
-- layer via src/lib/dates.ts `toBelgradeCalendarDay` — the same convention
-- logs / weigh_ins / water_intake already follow.

create table if not exists public.habit_checks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   text not null check (char_length(habit_id) between 1 and 80),
  day        date not null,
  created_at timestamptz not null default now(),
  unique (user_id, habit_id, day)
);

comment on table public.habit_checks is
  'User-owned habit check-offs. One row per (user, habit, Belgrade calendar day) — a row means "done that day", its absence means "not done". Unchecking deletes the row. The habits themselves are defined in profiles.rules (jsonb).';
comment on column public.habit_checks.habit_id is
  'Rule id from the catalog in src/lib/budget/rules.ts (e.g. "povrce-svaki-dan"). Not a FK — the rules live in profiles.rules jsonb.';
comment on column public.habit_checks.day is
  'Belgrade calendar day (bare date, no tz) — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay).';

-- Hot query path: "this user's checks over the last N days", newest first —
-- that single read feeds both today's checkboxes and every streak.
create index if not exists habit_checks_user_id_day_idx
  on public.habit_checks (user_id, day desc);

alter table public.habit_checks enable row level security;

drop policy if exists "habit_checks_select_own" on public.habit_checks;
create policy "habit_checks_select_own"
  on public.habit_checks for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "habit_checks_insert_own" on public.habit_checks;
create policy "habit_checks_insert_own"
  on public.habit_checks for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "habit_checks_update_own" on public.habit_checks;
create policy "habit_checks_update_own"
  on public.habit_checks for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "habit_checks_delete_own" on public.habit_checks;
create policy "habit_checks_delete_own"
  on public.habit_checks for delete
  to authenticated
  using (user_id = auth.uid());
