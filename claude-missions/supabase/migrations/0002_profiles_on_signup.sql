-- F011: auto-create a profiles shell row when a new auth.users row appears.
--
-- Covers the "create the profiles shell row on signup" requirement from
-- missions/20260717-183157/features/F011-email-auth.md ("prefer the
-- trigger"). Without this, a brand-new user (email/password or, later,
-- Google OAuth) would have an auth.users row but no matching
-- public.profiles row until the onboarding wizard (F015) got around to
-- inserting one -- this trigger removes that race/gap entirely by making
-- profile-row creation atomic with account creation, driven by Postgres
-- itself rather than any application code path (so it fires identically for
-- email/password signUp, Google OAuth, and admin.createUser()).
--
-- SECURITY DEFINER is required here: the trigger fires as part of an INSERT
-- into auth.users, which executes as the `supabase_auth_admin` role (GoTrue
-- itself), not as the signing-up user or as `postgres`. `supabase_auth_admin`
-- has no privileges on public.profiles (nor should it -- that would be a far
-- bigger blast radius than this one narrow insert). `security definer` runs
-- the function body with the *definer's* privileges (the role that creates
-- the function, i.e. the migration-runner / project owner), which does have
-- insert rights on public.profiles, so the row can be created without
-- granting supabase_auth_admin anything at all. `set search_path = public`
-- pins name resolution inside the function body (the standard, documented
-- Supabase pattern for this trigger -- see
-- https://supabase.com/docs/guides/auth/managing-user-data#using-triggers)
-- so it cannot be tricked by a session-level search_path change into
-- resolving `profiles` to some other schema.
--
-- `on conflict (user_id) do nothing` makes this safe to re-run/idempotent
-- per-user even if a profiles row somehow already exists for that user_id
-- (e.g. a future re-application of this migration, or a caller that raced
-- an explicit insert) -- it never overwrites onboarding data that may
-- already be there.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user is
  'F011: creates the empty public.profiles shell row for a brand-new auth.users row (email/password signup, Google OAuth, or admin.createUser). SECURITY DEFINER so it can write to public.profiles despite running as supabase_auth_admin -- see migration header comment.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
