-- Native push: make the device-token index one that an upsert can actually aim at.
--
-- 0030 created it as a PARTIAL index (`where device_token is not null`) on the
-- theory that a plain unique index would allow only one web row, since every
-- web row has a null token. That theory is wrong: a Postgres unique index
-- treats nulls as DISTINCT by default, so any number of null tokens coexist
-- happily. The proof was already sitting in the same table -- `endpoint` has a
-- plain unique index and became nullable in 0030, and native rows are meant to
-- pile up under it with a null endpoint.
--
-- The partial index was not merely unnecessary, it was load-bearing in the
-- wrong direction. `ON CONFLICT (device_token)` cannot infer a partial index
-- unless the statement repeats its WHERE clause, and PostgREST -- which is what
-- `.upsert({...}, { onConflict: "device_token" })` goes through -- does not emit
-- one. So registering a phone answered:
--
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT
--          specification
--
-- every single time. Verified against the live database on 2026-08-10 before
-- writing this, because "it should work" is how the first version got here.
--
-- The guarantee is unchanged: one row per device token, so a phone that
-- re-registers UPDATES its row instead of collecting a second one that would
-- deliver every reminder twice.

drop index if exists public.push_subscriptions_device_token_key;

create unique index if not exists push_subscriptions_device_token_key
  on public.push_subscriptions (device_token);
