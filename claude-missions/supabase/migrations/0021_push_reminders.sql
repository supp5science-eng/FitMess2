-- Podsetnici (Web Push reminders) — 2026-07-25.
--
-- Two user-owned tables:
--
--  * push_subscriptions — one row per DEVICE (browser push endpoint). A user
--    can have several (phone + another phone), and a subscription dies on its
--    own (uninstall, permission revoked, endpoint rotated), which the push
--    service reports as HTTP 404/410 — the sender then deletes the row. That is
--    why the endpoint, not the user, is the unique key.
--
--  * reminder_settings — one row per user: which reminders are on and when.
--    v1 ships exactly ONE reminder (the product owner's call): "danas nisi
--    ništa uneo", sent at a chosen time ONLY if the day has no logs yet. Adding
--    a second type later = one boolean + one time column here, nothing else
--    structural.
--
-- Same own-row RLS shape as public.step_counts / public.water_intake: every
-- policy is `user_id = auth.uid()`. The CRON sender does NOT go through RLS —
-- it uses the service-role key server-side (src/app/api/podsetnici/posalji),
-- because by definition it acts for users who are not making the request.
--
-- Times are BELGRADE local wall-clock times (a bare `time`), the same
-- convention every other date/day column in this app follows — FitMess is a
-- single-market (Serbia) product, so there is no per-user timezone.
--
-- NOTE: the pg_cron job that drives the sender is NOT in this file on purpose —
-- its SQL embeds the shared secret (CRON_SECRET), which must never enter git.
-- It is applied separately (Management API) and documented at the bottom.

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

comment on table public.push_subscriptions is
  'User-owned Web Push subscriptions — one row per device/browser endpoint. Deleted by the sender when the push service answers 404/410 (subscription is gone for good).';
comment on column public.push_subscriptions.endpoint is
  'The push service URL for this device. Globally unique: re-subscribing the same device must update, never duplicate.';

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.reminder_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  no_log_enabled    boolean not null default false,
  no_log_time       time not null default '12:00',
  no_log_last_sent  date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.reminder_settings is
  'User-owned reminder preferences. v1: the "danas nisi ništa uneo" push — enabled flag + Belgrade wall-clock time + the last Belgrade day it fired (so it can never fire twice in a day).';
comment on column public.reminder_settings.no_log_time is
  'Belgrade local time of day to check "has this user logged anything?" — bare time, no timezone (single-market app).';
comment on column public.reminder_settings.no_log_last_sent is
  'Belgrade calendar day this reminder last went out. The sender skips a user whose value is already today — the once-a-day guard that also makes the cron safely retryable.';

drop trigger if exists reminder_settings_set_updated_at on public.reminder_settings;
create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row
  execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;

drop policy if exists "reminder_settings_select_own" on public.reminder_settings;
create policy "reminder_settings_select_own"
  on public.reminder_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "reminder_settings_insert_own" on public.reminder_settings;
create policy "reminder_settings_insert_own"
  on public.reminder_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reminder_settings_update_own" on public.reminder_settings;
create policy "reminder_settings_update_own"
  on public.reminder_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reminder_settings_delete_own" on public.reminder_settings;
create policy "reminder_settings_delete_own"
  on public.reminder_settings for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The scheduler (applied OUT of band — contains the shared secret)
--
-- Runs every 15 minutes; the endpoint itself decides who is due (a user whose
-- chosen time has passed within the last 2 hours, who has no logs today, and
-- who has not already been reminded today). Same pg_cron + pg_net mechanism
-- the server warmer uses (0013_warm_server_cron.sql) — no Vercel Pro cron, no
-- external scheduler.
--
--   select cron.schedule(
--     'fitmess-podsetnici',
--     '*/15 * * * *',
--     $$
--     select net.http_post(
--       url := 'https://fitmess.app/api/podsetnici/posalji',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-fitmess-cron', '<CRON_SECRET>'
--       ),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 20000
--     );
--     $$
--   );
--
-- To stop reminders entirely: select cron.unschedule('fitmess-podsetnici');
-- ---------------------------------------------------------------------------
