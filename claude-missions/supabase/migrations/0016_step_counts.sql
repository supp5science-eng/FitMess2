-- Koraci (steps) — user-owned per-day manual step count.
--
-- One row per user per Belgrade calendar day, upserted on (user_id, day): the
-- "Koraci" card on `/danas` adds an amount, and the API route
-- (src/app/api/koraci/route.ts) reads-modifies-writes the day's running total
-- rather than stacking one row per entry. Steps are entered MANUALLY (roughly)
-- -- FitMess has no pedometer/health integration (a PWA can't read HealthKit),
-- so this is a self-reported daily figure, same per-day running-total shape as
-- public.water_intake (0015_water_intake.sql) and public.weigh_ins.
--
-- Same user-owned own-row RLS pattern as public.water_intake / public.logs:
-- four policies, each `user_id = auth.uid()`. RLS enforces "own data only";
-- the app layer never filters on trust.
--
-- The `day` is a Belgrade CALENDAR day (a bare `date`), assigned in the app
-- layer via src/lib/dates.ts `toBelgradeCalendarDay` — the same convention
-- logs / weigh-ins / water already follow.

create table if not exists public.step_counts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  steps      integer not null default 0 check (steps >= 0 and steps <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

comment on table public.step_counts is
  'User-owned daily (manually entered) step count. One row per user per Belgrade calendar day — the app upserts on (user_id, day) so adding steps increments the day''s running total. Bounded 0..200000.';
comment on column public.step_counts.day is
  'Belgrade calendar day (bare date, no tz) — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay).';
comment on column public.step_counts.steps is
  'Total steps for the day (0..200000). Incremented by the "Koraci" card on /danas (self-reported; no pedometer integration).';

drop trigger if exists step_counts_set_updated_at on public.step_counts;
create trigger step_counts_set_updated_at
  before update on public.step_counts
  for each row
  execute function public.set_updated_at();

-- Hot query path: "this user's steps for a given day" (the /danas read) and
-- "recent days" (future analytics) — newest day first.
create index if not exists step_counts_user_id_day_idx
  on public.step_counts (user_id, day desc);

alter table public.step_counts enable row level security;

drop policy if exists "step_counts_select_own" on public.step_counts;
create policy "step_counts_select_own"
  on public.step_counts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "step_counts_insert_own" on public.step_counts;
create policy "step_counts_insert_own"
  on public.step_counts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "step_counts_update_own" on public.step_counts;
create policy "step_counts_update_own"
  on public.step_counts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "step_counts_delete_own" on public.step_counts;
create policy "step_counts_delete_own"
  on public.step_counts for delete
  to authenticated
  using (user_id = auth.uid());
