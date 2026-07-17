-- F010: profiles + targets schema, own-row RLS
--
-- Covers AS-013 (RLS denies cross-user access) and AS-031 (onboarding state
-- persisted via profiles.onboarded_at). See
-- missions/20260717-183157/features/F010-profiles-schema.md for the full
-- clarified spec.
--
-- Two tables:
--   * profiles -- one row per auth.users row, 1:1, holds onboarding inputs
--     (sex, birth_year, height_cm, weight_kg, activity_level), the
--     onboarding-completion marker (onboarded_at), and the is_admin flag
--     (F033 gates the admin area on this, set manually in the DB per
--     discovery -- no self-serve admin signup path).
--   * targets -- history table, many rows per user. Every recalculation
--     (initial onboarding, weekly auto-recalc F045, manual adjustment F046)
--     inserts a new row rather than updating in place, so `effective_from
--     desc limit 1` always finds the currently-active target and the full
--     history survives for the trend chart / audit trail.
--
-- Every column is nullable except the ones that must always have a value
-- (is_admin, timestamps, targets' own numeric fields) -- profiles starts as
-- an empty shell created at signup (see Notes for the next worker in the
-- handoff) and is filled in incrementally by the onboarding wizard (F015).
--
-- Transactional: migration runs as a single implicit transaction, so any
-- statement failing rolls the whole file back atomically (Supabase applies
-- each migration file inside its own transaction).

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  sex            text check (sex in ('male', 'female')),
  birth_year     integer check (birth_year between 1900 and 2100),
  height_cm      numeric(5, 1) check (height_cm > 0),
  weight_kg      numeric(5, 1) check (weight_kg > 0),
  activity_level text check (
    activity_level in (
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active'
    )
  ),
  is_admin       boolean not null default false,
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row (1:1). Onboarding inputs + is_admin flag + onboarded_at completion marker (AS-031).';
comment on column public.profiles.onboarded_at is
  'Null until the onboarding wizard (F015/F016) completes, later features route on this being non-null (AS-031).';
comment on column public.profiles.is_admin is
  'Set manually in the DB by a human operator (no self-serve admin signup). Gates /admin (F033, AS-059).';

-- Keep `updated_at` accurate without relying on every caller to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Own-row policies: an authenticated user may only see/change the profile
-- row whose user_id matches their own auth.uid() (AS-013). No cross-user
-- policy exists on this table at all -- admin tooling (F033/F036) uses the
-- service-role admin client (src/lib/supabase/server.ts createAdminClient),
-- which bypasses RLS entirely rather than needing a permissive policy here.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- targets
-- ---------------------------------------------------------------------

create table if not exists public.targets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  daily_kcal        integer not null check (daily_kcal > 0),
  protein_g         numeric(6, 1) not null check (protein_g >= 0),
  fat_g             numeric(6, 1) not null check (fat_g >= 0),
  carbs_g           numeric(6, 1) not null check (carbs_g >= 0),
  weekly_kcal       integer not null check (weekly_kcal > 0),
  goal_weight_kg    numeric(5, 1) not null check (goal_weight_kg > 0),
  timeframe_weeks   integer not null check (timeframe_weeks > 0),
  effective_from    timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

comment on table public.targets is
  'History of computed daily/weekly targets per user (F014 budget engine output). Many rows per user, newest effective_from wins (F045/F046 insert new rows rather than updating).';

-- Hot query path: "give me the currently-active target for this user" is
-- `where user_id = :uid order by effective_from desc limit 1` on every
-- home-screen / weekly-dashboard load (F027, F041).
create index if not exists targets_user_id_effective_from_idx
  on public.targets (user_id, effective_from desc);

alter table public.targets enable row level security;

drop policy if exists "targets_select_own" on public.targets;
create policy "targets_select_own"
  on public.targets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "targets_insert_own" on public.targets;
create policy "targets_insert_own"
  on public.targets for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "targets_update_own" on public.targets;
create policy "targets_update_own"
  on public.targets for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "targets_delete_own" on public.targets;
create policy "targets_delete_own"
  on public.targets for delete
  to authenticated
  using (user_id = auth.uid());
