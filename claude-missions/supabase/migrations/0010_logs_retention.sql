-- 30-day meal-log retention: automatically delete logged meals older than 30
-- days.
--
-- Product decision (2026-07-19): the "Svi obroci" meal-history list on
-- /analitika shows only the last 30 days; beyond that, logs are pruned rather
-- than kept forever. This keeps the history intentionally short and the table
-- small. The weekly dashboard only ever looks at the current week, so pruning
-- 30-day-old rows never affects any live view.
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
  $$delete from public.logs where logged_at < now() - interval '30 days';$$
);
