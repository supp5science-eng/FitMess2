-- F020: foods (shared catalog) + logs (user-owned) schema, RLS.
--
-- Covers AS-032 (a food record stores name_sr, brand, per-100g macros,
-- common_units, source, verified, and an optional unique barcode) and
-- AS-057 (inserting a second food with an already-used barcode is
-- rejected). See missions/20260717-183157/features/F020-foods-schema.md
-- for the full clarified spec.
--
-- Two tables, two very different ownership models:
--   * foods -- a SHARED catalog (not user-owned). Every authenticated user
--     can read every row (crowd-sourced food database), and any
--     authenticated user can INSERT a new food (crowd-sourcing new
--     entries), but only an operator using the service-role admin client
--     (src/lib/supabase/server.ts createAdminClient, bypasses RLS
--     entirely) can UPDATE or DELETE -- there is deliberately no
--     UPDATE/DELETE policy on this table at all, so ordinary authenticated
--     callers can never edit or remove someone else's (or their own)
--     submitted food row via the public API.
--   * logs -- USER-OWNED (own-row RLS, same pattern as
--     public.profiles/public.targets from 0001_profiles.sql). Every
--     numeric/name field on a log row is a SNAPSHOT taken at log time, so a
--     later edit to the referenced food (or the food being deleted
--     entirely) never changes a user's historical log entries.
--
-- pg_trgm + unaccent are enabled here (not used by any object created in
-- this file) because F023 (food search) needs them and this is the first
-- migration to touch the foods domain -- see the clarified spec's Round B
-- decision #14.
--
-- Transactional: this migration runs as a single implicit transaction, so
-- any statement failing rolls the whole file back atomically (Supabase
-- applies each migration file inside its own transaction).

-- ---------------------------------------------------------------------
-- extensions (F023 search groundwork)
-- ---------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- foods (shared catalog, not user-owned)
-- ---------------------------------------------------------------------

create table if not exists public.foods (
  id              uuid primary key default gen_random_uuid(),
  name_sr         text not null,
  brand           text,
  kcal_100g       numeric(7, 2) not null default 0 check (kcal_100g >= 0),
  protein_100g    numeric(7, 2) not null default 0 check (protein_100g >= 0),
  carbs_100g      numeric(7, 2) not null default 0 check (carbs_100g >= 0),
  fat_100g        numeric(7, 2) not null default 0 check (fat_100g >= 0),
  common_units    jsonb not null default '[]'::jsonb,
  source          text not null default 'user' check (source in ('seed', 'off', 'user')),
  verified        boolean not null default false,
  barcode         text unique,
  submitted_by    uuid references auth.users (id) on delete set null,
  label_photo_path text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.foods is
  'Shared crowd-sourced/seeded/OFF-imported food catalog (AS-032). NOT user-owned -- readable by every authenticated user, insertable by any authenticated user, but only the service-role admin client may update/delete (no permissive UPDATE/DELETE policy exists on this table).';
comment on column public.foods.common_units is
  'jsonb array of {label: string, grams: number}, e.g. [{"label":"parce","grams":50}] -- user-facing portion shortcuts (F024).';
comment on column public.foods.source is
  'Provenance: ''seed'' (curated launch data, F021), ''off'' (Open Food Facts import, F022), or ''user'' (crowd-sourced submission).';
comment on column public.foods.barcode is
  'EAN-13/UPC/GTIN barcode, nullable (most foods have none), UNIQUE when present (AS-057 -- a second food submitted with an already-used barcode is rejected by this constraint).';
comment on column public.foods.submitted_by is
  'auth.users id of the crowd-sourcing submitter, nullable. ON DELETE SET NULL: deleting a user account anonymizes (does not delete) any shared food rows they submitted -- foods are shared catalog data, not personal data, and must survive the submitter''s account deletion (F019/AS-015 scope is the submitter''s OWN personal-data rows only, never shared catalog rows).';

drop trigger if exists foods_set_updated_at on public.foods;
create trigger foods_set_updated_at
  before update on public.foods
  for each row
  execute function public.set_updated_at();

alter table public.foods enable row level security;

-- Readable by every authenticated user (shared catalog) -- deliberately
-- `using (true)`, unlike every own-row policy elsewhere in this schema,
-- because foods is explicitly NOT user-owned data.
drop policy if exists "foods_select_all_authenticated" on public.foods;
create policy "foods_select_all_authenticated"
  on public.foods for select
  to authenticated
  using (true);

-- Crowd-sourcing: any authenticated user may insert a new food, but only
-- ever attributing it to themselves (or leaving it unattributed) -- never
-- forging another user's id as submitted_by.
drop policy if exists "foods_insert_authenticated" on public.foods;
create policy "foods_insert_authenticated"
  on public.foods for insert
  to authenticated
  with check (submitted_by is null or submitted_by = auth.uid());

-- No UPDATE or DELETE policy on this table at all -- admin-only mutation
-- goes through src/lib/supabase/server.ts's createAdminClient (service-role
-- key, bypasses RLS entirely), per the clarified "Access control" answer.

-- ---------------------------------------------------------------------
-- logs (user-owned)
-- ---------------------------------------------------------------------

create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  food_id    uuid references public.foods (id) on delete set null,
  name       text not null,
  grams      numeric(7, 1) not null check (grams > 0),
  kcal       numeric(7, 1) not null check (kcal >= 0),
  protein    numeric(7, 1) not null check (protein >= 0),
  carbs      numeric(7, 1) not null check (carbs >= 0),
  fat        numeric(7, 1) not null check (fat >= 0),
  logged_at  timestamptz not null default now(),
  method     text not null check (method in ('search', 'barcode', 'label', 'meal', 'agent')),
  created_at timestamptz not null default now()
);

comment on table public.logs is
  'User-owned daily food-log entries (M3 manual logging). name/grams/kcal/protein/carbs/fat are a SNAPSHOT taken at log time -- a later edit to (or deletion of) the referenced food never changes historical log rows, per the clarified "money-math"/snapshot convention.';
comment on column public.logs.food_id is
  'Nullable reference to public.foods -- ON DELETE SET NULL so a food being removed never cascades away a user''s log history (the snapshot columns above already hold everything needed to display/keep the entry).';
comment on column public.logs.method is
  'How this entry was created: search (F024), barcode (F026), label (F030/vision), meal (F028 saved-meal repeat), agent (F038 conversational logging).';

-- Hot query path: "today's / this week's log entries for this user" is
-- `where user_id = :uid order by logged_at desc` on every home-screen /
-- weekly-dashboard load (F027, F041), same pattern as
-- targets_user_id_effective_from_idx in 0001_profiles.sql.
create index if not exists logs_user_id_logged_at_idx
  on public.logs (user_id, logged_at desc);

alter table public.logs enable row level security;

drop policy if exists "logs_select_own" on public.logs;
create policy "logs_select_own"
  on public.logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "logs_insert_own" on public.logs;
create policy "logs_insert_own"
  on public.logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "logs_update_own" on public.logs;
create policy "logs_update_own"
  on public.logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "logs_delete_own" on public.logs;
create policy "logs_delete_own"
  on public.logs for delete
  to authenticated
  using (user_id = auth.uid());
