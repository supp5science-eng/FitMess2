-- Cilj koraka: a user-chosen daily step goal.
--
-- Until now every user was measured against a flat 10.000 steps -- a marketing
-- figure from a 1965 Japanese pedometer, not a clinical one, and unreachable
-- for a sedentary user who then just stops looking at the card. The goal is now
-- derived from the profile's activity_level (see src/lib/steps/step-goal.ts),
-- and THIS column is the override for people who want their own number.
--
-- NULL means "automatic" -- the derived, activity-based goal. Not defaulted to
-- a number on purpose: a value here means "the user chose this", and that
-- distinction is what lets the settings screen offer "vrati na automatski".

alter table public.profiles
  add column if not exists daily_step_goal integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_daily_step_goal_range'
  ) then
    alter table public.profiles
      add constraint profiles_daily_step_goal_range
      check (daily_step_goal is null or daily_step_goal between 2000 and 30000);
  end if;
end $$;

comment on column public.profiles.daily_step_goal is
  'User-chosen daily step goal. NULL = automatic (derived from activity_level).';
