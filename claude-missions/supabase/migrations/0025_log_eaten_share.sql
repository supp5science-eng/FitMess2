-- "Nisam sve pojeo": how much of a logged meal actually got eaten.
--
-- Problem this solves (2026-08-01): every add-flow estimates what was SERVED,
-- because that is all a photograph can show -- and the moment a meal is logged
-- is BEFORE anyone has eaten it. What the day should count is what went in.
-- Someone who leaves a third of a burek has two options today: type a smaller
-- gram figure (a number nobody knows) or log a meal they didn't eat. So the
-- question belongs where it can honestly be answered -- on the meal card,
-- afterwards -- and it needs somewhere to live.
--
-- Why a column rather than just scaling the row and forgetting:
--
--   Scaling in place works once. The second visit is where it breaks: the row
--   now holds what was EATEN, so a slider that reopened at 100% would have no
--   way back -- setting 30% by mistake could only be undone by asking for 333%.
--   Keeping the share means the served plate is always recoverable
--   (served = stored / share), so the control is fully reversible: slide back
--   to 100% and the entry is exactly what it was.
--
-- The row's own numbers stay the EATEN ones, deliberately. Every reader in the
-- app (the day's ring, the week summary, the micronutrient page, the export)
-- keeps summing `logs.kcal` with no knowledge of this column -- a meal that was
-- half-eaten simply IS a smaller meal. Only the sheet that offers the slider
-- reads the share.
--
-- 100 = the whole plate, and the default, so every existing row and every new
-- log means "ate all of it" without a backfill. `> 0` because a meal nobody
-- touched is a delete, not a share, and `<= 100` because eating more than was
-- served is "Dodaj još", not this.
--
-- No RLS change: the column rides on `logs`, already restricted to the owning
-- user (`logs_select_own` / `logs_update_own`, 0004). Retention unchanged --
-- pruned with its row by `fitmess-prune-old-logs` (0010).
--
-- Idempotent: `add column if not exists`.

alter table public.logs
  add column if not exists eaten_share numeric(5, 2) not null default 100
    check (eaten_share > 0 and eaten_share <= 100);

comment on column public.logs.eaten_share is
  'Percentage of the served portion that was actually eaten (100 = all of it, the default). The row''s own grams/kcal/macros are already the EATEN amounts -- this only records the ratio, so the served plate stays recoverable and the "Nisam sve pojeo" slider is reversible.';
