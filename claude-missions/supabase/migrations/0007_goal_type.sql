-- Onboarding goal type (maintain | lose | gain | tone)
--
-- Adds the user's chosen objective to the computed `targets` row and relaxes
-- the two weight-goal columns to nullable, since maintenance / toning goals
-- have no target weight or timeframe.
--
--   * targets.goal            -- the objective that produced this row
--   * targets.goal_weight_kg  -- now nullable (null for maintain/tone)
--   * targets.timeframe_weeks -- now nullable (null for maintain/tone)
--
-- Idempotent: safe to re-run.

alter table public.targets
  add column if not exists goal text
    check (goal is null or goal in ('maintain', 'lose', 'gain', 'tone'));

alter table public.targets alter column goal_weight_kg drop not null;
alter table public.targets alter column timeframe_weeks drop not null;

comment on column public.targets.goal is
  'User goal type that produced this target row: maintain | lose | gain | tone. Null on rows created before 0007.';
