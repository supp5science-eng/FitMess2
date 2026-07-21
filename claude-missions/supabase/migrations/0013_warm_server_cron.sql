-- Keep the Vercel server warm so the app opens fast (no cold-start black
-- screen).
--
-- Problem (2026-07-21): FitMess is a PWA opened after pauses, and `main` is
-- auto-deployed on every push (many agents push all day -> frequent fresh, COLD
-- deployments). When the serverless function has gone cold, the first request
-- must wake it (~1-3s of black screen before even the loading skeleton paints).
-- Because the whole app is dynamically rendered (the root layout reads the
-- theme cookie), nothing can be served statically from the edge -- the Node
-- function must wake on every visit. So the fix is to keep it awake.
--
-- Mechanism: a pg_cron job pings the app every few minutes from Supabase's own
-- always-on infrastructure (no external service, no GitHub Actions minutes, no
-- Vercel Pro cron). The ping hits the phone-only gate route `/samo-za-telefon`
-- with a DESKTOP User-Agent on purpose: the middleware serves that route
-- directly via `NextResponse.next()` for non-mobile visitors (no auth, no DB),
-- which invokes the shared Next SSR server function -- the same function that
-- renders `/danas` -- and thus keeps it warm. A cache-busting `?_warm=<epoch>`
-- query defeats any edge caching so every ping actually reaches the function.
--
-- Uses `pg_net` (async, non-blocking HTTP from Postgres). A generous 15s
-- timeout lets a genuinely cold wake-up complete so the function fully warms.
-- Every 3 minutes comfortably beats Vercel's idle-to-cold window.
--
-- Idempotent: `create extension if not exists`, and the job is unscheduled (if
-- a prior copy exists) before being (re)scheduled under the same name.
--
-- NOTE ON APPLYING: `create extension pg_net` via the SQL editor can fail on a
-- Supabase gateway timeout -- enabling pg_net via Dashboard -> Database ->
-- Extensions (toggle) is more reliable (same lesson as pg_cron in
-- 0010_logs_retention.sql). Enable pg_net first, then run the rest.
--
-- To remove the warmer: select cron.unschedule('fitmess-warm-server');

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Drop any previous copy of this named job so re-running is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'fitmess-warm-server') then
    perform cron.unschedule('fitmess-warm-server');
  end if;
end;
$$;

select cron.schedule(
  'fitmess-warm-server',
  '*/3 * * * *',
  $$
  select net.http_get(
    url := 'https://fitmess.app/samo-za-telefon?_warm=' || extract(epoch from now())::bigint,
    headers := jsonb_build_object(
      'User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitMessWarmer'
    ),
    timeout_milliseconds := 15000
  );
  $$
);
