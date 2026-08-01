-- Nedeljno merenje + automatska korekcija plana — 2026-08-01.
--
-- The app has always PREDICTED expenditure (Mifflin x an activity factor the
-- user picked once, about themselves) and never measured it. This migration
-- adds the two pieces of state the measurement needs; the arithmetic itself is
-- pure code in `src/lib/weight/weekly-trend.ts`, and the weigh-ins it reads
-- already have a home (`public.weigh_ins`, migration 0012).
--
--   1. WHEN to ask for the weekly weigh-in (reminder_settings.weighin_*)
--   2. WHAT we suggested and what the user said (public.plan_adjustments)
--
-- Transactional: this migration runs inside its own implicit transaction, so
-- any statement failing rolls the whole file back atomically.

-- ---------------------------------------------------------------------------
-- 1. The weekly weigh-in reminder
-- ---------------------------------------------------------------------------
--
-- A third reminder alongside the two daily ones from 0022, and the only one
-- that fires on a DAY OF THE WEEK rather than every day. It lives here rather
-- than on `profiles` because the schedule (day + wall-clock time + the
-- once-per-occurrence guard) is exactly the shape the other two already have,
-- and the sender (`/api/podsetnici/posalji`) can therefore read one table.
--
-- `weighin_day` is 0 = Monday .. 6 = Sunday — the EU/Serbian convention that
-- `belgradeWeekdayIndex` in src/lib/dates.ts already returns, NOT JavaScript's
-- Sunday-first numbering. Default 6: Sunday morning, before the week's eating
-- starts, is the conventional weigh-in slot and the one least distorted by a
-- work-day routine.
--
-- Note the asymmetry with the other reminders: a user with NO row here still
-- sees the in-app weigh-in banner (the app defaults to Sunday in code, see
-- `src/lib/weight/weigh-in-day.ts`). Only the PUSH needs a row, because only
-- push needs a subscription in the first place.

alter table public.reminder_settings
  add column if not exists weighin_enabled   boolean not null default true,
  add column if not exists weighin_day       smallint not null default 6,
  add column if not exists weighin_time      time    not null default '09:00',
  add column if not exists weighin_last_sent date;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'reminder_settings'
      and constraint_name = 'reminder_settings_weighin_day_range'
  ) then
    alter table public.reminder_settings
      add constraint reminder_settings_weighin_day_range
      check (weighin_day between 0 and 6);
  end if;
end $$;

comment on column public.reminder_settings.weighin_day is
  'Day of the week the weekly weigh-in is asked for: 0 = Monday .. 6 = Sunday (the EU convention src/lib/dates.ts belgradeWeekdayIndex returns, NOT JS Sunday-first). Default 6 (Sunday).';
comment on column public.reminder_settings.weighin_time is
  'Belgrade wall-clock time the weigh-in push goes out on `weighin_day` — bare time, no timezone, like the other reminders (single-market app).';
comment on column public.reminder_settings.weighin_last_sent is
  'Belgrade calendar day this reminder last went out. Same once-a-day guard as morning/evening, which is what keeps the every-15-min cron safely re-runnable.';

-- ---------------------------------------------------------------------------
-- 2. plan_adjustments — every suggestion and the user's answer
-- ---------------------------------------------------------------------------
--
-- The trend engine may never change a plan on its own (Law 2 in
-- weekly-trend.ts): it suggests, the user taps. This table is what makes that
-- promise auditable, and it carries two jobs beyond history:
--
--   * A DECLINED suggestion silences the card for two weeks. Asking someone
--     the same question every Sunday after they have already said no is how a
--     feature becomes something you tap past without reading.
--   * An ACCEPTED one records what the old target was, so "we changed your
--     plan from 2.850 to 2.600 on 3 August because you had been stuck for
--     three weeks" survives in the user's own data export.
--
-- `measured_tdee_kcal` is stored alongside because without it the row is a
-- number change with no reason — the whole point is that the correction came
-- from a measurement, not from a guess.
--
-- User-owned, own-row RLS — the same four-policy pattern as public.logs
-- (0004) and public.weigh_ins (0012). RLS is what enforces "own data only";
-- the app layer never filters on trust.

create table if not exists public.plan_adjustments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  day                date not null,
  old_kcal           integer not null check (old_kcal > 0),
  new_kcal           integer not null check (new_kcal > 0),
  -- The `TrendStatus` that produced the suggestion: TOO_SLOW / STALLED /
  -- TOO_FAST. Text rather than an enum so a new status never needs a migration
  -- before the code that emits it can ship.
  reason             text not null,
  accepted           boolean not null,
  measured_tdee_kcal integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.plan_adjustments is
  'History of weekly plan-correction suggestions and what the user answered (2026-08-01 nedeljno merenje). One row per ANSWERED suggestion — the card writes nothing until the user taps. A declined row also silences the card for two weeks (see src/lib/weight/plan-adjustments.ts).';
comment on column public.plan_adjustments.day is
  'Belgrade calendar day the user answered — assigned in the app layer (src/lib/dates.ts toBelgradeCalendarDay), per the app-wide "day boundaries computed in the app, never raw SQL date math" convention.';
comment on column public.plan_adjustments.accepted is
  'true = the user took the new plan (a new public.targets row was inserted in the same request); false = they kept the current one, which suppresses the card for two weeks.';
comment on column public.plan_adjustments.measured_tdee_kcal is
  'The TDEE measured from intake + weight change that justified this suggestion. Nullable only for defensive reasons; the engine always has one when it suggests.';

drop trigger if exists plan_adjustments_set_updated_at on public.plan_adjustments;
create trigger plan_adjustments_set_updated_at
  before update on public.plan_adjustments
  for each row
  execute function public.set_updated_at();

-- Hot query path: "has this user answered a suggestion recently?" — newest
-- first, per user. Same shape as weigh_ins_user_id_day_idx.
create index if not exists plan_adjustments_user_id_day_idx
  on public.plan_adjustments (user_id, day desc);

alter table public.plan_adjustments enable row level security;

drop policy if exists "plan_adjustments_select_own" on public.plan_adjustments;
create policy "plan_adjustments_select_own"
  on public.plan_adjustments for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "plan_adjustments_insert_own" on public.plan_adjustments;
create policy "plan_adjustments_insert_own"
  on public.plan_adjustments for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "plan_adjustments_update_own" on public.plan_adjustments;
create policy "plan_adjustments_update_own"
  on public.plan_adjustments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "plan_adjustments_delete_own" on public.plan_adjustments;
create policy "plan_adjustments_delete_own"
  on public.plan_adjustments for delete
  to authenticated
  using (user_id = auth.uid());
