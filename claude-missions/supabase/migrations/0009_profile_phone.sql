-- Signup "phone number" field: store the user's phone on their profile.
--
-- Collected as a MANDATORY field on the registration form (email + password +
-- phone). NOT used for any verification -- carried purely so the user can be
-- cold-called later. The signup form passes it into `signUp()` options.data
-- (which lands in auth.users.raw_user_meta_data), and the existing signup
-- trigger (0002_profiles_on_signup.sql) is extended below to copy it onto
-- profiles.phone atomically at account creation -- so it fires identically for
-- email/password signUp (the only path that collects a phone) and stays null
-- for Google OAuth / admin.createUser (which don't).
--
-- The column check is a LOOSE length bound on purpose: the app already
-- validates E.164 shape (`phoneSchema` in src/lib/auth/validation.ts) before
-- signUp, and a strict regex here that ever disagreed with that would make the
-- trigger raise and roll back the whole auth.users insert -- i.e. break signup.
-- A generous length check backstops garbage without that risk.
--
-- Idempotent: `add column if not exists` + `create or replace function`.

alter table public.profiles
  add column if not exists phone text
    check (phone is null or char_length(phone) between 5 and 20);

comment on column public.profiles.phone is
  'E.164 phone (e.g. +381600637486) collected as a mandatory, UNVERIFIED signup field for later cold-calling. Copied from auth.users.raw_user_meta_data->>''phone'' by handle_new_auth_user at signup; null for OAuth users.';

-- Extend the signup trigger to also copy the phone from user_metadata into the
-- new profiles shell row. Everything else (SECURITY DEFINER, search_path, the
-- on-conflict-do-nothing idempotency) is unchanged from 0002.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, phone)
  values (new.id, nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user is
  'F011 + 0009: creates the empty public.profiles shell row for a brand-new auth.users row and copies the signup phone (raw_user_meta_data->>''phone'') onto it. SECURITY DEFINER so it can write to public.profiles despite running as supabase_auth_admin.';
