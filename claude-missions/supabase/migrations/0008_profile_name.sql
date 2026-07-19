-- Onboarding "Ime" step: store the user's name on their profile.
--
-- Adds `profiles.full_name`, collected as the second onboarding question
-- (right after "pol"), persisted by the wizard at completion
-- (`src/lib/onboarding/persist.ts`). Nullable like every other onboarding
-- input column: `profiles` starts as an empty shell created at signup
-- (0002_profiles_on_signup.sql) and is filled in incrementally by the
-- wizard (F015). Length-capped defensively so a runaway value can't be
-- stored; the wizard's own client validation is tighter (<= 60 chars).
--
-- Idempotent (`add column if not exists`) so it is safe to re-run.

alter table public.profiles
  add column if not exists full_name text
    check (full_name is null or char_length(full_name) <= 80);

comment on column public.profiles.full_name is
  'The user''s name, collected as the second onboarding question (after sex). Nullable until the wizard (F015/F016) fills it in.';
