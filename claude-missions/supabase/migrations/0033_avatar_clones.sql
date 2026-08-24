-- `avatar_clones`: the generated character ("klon") that stands in for the user
-- everywhere the app shows a person.
--
-- The klon is made ONCE, right after install, from 5-20 photos the user picks
-- (`/onboarding/klon`). The photos go to the image model inline, in the request
-- body, and are thrown away the moment the answer comes back -- exactly the way
-- `src/lib/ai/gemini.ts` already handles voice clips. THIS TABLE NEVER HOLDS A
-- SOURCE PHOTO, only the drawing that came out. That is not a storage
-- optimisation, it is the promise the screen makes to the user: face photos are
-- the most sensitive thing this app has ever asked for, and the only honest way
-- to ask is to not keep them.
--
-- What DOES stay is one small PNG per user, base64 in this row -- the same
-- storage choice `0014_meal_photos.sql` argued for and for the same reasons: it
-- is tiny, it needs no bucket / object lifecycle / orphan-file handling, and it
-- reuses the own-row RLS patterns already in this schema.
--
-- `prompt_version` is what makes the klon reproducible. The art direction lives
-- in ONE constant in the code (`src/lib/avatar/clone-prompt.ts`) -- the template
-- is identical for every user, only the face changes -- so when that constant is
-- rewritten, this column says which klons were drawn by the old wording and can
-- be offered a re-draw. Without it a style change silently splits the user base
-- into two looks with no way to tell them apart.

create table if not exists public.avatar_clones (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  image_base64   text not null,
  mime_type      text not null default 'image/png',
  prompt_version text not null,
  -- How many photos were fed in. Kept as a quality signal (a klon built from
  -- five photos is a weaker likeness than one built from twenty), never shown.
  source_count   smallint not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.avatar_clones is
  'One generated avatar ("klon") per user, base64 PNG. Built from 5-20 user photos that are NEVER stored -- they reach the image model inline and are discarded. prompt_version records which art-direction constant drew it (src/lib/avatar/clone-prompt.ts).';

alter table public.avatar_clones enable row level security;

-- Own-row read: a user only ever sees their own klon.
drop policy if exists "avatar_clones_select_own" on public.avatar_clones;
create policy "avatar_clones_select_own"
  on public.avatar_clones for select
  to authenticated
  using (user_id = auth.uid());

-- Own-row insert.
drop policy if exists "avatar_clones_insert_own" on public.avatar_clones;
create policy "avatar_clones_insert_own"
  on public.avatar_clones for insert
  to authenticated
  with check (user_id = auth.uid());

-- Own-row update -- "napravi ponovo" overwrites the same row rather than
-- growing a history nobody asked for.
drop policy if exists "avatar_clones_update_own" on public.avatar_clones;
create policy "avatar_clones_update_own"
  on public.avatar_clones for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Own-row delete. Account deletion is already covered by the ON DELETE CASCADE
-- above; this is the explicit "obriši mog klona" path from Podešavanja.
drop policy if exists "avatar_clones_delete_own" on public.avatar_clones;
create policy "avatar_clones_delete_own"
  on public.avatar_clones for delete
  to authenticated
  using (user_id = auth.uid());
