-- Voda (water intake) — user-owned per-day water total in millilitres.
--
-- One row per user per Belgrade calendar day, upserted on (user_id, day):
-- the "Unesi vodu" sheet on `/danas` adds an amount, and the API route
-- (src/app/api/voda/route.ts) reads-modifies-writes the day's running total
-- rather than stacking one row per glass. Keeping a single running total per
-- day (instead of an append-only glass log) is enough for the home button's
-- "koliko sam danas popio" display and matches the per-day shape of
-- public.weigh_ins (0012_weigh_ins.sql).
--
-- Same user-owned own-row RLS pattern as public.weigh_ins / public.logs:
-- four policies, each `user_id = auth.uid()`. RLS enforces "own data only";
-- the app layer never filters on trust.
--
-- The `day` is a Belgrade CALENDAR day (a bare `date`), assigned in the app
-- layer via src/lib/dates.ts `toBelgradeCalendarDay` — the same convention
-- logs/weigh-ins already follow.

create table if not exists public.water_intake (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  ml         integer not null default 0 check (ml >= 0 and ml <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

comment on table public.water_intake is
  'User-owned daily water intake in millilitres. One row per user per Belgrade calendar day — the app upserts on (user_id, day) so adding a glass increments the day''s running total. Bounded 0..20000 ml.';
comment on column public.water_intake.day is
  'Belgrade calendar day (bare date, no tz) — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay).';
comment on column public.water_intake.ml is
  'Total water for the day in millilitres (0..20000). Incremented by the "Unesi vodu" sheet on /danas.';

drop trigger if exists water_intake_set_updated_at on public.water_intake;
create trigger water_intake_set_updated_at
  before update on public.water_intake
  for each row
  execute function public.set_updated_at();

-- Hot query path: "this user's water for a given day" (the /danas read) and
-- "recent days" (potential future analytics) — newest day first.
create index if not exists water_intake_user_id_day_idx
  on public.water_intake (user_id, day desc);

alter table public.water_intake enable row level security;

drop policy if exists "water_intake_select_own" on public.water_intake;
create policy "water_intake_select_own"
  on public.water_intake for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "water_intake_insert_own" on public.water_intake;
create policy "water_intake_insert_own"
  on public.water_intake for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "water_intake_update_own" on public.water_intake;
create policy "water_intake_update_own"
  on public.water_intake for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "water_intake_delete_own" on public.water_intake;
create policy "water_intake_delete_own"
  on public.water_intake for delete
  to authenticated
  using (user_id = auth.uid());
