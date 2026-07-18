-- F017: eating-rule templates persisted per user.
--
-- Adds a `rules` jsonb column to `profiles` holding the 3-5 Serbian
-- eating-rule objects generated at onboarding completion (AS-028,
-- src/lib/budget/rules.ts's `generateRules`) and later toggled/edited by
-- the user on /profil/pravila (AS-029).
--
-- Chosen as a jsonb column on the existing profiles row rather than a new
-- table: rules are a small, user-owned, non-relational list (no need for
-- independent RLS policies, foreign keys, or per-row history) that always
-- travels with the rest of onboarding state and is already covered by
-- profiles' own-row RLS policies (supabase/migrations/0001_profiles.sql,
-- AS-013) -- no new policy is needed here.
--
-- Each array element: { "id": string, "textSr": string, "enabled": boolean }.
-- `id` is the catalog template id (see src/lib/budget/rules.ts's
-- RULE_CATALOG), `textSr` is the (possibly user-edited) Serbian rule text,
-- `enabled` is the user's on/off toggle state. Defaults to an empty array
-- so existing/older profile rows (created before this migration, or never
-- onboarded) never see a null -- see `src/lib/types/db.ts`'s
-- `EatingRuleJson`/`profiles.rules` type, which is non-nullable to match.

alter table public.profiles
  add column if not exists rules jsonb not null default '[]'::jsonb;

comment on column public.profiles.rules is
  'F017: 3-5 generated eating-rule objects ({id, textSr, enabled}), set at onboarding completion (AS-028), toggled/edited on /profil/pravila (AS-029). Covered by profiles'' existing own-row RLS (AS-013), no separate policy.';
