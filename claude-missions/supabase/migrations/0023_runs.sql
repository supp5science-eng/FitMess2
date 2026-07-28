-- Trčanje (runs) — user-owned GPS-tracked running activities.
--
-- Unlike public.step_counts / public.water_intake (one running-total row per
-- Belgrade day, upserted), a run is an EVENT: one row per completed run, so
-- this table is append-only (many rows per day are fine). The recording screen
-- (`/trcanje/snimanje`) samples the device GPS with
-- `navigator.geolocation.watchPosition`, and on "Zaustavi" the client POSTs the
-- finished activity to src/app/api/trcanje/route.ts, which computes the summary
-- (distance, pace, calories) in the app layer (src/lib/run/**, the "money-math"
-- rule) and inserts one row here.
--
-- Same user-owned own-row RLS pattern as public.logs / public.weigh_ins: four
-- policies, each `user_id = auth.uid()`. RLS enforces "own data only"; the app
-- layer never filters on trust.
--
-- `day` is the run's Belgrade CALENDAR day (a bare `date`), assigned in the app
-- layer via src/lib/dates.ts `toBelgradeCalendarDay` from `started_at` — the
-- same convention logs / weigh-ins / water / steps already follow. It lets
-- `/danas` and `/analitika` fold a day's burned calories back into that day's
-- budget without re-deriving the calendar day from a timestamp on every read.
--
-- `route` is a jsonb ARRAY of GPS samples, each `{ "lat": number, "lng": number,
-- "t": number }` where `t` is milliseconds since the run started. It is the raw
-- trace the summary was computed from and what the map redraws on the run detail
-- screen; capped defensively at the app layer, never trusted for the totals
-- (distance_m / duration_s / calories are the authoritative, server-computed
-- numbers).

create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  -- Active (moving) seconds, excluding paused time. Bounded to a generous
  -- upper limit (24h) to reject forged payloads.
  duration_s  integer not null default 0 check (duration_s >= 0 and duration_s <= 86400),
  -- Total distance in whole metres. 0..200km covers any real run.
  distance_m  integer not null default 0 check (distance_m >= 0 and distance_m <= 200000),
  -- Calories burned, whole kcal (server-computed from distance + body weight).
  calories    integer not null default 0 check (calories >= 0 and calories <= 30000),
  -- Raw GPS trace: array of { lat, lng, t(ms since start) } samples.
  route       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.runs is
  'User-owned GPS-tracked running activities. Append-only, one row per completed run (many per day allowed). Totals (distance_m / duration_s / calories) are server-computed in src/lib/run/**; route holds the raw GPS trace.';
comment on column public.runs.day is
  'Belgrade calendar day of the run (bare date, no tz) — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay) from started_at.';
comment on column public.runs.duration_s is
  'Active moving seconds, excluding paused time (0..86400).';
comment on column public.runs.distance_m is
  'Total distance in whole metres (0..200000).';
comment on column public.runs.calories is
  'Whole kcal burned, computed server-side from distance + body weight (0..30000). Folded back into the day''s calorie budget on /danas and /analitika.';
comment on column public.runs.route is
  'jsonb array of GPS samples { lat, lng, t } where t is ms since the run started. Raw trace the summary was computed from; never trusted for the totals.';

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
  before update on public.runs
  for each row
  execute function public.set_updated_at();

-- Hot query paths: "this user's runs for a given day" (the /danas + /analitika
-- burned-calorie fold) and "this user's recent runs" (the /trcanje history
-- list) — newest first.
create index if not exists runs_user_id_day_idx
  on public.runs (user_id, day desc);
create index if not exists runs_user_id_started_at_idx
  on public.runs (user_id, started_at desc);

alter table public.runs enable row level security;

drop policy if exists "runs_select_own" on public.runs;
create policy "runs_select_own"
  on public.runs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "runs_insert_own" on public.runs;
create policy "runs_insert_own"
  on public.runs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "runs_update_own" on public.runs;
create policy "runs_update_own"
  on public.runs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "runs_delete_own" on public.runs;
create policy "runs_delete_own"
  on public.runs for delete
  to authenticated
  using (user_id = auth.uid());
