-- `klon_ip_usage`: how many klons one address has drawn today.
--
-- The klon screen moved to the FRONT of the funnel (landing -> "Kreni" ->
-- klon -> upitnik), which means the endpoint that draws it now answers
-- visitors with no account. Everything else in this app that reaches a paid
-- model sits behind `auth.uid()` and `consume_ai_quota`; this one cannot, and
-- billing is enabled on the Gemini key.
--
-- So the ceiling has to come from somewhere else, and the only thing an
-- anonymous caller carries is an address. It is a weak identifier -- a phone on
-- mobile data shares one with a whole cell, a determined abuser rents a new one
-- -- and that is fine: this is not access control, it is a spend cap. It turns
-- "a script can draw until the card declines" into "a script can draw a few
-- times, then has to work for it", which is the difference that matters at 3am
-- when nobody is watching the dashboard.
--
-- The address is stored HASHED, never raw. An IP is personal data under GDPR
-- and the app's privacy policy does not say it collects any; a salted digest
-- counts just as well and says nothing about who was here.
--
-- Written only by the server (service key, from the route handler), so there is
-- no policy for `authenticated` or `anon` -- RLS is on with no policy at all,
-- which denies every client-side read and write outright.

create table if not exists public.klon_ip_usage (
  ip_hash    text        not null,
  day        date        not null,
  count      integer     not null default 0,
  created_at timestamptz not null default now(),
  primary key (ip_hash, day)
);

comment on table public.klon_ip_usage is
  'Daily per-address spend cap for the PUBLIC (pre-auth) klon endpoint. Addresses are stored salted+hashed, never raw. Server-writes only: RLS is enabled with no policies, so no client can read or write it.';

-- The prune scans by day.
create index if not exists klon_ip_usage_day_idx on public.klon_ip_usage (day);

alter table public.klon_ip_usage enable row level security;

-- Yesterday's counters answer no question anyone will ask. Kept for a week so a
-- spike is still visible the morning after, then dropped -- the same nightly
-- pg_cron prune pattern 0010/0014 established.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune-klon-ip-usage',
      '30 3 * * *',
      $sql$delete from public.klon_ip_usage where day < current_date - 7$sql$
    );
  end if;
exception when others then
  -- No pg_cron on this project (or no permission to schedule): the table just
  -- grows slowly. Never fail the migration over housekeeping.
  raise notice 'klon_ip_usage prune not scheduled: %', sqlerrm;
end $$;

-- ---------------------------------------------------------- consume_klon_ip
--
-- Charges one drawing to an address and returns the post-increment count.
--
-- SECURITY DEFINER, but NOT because a client calls it -- nothing client-side
-- may reach this table at all. The route handler calls it with the service key,
-- which already bypasses RLS; DEFINER is here so the function keeps working if
-- it is ever called from a session-bound client by mistake, rather than failing
-- open in a way nobody notices until the bill arrives.
--
-- One INSERT .. ON CONFLICT DO UPDATE, so two requests fired at once cannot
-- both read the same count and both write count+1. `returning` hands back the
-- new value from the same statement, leaving no read-then-write window.
--
-- Unlike `consume_ai_quota` the identifier IS an argument: there is no
-- `auth.uid()` to read here, which is the entire reason this cap exists. The
-- caller is trusted precisely because the only caller holds the service key.
create or replace function public.consume_klon_ip(p_ip_hash text, p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  insert into public.klon_ip_usage (ip_hash, day, count)
  values (p_ip_hash, p_day, 1)
  on conflict (ip_hash, day)
  do update set count = public.klon_ip_usage.count + 1
  returning count into v_count;

  return v_count;
end;
$fn$;

comment on function public.consume_klon_ip(text, date) is
  'Increments and returns the daily drawing count for one hashed address. Called only by the server (service key) from the public klon route handler, which has no auth.uid() to charge.';

-- No grant to `anon` or `authenticated`: the only caller holds the service key.
revoke all on function public.consume_klon_ip(text, date) from public;
