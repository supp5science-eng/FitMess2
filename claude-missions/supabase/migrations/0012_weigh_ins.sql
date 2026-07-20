-- F042: weigh_ins (user-owned) schema + RLS.
--
-- Covers AS-072 (a weigh-in stores a weight in kg with one decimal, bounded
-- to a sane human range) and AS-073 (a second weigh-in on the same Belgrade
-- calendar day REPLACES the earlier one rather than stacking a duplicate) --
-- enforced by the `unique (user_id, day)` constraint plus an upsert on
-- `(user_id, day)` in the API route (src/app/api/weigh-ins/route.ts).
--
-- User-owned, own-row RLS -- the SAME pattern as public.logs from
-- 0004_foods_logs.sql (and public.profiles/public.targets from
-- 0001_profiles.sql): four policies, each `user_id = auth.uid()`. RLS is
-- what enforces "own data only"; the app layer never filters on trust.
--
-- The `day` is a Belgrade CALENDAR day (a bare `date`, no timezone),
-- assigned in the app layer via src/lib/dates.ts `toBelgradeCalendarDay` --
-- the same "day boundaries in Europe/Belgrade, computed in the app, never
-- raw SQL date math" convention the logs/weekly features already follow.
--
-- Transactional: this migration runs inside its own implicit transaction, so
-- any statement failing rolls the whole file back atomically.

create table if not exists public.weigh_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  weight_kg  numeric(4, 1) not null check (weight_kg >= 30 and weight_kg <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

comment on table public.weigh_ins is
  'User-owned daily weigh-ins (F042). One row per user per Belgrade calendar day -- the app layer computes the day (src/lib/dates.ts toBelgradeCalendarDay) and upserts on (user_id, day), so a same-day re-weigh REPLACES the earlier value (AS-073). Weight is kg to one decimal, bounded 30..300 (AS-072).';
comment on column public.weigh_ins.day is
  'Belgrade calendar day (bare date, no tz) -- assigned in the app layer, per the "day boundaries in Europe/Belgrade, computed in the app" convention shared with logs/targets.';
comment on column public.weigh_ins.weight_kg is
  'Body weight in kilograms, one decimal (AS-072). The trend chart (F043) plots these raw points plus a 7-day rolling average computed in src/lib/weight/trend.ts.';

drop trigger if exists weigh_ins_set_updated_at on public.weigh_ins;
create trigger weigh_ins_set_updated_at
  before update on public.weigh_ins
  for each row
  execute function public.set_updated_at();

-- Hot query path: "this user's recent weigh-ins, newest day first" is the
-- trend-chart read (src/lib/weight/weigh-ins.ts getWeighIns, a 90-day
-- window), same shape as logs_user_id_logged_at_idx in 0004_foods_logs.sql.
create index if not exists weigh_ins_user_id_day_idx
  on public.weigh_ins (user_id, day desc);

alter table public.weigh_ins enable row level security;

drop policy if exists "weigh_ins_select_own" on public.weigh_ins;
create policy "weigh_ins_select_own"
  on public.weigh_ins for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "weigh_ins_insert_own" on public.weigh_ins;
create policy "weigh_ins_insert_own"
  on public.weigh_ins for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "weigh_ins_update_own" on public.weigh_ins;
create policy "weigh_ins_update_own"
  on public.weigh_ins for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "weigh_ins_delete_own" on public.weigh_ins;
create policy "weigh_ins_delete_own"
  on public.weigh_ins for delete
  to authenticated
  using (user_id = auth.uid());
