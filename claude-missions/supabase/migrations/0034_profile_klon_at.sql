-- `profiles.klon_at`: when this user's avatar klon was drawn.
--
-- The klon is a HARD requirement -- no klon, no app (see
-- `src/lib/auth/route-protection.ts`). Which means the middleware has to answer
-- "does this user have one?" on every single navigation, and that answer cannot
-- cost a second round trip: the middleware already fetches `profiles` for the
-- onboarding and phone gates, so the marker belongs on that same row rather
-- than in a `select ... from avatar_clones` beside it.
--
-- It duplicates "a row exists in public.avatar_clones", and that is deliberate.
-- The alternative -- joining the image table on every request -- makes the
-- hottest query in the app read a table whose rows carry a base64 PNG.
--
-- NULL means "not drawn yet", which is exactly the state that holds the gate
-- shut. It is written in the same server action that saves the image, and only
-- after that save succeeds: a klon that failed to store must leave the user
-- gated, or the gate lets someone through to an app that has no avatar for
-- them.

alter table public.profiles
  add column if not exists klon_at timestamptz;

comment on column public.profiles.klon_at is
  'When the avatar klon was drawn (public.avatar_clones row created). NULL = not yet, which holds the mandatory klon gate shut in middleware. Denormalized on purpose: the middleware reads profiles on every navigation and must not join the image table to answer this.';
