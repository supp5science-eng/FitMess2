-- F071: Web Push dnevni podsetnici (AS-116..AS-118).
--
-- Three pieces:
--  1. public.push_subscriptions — one row per browser/device Web Push
--     subscription (the endpoint + encryption keys `pushManager.subscribe()`
--     returns). A user can have several (phone + tablet). Own-row RLS, same
--     four-policy pattern as public.water_intake (0015).
--  2. profiles.reminder_time / reminder_last_sent_on — the user's chosen
--     daily reminder time (Belgrade wall-clock; NULL = reminders off) and an
--     idempotency marker (the Belgrade calendar day the reminder was last
--     sent) so the every-5-minutes cron never double-sends within a day.
--  3. A pg_cron job that POSTs to /api/cron/reminders every 5 minutes (same
--     pg_net pattern as 0013_warm_server_cron.sql). The route itself decides
--     who is due (src/lib/push/reminders.ts) and sends via web-push.
--
-- NOTE ON APPLYING:
--  * pg_net + pg_cron should already be enabled (0010, 0013). If not, enable
--    them via Dashboard -> Database -> Extensions first.
--  * REPLACE __CRON_SECRET__ below with the real value of the CRON_SECRET
--    env var configured in Vercel BEFORE running this in the SQL editor.
--    The secret never lives in the repo — only in Vercel env + this cron
--    job's definition inside your own database.
--
-- To remove the job: select cron.unschedule('fitmess-reminders');

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Web Push subscriptions (one per browser/device). endpoint + p256dh + auth are exactly what PushSubscription.toJSON() returns; the reminders cron (api/cron/reminders) sends through them via web-push and prunes rows the push service reports gone (404/410).';

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- Reminder settings live on the profile (same home as `rules`): the chosen
-- daily time in Belgrade wall-clock (NULL = off) and the last Belgrade
-- calendar day a reminder was actually sent (cron idempotency marker).
alter table public.profiles
  add column if not exists reminder_time time,
  add column if not exists reminder_last_sent_on date;

comment on column public.profiles.reminder_time is
  'Daily meal-log reminder time (Belgrade wall-clock). NULL = reminders disabled (AS-118).';
comment on column public.profiles.reminder_last_sent_on is
  'Belgrade calendar day the daily reminder was last sent — keeps the every-5-min cron idempotent within a day.';

-- The scheduler: POST /api/cron/reminders every 5 minutes. The route is
-- excluded from the Next.js middleware matcher (no session work) and
-- authenticates ONLY via the x-cron-secret header checked against Vercel's
-- CRON_SECRET env var.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'fitmess-reminders') then
    perform cron.unschedule('fitmess-reminders');
  end if;
end;
$$;

select cron.schedule(
  'fitmess-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://fitmess.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '__CRON_SECRET__'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
