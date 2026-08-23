-- `entitlements` + `ai_usage`: who has paid access, and how much of the free
-- allowance each user has spent today.
--
-- Why this lands BEFORE any payment code exists. Two reasons, and the second
-- is the real one:
--
-- 1. Every AI feature in the app calls a metered vision/audio model. Today
--    there is no per-account ceiling of any kind -- the only ceiling we have
--    been living with is the GLOBAL Gemini free-tier quota, shared by every
--    user at once (see `docs/sta-je-fitmess.md`), which is why "all the AI
--    features stopped" has never been a bug.
--
-- 2. We do not yet know whether selling on the web is worth its risk. The app
--    ships as a remote Capacitor shell, so the site IS the store app's content
--    and a web checkout is one bad render away from a guideline violation. The
--    honest way to decide is to count: `ai_limit_hit` in `funnel_events`
--    records WHICH SURFACE a user was on when they ran out. Two weeks of that
--    says whether a would-be payer who never installs either store app even
--    exists. Guessing costs either a rejected binary or abandoned revenue.
--
-- ENFORCEMENT IS OFF AT BIRTH. The function below counts and reports; the
-- application decides what to do with the answer, and `src/lib/ai/quota.ts`
-- holds that switch. Capping a user at five estimates a day while there is
-- nothing to buy is a punishment with no exit: it costs retention, which is
-- this app's actual problem, and buys nothing. The counting is the value.

-- ---------------------------------------------------------------- entitlements
--
-- One row per user who has access beyond the free tier. Absence of a row IS
-- the free tier -- no backfill, no row per signup, nothing to keep in sync.
--
-- `source` records WHO to believe about this row, because the three payment
-- rails expire differently: an App Store subscription's truth lives in
-- Apple's receipt, Play's in its purchase token, and a manually granted row
-- (a tester, a goodwill refund) answers to nobody. Without it, a webhook
-- cannot tell which rows it is allowed to overwrite.
create table if not exists public.entitlements (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tier       text not null default 'free'
             check (tier in ('free', 'plus')),
  source     text not null
             check (source in ('app_store', 'play', 'stripe', 'manual')),
  -- NULL means "does not expire" (a manual grant). A paid subscription always
  -- carries a date: the store tells us when the current period ends, and a
  -- lapsed renewal is simply a date in the past -- so there is no separate
  -- status column that could fall out of step with it.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.entitlements is
  'Paid access, one row per entitled user. NO ROW = free tier, so nothing needs backfilling at signup. Written only by the server (service role / SECURITY DEFINER) -- an own-row UPDATE policy would let any user grant themselves a subscription straight through the REST API.';
comment on column public.entitlements.source is
  'Which rail owns this row: app_store | play | stripe | manual. A webhook must only ever overwrite rows its own rail wrote.';
comment on column public.entitlements.expires_at is
  'End of the paid period; NULL = never expires (manual grant). A lapsed subscription is just a past date -- deliberately no separate status column to disagree with it.';

alter table public.entitlements enable row level security;

-- SELECT only. The app reads its own entitlement to decide what to show; every
-- write arrives from a payment webhook holding the service-role key, which
-- bypasses RLS. There is intentionally no INSERT/UPDATE/DELETE policy for
-- `authenticated`: those are the doors a user would walk through to hand
-- themselves 'plus'.
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own"
  on public.entitlements for select
  to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------------ ai_usage
--
-- One row per user per day. `day` is a Belgrade calendar day handed in by the
-- caller, NOT `current_date`: the whole app already reasons in Belgrade days
-- (`toBelgradeCalendarDay` in `@/lib/dates`), and a UTC-rolling counter would
-- reset at 02:00 local and disagree with the very screen the user is looking
-- at. One notion of "today", or the two drift on exactly the nights someone
-- is still logging dinner.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  -- Keeps counting PAST the free allowance on purpose. The overflow IS the
  -- measurement: "how much did we refuse" is the number that says whether a
  -- paid tier has demand behind it, and a counter that stops at the limit
  -- throws that away.
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

comment on table public.ai_usage is
  'AI estimates per user per Belgrade calendar day. Counts past the free allowance deliberately -- the overflow measures refused demand. Written only through consume_ai_quota(); no own-row write policy, or a user could reset their own counter.';
comment on column public.ai_usage.day is
  'Belgrade calendar day, supplied by the caller to match `toBelgradeCalendarDay`. Never current_date: a UTC day rolls at 02:00 local and disagrees with /danas.';

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own"
  on public.ai_usage for select
  to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------- consume_ai_quota
--
-- Charges one AI estimate to the caller and reports where they now stand.
--
-- SECURITY DEFINER because `ai_usage` has no write policy -- and that is the
-- point. The user id is read from `auth.uid()` INSIDE the function rather than
-- accepted as an argument, so a caller can only ever move their own counter,
-- no matter what they pass in.
--
-- The increment is a single INSERT .. ON CONFLICT DO UPDATE, so two estimates
-- fired at once (a double tap, a retried action) cannot both read "3" and both
-- write "4". `returning` hands back the post-increment value from the same
-- statement, so no read-then-write window exists at all.
create or replace function public.consume_ai_quota(p_day date)
returns table (used integer, entitled boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_used integer;
  v_entitled boolean;
begin
  if v_user is null then
    raise exception 'consume_ai_quota: no authenticated user';
  end if;

  select exists (
    select 1 from public.entitlements e
    where e.user_id = v_user
      and e.tier <> 'free'
      and (e.expires_at is null or e.expires_at > now())
  ) into v_entitled;

  insert into public.ai_usage as u (user_id, day, count)
  values (v_user, p_day, 1)
  on conflict (user_id, day)
  do update set count = u.count + 1
  returning u.count into v_used;

  return query select v_used, v_entitled;
end;
$fn$;

comment on function public.consume_ai_quota(date) is
  'Charges one AI estimate to auth.uid() for the given Belgrade day and returns (used, entitled). SECURITY DEFINER: ai_usage has no write policy, and the user id comes from auth.uid() inside the function, so a caller can only ever move their own counter. Single-statement upsert, so concurrent calls cannot both read the same count.';

revoke all on function public.consume_ai_quota(date) from public;
grant execute on function public.consume_ai_quota(date) to authenticated;
