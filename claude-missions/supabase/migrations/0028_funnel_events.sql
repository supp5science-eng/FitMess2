-- `funnel_events`: the first time each user reached a named point in a flow.
--
-- Why this exists (measured 2026-08-03): of 29 real accounts, 27 confirmed
-- their email and only 13 finished the questionnaire. Fourteen people verified
-- an account and then vanished inside the wizard -- and we could not say at
-- WHICH step, because the wizard keeps its answers in component state and
-- writes to `profiles`/`targets` only at the very end. A funnel with no
-- instrumentation can only be guessed at, and the guess costs a redesign of
-- the wrong screen.
--
-- The same blindness applied to the notification permission ask: zero new
-- subscriptions since it shipped told us nothing, because we could not
-- distinguish "people see it and say no" from "people never see it at all"
-- (on an iPhone in a Safari tab it renders nothing, since Apple only allows
-- subscribing from an installed Home Screen app).
--
-- SHAPE: the primary key is `(user_id, event, value)`, so a row records that a
-- point was reached AT LEAST ONCE, and the insert is `on conflict do nothing`.
-- Three consequences, all deliberate:
--   * Idempotent. Re-entering a step, or an effect firing twice under React
--     StrictMode, writes nothing new.
--   * BOUNDED. A user can hold at most as many rows as there are named points
--     (~12 today), so this table cannot grow with usage the way `logs` does --
--     which is why it needs no retention job, unlike 0010's log pruning.
--   * It answers "did they get here?", never "how often". That is the only
--     question a funnel asks, and storing less is the point: this is the
--     narrowest thing that answers it.
--
-- `at` is therefore the FIRST time, not the latest -- see the column comment.
--
-- User-owned, own-row RLS, the same four-policy pattern as `weigh_ins` (0012)
-- and `logs` (0004). No UPDATE policy: an event is a fact about the past and
-- nothing in the app rewrites one. DELETE stays available so "obriši nalog"
-- and any future user-initiated cleanup work through the same door as every
-- other user-owned table.

create table if not exists public.funnel_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event   text not null check (char_length(event) between 1 and 40),
  value   text not null check (char_length(value) between 1 and 40),
  at      timestamptz not null default now(),
  primary key (user_id, event, value)
);

comment on table public.funnel_events is
  'First time each user reached a named point in a flow (onboarding step shown, permission prompt outcome). PK (user_id, event, value) + insert on-conflict-do-nothing makes it idempotent and BOUNDED -- at most one row per named point per user, so it needs no retention job. Answers "did they get here?", never "how often".';
comment on column public.funnel_events.event is
  'The flow: e.g. `onboarding_step`, `push_prompt`. Bounded server-side by an allow-list in POST /api/dogadjaj -- the client cannot invent event names.';
comment on column public.funnel_events.value is
  'The point within the flow: an onboarding step id (`pol`, `godine`, ...) or a prompt outcome (`shown`, `accepted`, `declined`, `denied`, `needs_install`).';
comment on column public.funnel_events.at is
  'When the point was FIRST reached. Later arrivals are discarded by the primary key, so this never moves.';

-- The read is always "this user's events" (export) or an aggregate over the
-- whole table (the funnel itself, run by hand through the Management API).
-- The primary key already indexes `user_id` as its leading column, so no
-- additional index is warranted.

alter table public.funnel_events enable row level security;

drop policy if exists "funnel_events_select_own" on public.funnel_events;
create policy "funnel_events_select_own"
  on public.funnel_events for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "funnel_events_insert_own" on public.funnel_events;
create policy "funnel_events_insert_own"
  on public.funnel_events for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "funnel_events_delete_own" on public.funnel_events;
create policy "funnel_events_delete_own"
  on public.funnel_events for delete
  to authenticated
  using (user_id = auth.uid());
