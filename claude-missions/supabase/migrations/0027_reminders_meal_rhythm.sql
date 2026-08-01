-- Podsetnici v3 — 2026-08-01.
--
-- What changes, and why:
--
--  * `morning_*` is RETIRED — no code reads it after this migration. It was a
--    fixed 10:00 "upiši doručak" that went out every day whether or not the
--    user had already logged. A reminder that arrives at the same minute
--    regardless of what you did is a clock, not a reminder, and it is the
--    single biggest reason the app's notifications were worth muting. Its
--    replacement needs no columns: the meal reminder is timed off the user's
--    OWN median logging time, computed from public.logs at send time
--    (src/lib/push/meal-rhythm.ts).
--
--    The columns are left in place rather than dropped here, deliberately. 0022
--    dropped no_log_* in the same breath as replacing it, which was fine on a
--    table with a handful of rows and no traffic; this one is dropped in a
--    follow-up once v3 has run for a few weeks, so a rollback to the previous
--    deployment keeps working instead of erroring on a column that no longer
--    exists. Nothing reads them in the meantime.
--
--  * `meal_enabled` / `meal_last_sent` — the new reminder's switch and its
--    once-a-day guard. No time column on purpose (see above).
--
--  * `sent_day` / `sent_count` — the hard ceiling's bookkeeping. At most two
--    pushes per person per day from all reminders combined, counted here so it
--    survives a restart and so a re-run of the 15-minute cron cannot spend the
--    budget twice. The evening recap also became conditional in the same
--    change, so in practice most days now carry one push or none.
--
alter table public.reminder_settings
  add column if not exists meal_enabled   boolean not null default true,
  add column if not exists meal_last_sent date,
  add column if not exists sent_day       date,
  add column if not exists sent_count     smallint not null default 0;

-- Inherit the old switch: someone who had turned the morning nudge OFF was
-- telling us something about food reminders in general, and the meal nudge is
-- that reminder done properly — not a fresh opt-in we get to assume.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reminder_settings'
      and column_name = 'morning_enabled'
  ) then
    update public.reminder_settings
      set meal_enabled = morning_enabled;
  end if;
end $$;

comment on column public.reminder_settings.meal_enabled is
  'Whether the meal reminder is on. It has no time column: it fires off the user''s own median logging time for the meal that is missing (src/lib/push/meal-rhythm.ts).';
comment on column public.reminder_settings.meal_last_sent is
  'Belgrade calendar day the meal reminder last went out. One per day, at most.';
comment on column public.reminder_settings.sent_day is
  'The Belgrade calendar day sent_count refers to. A different day means the count is stale and reads as zero.';
comment on column public.reminder_settings.sent_count is
  'Pushes sent to this user on sent_day. Hard ceiling of MAX_PER_DAY (src/lib/push/due.ts) across all reminders combined.';
