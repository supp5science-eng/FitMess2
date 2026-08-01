-- Trening (workouts) — user-owned log of deliberate physical activity.
--
-- MANY rows per user per day (unlike public.step_counts / public.water_intake,
-- which hold one running total per day): a training day is a LIST -- "teretana
-- 70 min" and "šetnja 25 min" are two separate things the user did, each with
-- its own duration and intensity, and collapsing them into one number would
-- make the day un-editable ("which of the two was the 40 minutes?"). So the
-- shape here follows public.logs (append rows, delete one) rather than the
-- upsert-a-total shape.
--
-- WHAT THIS TABLE DOES NOT DO -- read this before wiring it into anything:
--
-- These rows DO NOT move the user's calorie budget. The budget already pays
-- for training through the activity multiplier in the TDEE (see
-- src/lib/budget/engine.ts `ACTIVITY_MULTIPLIERS`: `moderate` = 1.55 is
-- literally "3-5 workouts a week"), so adding a logged workout ON TOP of that
-- would pay for the same session twice -- the single most common way a calorie
-- app quietly makes its users gain weight. The plan is corrected from the
-- SCALE instead (Nedeljno merenje, 0024_weekly_weigh_in.sql), which measures
-- the user's real TDEE rather than guessing it from a MET table.
--
-- So `kcal` below is a DISPLAY figure: it answers "what did that session
-- cost", not "how much extra may I eat". Anything that later reads this table
-- must keep that distinction.
--
-- `kcal` is a SNAPSHOT, computed at insert time by
-- src/lib/workout/activities.ts from the activity's net MET value and the
-- user's weight THEN. Same reasoning as public.logs storing its own
-- kcal/protein/carbs/fat instead of recomputing from `foods`: a workout logged
-- at 92 kg must not silently re-price itself once the user reaches 84 kg --
-- history is a record of what happened, not a view over today's profile.
--
-- Same user-owned own-row RLS pattern as public.logs / public.step_counts:
-- four policies, each `user_id = auth.uid()`. RLS enforces "own data only";
-- the app layer never filters on trust.
--
-- The `day` is a Belgrade CALENDAR day (a bare `date`), assigned in the app
-- layer via src/lib/dates.ts `toBelgradeCalendarDay` — the same convention
-- logs / weigh-ins / water / steps already follow.

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  -- Key into the app's activity catalog (src/lib/workout/activities.ts), e.g.
  -- 'teretana', 'trcanje'. Deliberately NOT a Postgres enum: the catalog is
  -- product copy that grows (a new sport is a one-line change in TypeScript),
  -- and an enum would make every addition a migration. An unknown key renders
  -- under a neutral fallback label rather than breaking the screen.
  activity_key text not null check (char_length(activity_key) between 1 and 40),
  intensity    text not null default 'srednje'
                 check (intensity in ('lako', 'srednje', 'jako')),
  minutes      integer not null check (minutes >= 1 and minutes <= 600),
  -- NET kcal above resting metabolism (see the header): what the session cost
  -- BEYOND the sitting the user would have done anyway. Bounded generously --
  -- 10 hours of hard effort for a heavy body is still under 10000.
  kcal         integer not null default 0 check (kcal >= 0 and kcal <= 10000),
  created_at   timestamptz not null default now()
);

comment on table public.workouts is
  'User-owned log of deliberate physical activity (Trening). Many rows per user per Belgrade calendar day. DISPLAY ONLY: these rows never adjust the calorie budget — the TDEE activity multiplier already pays for training, and the plan is corrected from the scale (Nedeljno merenje).';
comment on column public.workouts.day is
  'Belgrade calendar day (bare date, no tz) — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay).';
comment on column public.workouts.activity_key is
  'Key into the app-side activity catalog (src/lib/workout/activities.ts). Free text, not an enum: the catalog grows without a migration.';
comment on column public.workouts.kcal is
  'NET kcal above resting metabolism, snapshotted at insert time from the activity''s net MET value and the user''s weight at that moment (never recomputed from today''s profile).';

-- Hot query path: "this user's workouts for a given day" (the /danas read and
-- the Trening screen) and "recent days" — newest first.
create index if not exists workouts_user_id_day_idx
  on public.workouts (user_id, day desc, created_at desc);

alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own"
  on public.workouts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own"
  on public.workouts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own"
  on public.workouts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own"
  on public.workouts for delete
  to authenticated
  using (user_id = auth.uid());
