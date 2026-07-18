-- F034: admin review queue -- verify/remove foods (AS-060, AS-062, AS-063).
--
-- Adds a soft-delete flag to public.foods so an admin "remove" action
-- (AS-063: a removed food no longer appears in search or barcode lookup)
-- keeps existing `logs` rows' snapshot data intact. logs.name/kcal/protein/
-- carbs/fat are already a full snapshot taken at log time
-- (0004_foods_logs.sql's own "money-math"/snapshot convention), so removing
-- a food never changes a user's historical log entries either way -- a soft
-- delete (rather than a hard DELETE) is chosen per the clarified "PREFER a
-- soft-delete" scope note anyway, so the row (and any future admin
-- audit/undo tooling) survives instead of relying on logs.food_id's own
-- ON DELETE SET NULL to be the only trace a removal ever happened.
--
-- public.search_foods() (0005_food_search.sql) is re-published here with an
-- added `not f.is_removed` predicate so a removed food can never be found
-- by name/brand search (AS-063). The barcode lookup
-- (src/lib/food/barcode.ts's lookupFoodByBarcode) is updated in the same
-- feature to add `.eq("is_removed", false)` to its query, so a removed
-- food's barcode also becomes an ordinary "miss" (AS-063) rather than
-- resolving to a food that should no longer be selectable.
--
-- Transactional: this migration runs as a single implicit transaction, so
-- any statement failing rolls the whole file back atomically.

-- ---------------------------------------------------------------------
-- foods.is_removed / foods.removed_at
-- ---------------------------------------------------------------------

alter table public.foods
  add column if not exists is_removed boolean not null default false,
  add column if not exists removed_at timestamptz;

comment on column public.foods.is_removed is
  'F034 admin soft-delete flag (AS-063). true means an admin removed this food from the shared catalog -- it must no longer surface via search (public.search_foods()) or barcode lookup (src/lib/food/barcode.ts lookupFoodByBarcode), while existing logs referencing it (snapshot columns, 0004_foods_logs.sql) are completely unaffected. Never set by an ordinary authenticated user -- there is no RLS UPDATE policy on public.foods at all; only the service-role admin client (behind requireAdminApi(), F033) can set this, exactly like the verified flag.';
comment on column public.foods.removed_at is
  'Timestamp an admin removed this food (F034/AS-063). Null while is_removed is false.';

-- Partial index backing the admin review queue's hot query path
-- ("unverified, not-yet-removed foods, newest first", AS-060) -- a removed
-- food is dropped from verified=false consideration entirely once it has
-- also been marked is_removed, so it never lingers in the queue after
-- being pulled.
create index if not exists foods_unverified_queue_idx
  on public.foods (created_at desc)
  where verified = false and is_removed = false;

-- ---------------------------------------------------------------------
-- search_foods: re-published to exclude removed foods (AS-063)
-- ---------------------------------------------------------------------
-- Identical to 0005_food_search.sql's version except for the added
-- `not f.is_removed` predicate in the WHERE clause -- see that migration's
-- header comment for the full rationale behind every other part of this
-- function (the pg_trgm/word_similarity/prefix-match ranking, the
-- set_limit() call, the result_limit clamp).

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
  select set_limit(0.2);
  select f.*
  from public.foods f
  where
    not f.is_removed
    and (
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
  'F023/F034: ranked food search -- pg_trgm similarity OR word_similarity OR prefix match on unaccented/lowercased name_sr OR brand similarity, ranked verified-first then best-match-desc then name asc (see 0005_food_search.sql for the full tuning rationale). F034 adds: excludes is_removed=true rows entirely (AS-063), so an admin-removed food can never be found by search regardless of how well it would otherwise rank. SECURITY INVOKER (default) so the caller''s own RLS/session still governs which foods rows are visible.';

grant execute on function public.search_foods(text, integer) to authenticated;
