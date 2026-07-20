-- `foods.price`: an optional reference price (RSD) for a catalog product.
--
-- Product decision (2026-07-20): the "Dodaj proizvod" flow lets the admin (and
-- any user) add a product that has a nutrition declaration AND a barcode. Such
-- packaged products have a shelf price, so this column stores a single,
-- informational reference price in Serbian dinars (RSD) for the whole
-- product/package -- NOT per 100 g, and NOT per-user/per-store.
--
-- Nullable on purpose: most existing rows (seed/OFF imports, and any product
-- whose price the submitter doesn't know) simply have no price. `foods` is a
-- SHARED catalog with no UPDATE/DELETE RLS policy (see 0004_foods_logs.sql), so
-- like every other column here it is written on INSERT by the session-scoped
-- crowd-sourcing path and only ever corrected later by the service-role admin
-- client -- the existing insert RLS/ownership rules are unchanged by this
-- additive column.
--
-- Idempotent: `add column if not exists`. numeric(10, 2) comfortably covers any
-- realistic RSD shelf price (up to 99,999,999.99) with para precision, and the
-- non-negative check mirrors the macro columns' own `>= 0` guards.

alter table public.foods
  add column if not exists price numeric(10, 2) check (price is null or price >= 0);

comment on column public.foods.price is
  'Optional reference price in RSD (Serbian dinars) for the whole product/package (NOT per 100 g). Nullable -- most foods have none. A single informational catalog price, not per-user or per-store; written on the crowd-sourcing INSERT and only corrected later by the service-role admin client (no UPDATE RLS policy exists on this table).';
