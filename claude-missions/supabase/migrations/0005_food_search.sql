-- F023: food search (pg_trgm similarity + prefix ILIKE, unaccent-tolerant).
--
-- Covers AS-036 (Latin-script name search returns the matching food),
-- AS-037 (Cyrillic input -- already transliterated to Latin by
-- src/lib/food/translit.ts before it reaches this function -- still
-- matches foods stored with Latin names), and AS-038 (a one-character
-- typo still returns the intended food). See
-- missions/20260717-183157/features/F023-food-search-api.md for the full
-- clarified spec.
--
-- pg_trgm + unaccent were already enabled (schema `extensions`) by
-- 0004_foods_logs.sql in anticipation of this feature. This migration adds:
--   1. `public.immutable_unaccent` -- a thin IMMUTABLE wrapper around
--      `extensions.unaccent`, needed because a functional GIN trigram index
--      requires an IMMUTABLE expression and the built-in `unaccent()` is
--      only STABLE (it depends on the search_path-resolved dictionary).
--      Pinning `search_path` inside the function body is what makes it safe
--      to mark IMMUTABLE (the resolved dictionary can never change across
--      calls within this function).
--   2. A functional GIN trigram index on `immutable_unaccent(lower(name_sr))`
--      so trigram similarity lookups (the `%` operator) can use an index
--      scan instead of a sequential scan as the catalog grows past today's
--      1678 rows.
--   3. `public.search_foods(search_query, result_limit)` -- a single
--      SECURITY INVOKER, STABLE SQL function encapsulating the ranking
--      query (verified rows first, then similarity/prefix-match rank
--      desc, then name asc for a stable tie-break), callable via
--      `supabase.rpc('search_foods', ...)` from the session-scoped client
--      so Postgres RLS (`foods_select_all_authenticated`) still applies --
--      SECURITY INVOKER (the default) runs with the CALLING user's
--      privileges/RLS, never bypassing it.
--
-- Transactional: this migration runs as a single implicit transaction (each
-- Supabase migration file is applied inside its own transaction), so any
-- statement failing rolls the whole file back atomically -- no partial
-- schema change.

-- ---------------------------------------------------------------------
-- immutable_unaccent: IMMUTABLE wrapper so it can back a functional index
-- ---------------------------------------------------------------------

create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = extensions, public
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input);
$$;

comment on function public.immutable_unaccent(text) is
  'IMMUTABLE wrapper around extensions.unaccent(), pinned to the extensions dictionary via a fixed search_path -- required so a functional GIN trigram index can be built on its output (Postgres refuses non-IMMUTABLE expressions in an index). Used by the foods_name_sr_trgm_idx index and public.search_foods() (F023).';

-- ---------------------------------------------------------------------
-- functional trigram index on unaccented, lowercased name_sr
-- ---------------------------------------------------------------------

create index if not exists foods_name_sr_trgm_idx
  on public.foods
  using gin (public.immutable_unaccent(lower(name_sr)) gin_trgm_ops);

comment on index public.foods_name_sr_trgm_idx is
  'Functional GIN trigram index backing pg_trgm similarity (the `%` operator) and prefix search in public.search_foods() (F023/AS-036/AS-037/AS-038) -- indexes lower(name_sr) with accents stripped so č/ć/š/ž/đ differences and case do not affect matching.';

-- ---------------------------------------------------------------------
-- search_foods: ranked search RPC
-- ---------------------------------------------------------------------

create or replace function public.search_foods(
  search_query text,
  result_limit integer default 20
)
returns setof public.foods
language sql
stable
security invoker
set search_path = public, extensions
as $$
  -- pg_trgm.similarity_threshold is a placeholder GUC (owned by the pg_trgm
  -- extension) until something in the current backend session actually
  -- loads pg_trgm's shared library -- attaching `set
  -- pg_trgm.similarity_threshold = 0.2` as a FUNCTION-level option (like
  -- 0004_foods_logs.sql's `set search_path = ...` does) only works when the
  -- CREATE FUNCTION statement itself runs in a session where pg_trgm was
  -- already loaded by an earlier statement in the same transaction; on a
  -- brand-new session (e.g. every fresh connection from a pooled RPC call)
  -- Supabase's managed `postgres` role is not a true superuser and gets
  -- `permission denied to set parameter` defining that placeholder --
  -- confirmed empirically while tuning this function (see the F023
  -- handoff). Calling pg_trgm's own `set_limit(real)` function here instead
  -- -- a normal RUNTIME function call, not a DDL-time GUC declaration --
  -- sidesteps that restriction entirely and is unconditionally safe for any
  -- role, in any session, every time this function is called.
  select set_limit(0.2);
  select f.*
  from public.foods f
  where
    public.immutable_unaccent(lower(f.name_sr)) % public.immutable_unaccent(lower(search_query))
    or word_similarity(
      public.immutable_unaccent(lower(search_query)),
      public.immutable_unaccent(lower(f.name_sr))
    ) >= 0.45
    or public.immutable_unaccent(lower(f.name_sr)) like public.immutable_unaccent(lower(search_query)) || '%'
    or (
      f.brand is not null
      and public.immutable_unaccent(lower(f.brand)) % public.immutable_unaccent(lower(search_query))
    )
  order by
    f.verified desc,
    greatest(
      similarity(
        public.immutable_unaccent(lower(f.name_sr)),
        public.immutable_unaccent(lower(search_query))
      ),
      word_similarity(
        public.immutable_unaccent(lower(search_query)),
        public.immutable_unaccent(lower(f.name_sr))
      ),
      case
        when public.immutable_unaccent(lower(f.name_sr)) like public.immutable_unaccent(lower(search_query)) || '%'
        then 1.0
        else 0.0
      end,
      similarity(
        public.immutable_unaccent(lower(coalesce(f.brand, ''))),
        public.immutable_unaccent(lower(search_query))
      )
    ) desc,
    f.name_sr asc
  limit greatest(least(coalesce(result_limit, 20), 50), 1);
$$;

comment on function public.search_foods(text, integer) is
  'F023: ranked food search -- pg_trgm similarity OR word_similarity (both typo-tolerant, AS-038; word_similarity matches a short query against the best-fitting word/substring inside a longer name, e.g. "sara" still finds "Sarma, posna, od vinovog lišća") OR prefix match on unaccented/lowercased name_sr (accent-tolerant, e.g. c/č/ć are equivalent, AS-036/AS-037) OR brand similarity, ranked verified-first then best-match-desc then name asc. SECURITY INVOKER (default) so the caller''s own RLS/session still governs which foods rows are visible -- this function does not bypass foods_select_all_authenticated. Thresholds: pg_trgm.similarity_threshold lowered to 0.2 (from the default 0.3, via runtime set_limit() -- see the comment inside the function body for why NOT a function-level `set` attribute) so a single wrong/missing character in short Serbian food names (5-8 chars) still clears the threshold; word_similarity''s literal cutoff is 0.45 (looser than pg_trgm''s own 0.6 default) tuned against this project''s real seed/OFF data so a short misspelled query still surfaces a food whose full name_sr is a much longer, multi-word description. result_limit is clamped to [1, 50], defaulting to 20 per the clarified "bounded list" answer.';

grant execute on function public.search_foods(text, integer) to authenticated;
