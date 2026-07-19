-- `foods.is_default`: marks the pre-loaded, hand-curated Serbian starter
-- catalog (the original 350 seed foods) apart from anything added later.
--
-- Product decision (2026-07-19): the admin builds the Serbian catalog by hand
-- over time. Admin-entered foods are stamped source='seed' just like the
-- original starter set (see createVerifiedFood), so `source` alone can't tell
-- "shipped default" from "I added this". This explicit boolean does: the
-- current starter foods get is_default=true, everything created afterwards
-- (admin or user) defaults to false. The food search shows a small "default"
-- badge on is_default rows so the owner can see at a glance what was
-- pre-loaded vs. self-added.
--
-- Idempotent: `add column if not exists` (default false). The one-time
-- backfill of the current starter set is applied against the live DB
-- separately (update ... where source='seed'); on a fresh DB the seed script
-- stamps is_default=true itself.

alter table public.foods
  add column if not exists is_default boolean not null default false;

comment on column public.foods.is_default is
  'true for the pre-loaded, hand-curated Serbian starter catalog (the original ~350 seed foods). Everything created later (admin manual entry via createVerifiedFood, or user-submitted) is false, even when source=''seed''. Purely an informational provenance flag surfaced as a "default" badge in food search -- never affects search ranking or barcode lookup.';
