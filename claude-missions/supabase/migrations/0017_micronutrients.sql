-- Micronutrients: fiber / sugar / sodium / saturated fat, on both the shared
-- `foods` catalog (per 100 g) and the user-owned `logs` snapshot (per entry).
--
-- Product decision (2026-07-25): the home tab gets a second, swipeable page to
-- the right of the calorie ring showing "vlakna / šećer / so / zasićene masti
-- preostalo" plus a derived "Ocena zdravosti" -- i.e. the same four numbers a
-- Cal-AI-style tracker shows. Until now the app tracked only kcal + the three
-- macros, so those numbers did not exist anywhere in the schema.
--
-- Why nullable (NOT `default 0`): for these four nutrients "unknown" and "zero"
-- are genuinely different statements. A 300 kcal plate whose fiber we never
-- estimated must NOT silently contribute 0 g of fiber to the day's total, or the
-- card would confidently show a wrong "preostalo" number. NULL means "we don't
-- know yet" and the UI reports partial coverage honestly (and the AI backfill
-- path -- `src/lib/ai/micro-estimate.ts` -- knows which rows still need filling).
--
-- Units:
--   * fiber / sugar / sat_fat  -- GRAMS  (per 100 g on `foods`, per entry on `logs`)
--   * sodium                   -- MILLIGRAMS (same split). mg, not g, because
--     that is how declarations and daily limits (~2300 mg) are stated, and it
--     avoids three-decimal gram values for salt.
--
-- `logs` follows the SNAPSHOT convention documented in 0004_foods_logs.sql: the
-- per-entry values are computed at log time (from the food's per-100g values, or
-- straight from the AI meal estimate) and never re-joined from `foods`, so a
-- later catalog correction can't rewrite history. `numeric(7,1)` matches the
-- existing macro columns; sodium gets `numeric(8,1)` since a salty 5000 g entry
-- can exceed the 7-digit range in mg.
--
-- `foods` is a SHARED catalog with no UPDATE/DELETE RLS policy (0004): these
-- columns are written on the crowd-sourcing INSERT (label scan / manual entry)
-- and otherwise filled/corrected only by the service-role admin client (the
-- one-off `scripts/backfill-food-micro.ts` AI pass, and the lazy fill at log
-- time). The additive columns change no existing ownership rule.
--
-- Idempotent: `add column if not exists` throughout.

-- ---------------------------------------------------------------- foods (100 g)

alter table public.foods
  add column if not exists fiber_100g numeric(7, 2)
    check (fiber_100g is null or fiber_100g >= 0),
  add column if not exists sugar_100g numeric(7, 2)
    check (sugar_100g is null or sugar_100g >= 0),
  add column if not exists sodium_100g numeric(8, 2)
    check (sodium_100g is null or sodium_100g >= 0),
  add column if not exists sat_fat_100g numeric(7, 2)
    check (sat_fat_100g is null or sat_fat_100g >= 0),
  -- Provenance of the four columns above, so the catalog can tell a value read
  -- off a real declaration from one an AI estimated by name.
  add column if not exists micro_source text
    check (micro_source is null or micro_source in ('label', 'ai', 'manual'));

comment on column public.foods.fiber_100g is
  'Dietary fiber, GRAMS per 100 g. Nullable = unknown (never treated as 0 -- see 0017_micronutrients.sql).';
comment on column public.foods.sugar_100g is
  'Total sugars, GRAMS per 100 g. Nullable = unknown.';
comment on column public.foods.sodium_100g is
  'Sodium, MILLIGRAMS per 100 g (not grams, and not salt/NaCl -- salt g = sodium mg * 2.5 / 1000). Nullable = unknown.';
comment on column public.foods.sat_fat_100g is
  'Saturated fat, GRAMS per 100 g. Nullable = unknown.';
comment on column public.foods.micro_source is
  'Where fiber/sugar/sodium/sat_fat came from: ''label'' (read off a real declaration), ''ai'' (estimated by name+macros, src/lib/ai/micro-estimate.ts), ''manual'' (typed by a human). Nullable while all four are unknown.';

-- Backfill worklist: "catalog rows that still need an AI micro estimate" is the
-- query `scripts/backfill-food-micro.ts` runs, and the lazy per-food fill at log
-- time checks the same condition for one id.
create index if not exists foods_micro_missing_idx
  on public.foods (id)
  where fiber_100g is null and not is_removed;

-- ------------------------------------------------------------- logs (per entry)

alter table public.logs
  add column if not exists fiber numeric(7, 1)
    check (fiber is null or fiber >= 0),
  add column if not exists sugar numeric(7, 1)
    check (sugar is null or sugar >= 0),
  add column if not exists sodium numeric(8, 1)
    check (sodium is null or sodium >= 0),
  add column if not exists sat_fat numeric(7, 1)
    check (sat_fat is null or sat_fat >= 0);

comment on column public.logs.fiber is
  'Dietary fiber for THIS entry, grams. Snapshot (see table comment). Nullable = unknown: the home screen falls back to the referenced food''s per-100g value when present, and reports partial coverage rather than counting unknown as 0.';
comment on column public.logs.sugar is
  'Total sugars for this entry, grams. Snapshot, nullable = unknown.';
comment on column public.logs.sodium is
  'Sodium for this entry, MILLIGRAMS. Snapshot, nullable = unknown.';
comment on column public.logs.sat_fat is
  'Saturated fat for this entry, grams. Snapshot, nullable = unknown.';
