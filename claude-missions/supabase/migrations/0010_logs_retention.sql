-- 3-month meal-log retention: automatically delete logged meals older than 3
-- months.
--
-- Product decision (2026-07-19): two separate windows. The app ONLY EVER
-- SHOWS the last 30 days ("Svi obroci" on /analitika, via getMealHistory's
-- 30-day query window) -- but the rows themselves (meal name + quantity +
-- macros, denormalized on each log) are KEPT IN THE DB for 3 months before
-- being pruned. So a meal disappears from the UI after 30 days but is still
-- on record for ~2 more months (useful for later analytics / recompute),
-- then hard-deleted. The weekly dashboard only looks at the current week, so
-- pruning 3-month-old rows never affects any live view.
--
-- Implemented as a daily pg_cron job (server-side, no app involvement) so the
-- deletion happens even if the user never opens the app. Runs at 03:30 UTC
-- (~04:30/05:30 Belgrade), a quiet hour.
--
-- Idempotent: `create extension if not exists`, and the job is unscheduled (if
-- a prior copy exists) before being (re)scheduled under the same name, so
-- re-applying this migration never creates a duplicate job.

create extension if not exists pg_cron;

-- Drop any previous copy of this named job so re-running is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'fitmess-prune-old-logs') then
    perform cron.unschedule('fitmess-prune-old-logs');
  end if;
end;
$$;

select cron.schedule(
  'fitmess-prune-old-logs',
  '30 3 * * *',
  $$delete from public.logs where logged_at < now() - interval '3 months';$$
);
