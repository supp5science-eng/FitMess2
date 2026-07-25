-- "Dodaj još": the itemised breakdown of a logged meal, stored on the log row.
--
-- Problem this solves (2026-07-25): logging is a one-shot act today. You
-- photograph the plate, confirm the estimate, and the entry is frozen. But
-- eating isn't one-shot -- you eat one wafer, log it, then eat a second one;
-- you photograph eggs + tuna + sour cream as ONE meal, then go back for two
-- more eggs and another spoon of cream. Re-photographing for the seconds is
-- exactly the friction that makes people stop logging, so the day's number
-- ends up lower than the truth and the whole app loses credibility (the same
-- coverage argument that produced "Gric").
--
-- Adding "one more of the whole entry" needs no schema at all -- the log row
-- already carries its own totals, so `×2` is arithmetic on the row. What is
-- NOT recoverable after the fact is WHICH PARTS the meal was made of: the AI
-- flows (photo, photo+description, Prizma) all itemise the plate before they
-- total it (`komponente` in `src/lib/ai/meal-estimate.ts`), and today that
-- breakdown is shown on the confirm screen and then thrown away. Keeping it
-- is what makes "+2 eggs, +1 spoon of sour cream" possible without a camera.
--
-- Shape: a jsonb ARRAY of `{naziv, grami, kcal, protein_g, uh_g, mast_g}`,
-- i.e. exactly `mealComponentSchema`'s output, written as-is at log time. jsonb
-- on the row rather than a `log_components` table because it follows this
-- schema's existing SNAPSHOT convention (0004_foods_logs.sql): everything a log
-- entry means is denormalised onto the entry itself, never re-joined, so a later
-- correction elsewhere can't rewrite history. It is also never queried BY its
-- contents -- it is only ever read back whole, for the one row the user tapped.
--
-- NULL = "this entry has no breakdown" (a catalog/barcode/manual entry, or an
-- older AI entry logged before this migration). Those still support "+1 more of
-- the whole thing"; they just have no per-part steppers. An empty array means
-- the same thing and is treated identically by the reader.
--
-- No RLS change: the column rides on `logs`, which already restricts every
-- operation to the owning user (`logs_select_own` / `logs_update_own` etc.).
-- Retention is likewise unchanged -- the breakdown is pruned with its row by
-- `fitmess-prune-old-logs` (0010).
--
-- Idempotent: `add column if not exists`.

alter table public.logs
  add column if not exists components jsonb;

comment on column public.logs.components is
  'Itemised breakdown of this entry: jsonb array of {naziv, grami, kcal, protein_g, uh_g, mast_g}. NULL = no breakdown. Powers "Dodaj još" per-component seconds without re-photographing.';
