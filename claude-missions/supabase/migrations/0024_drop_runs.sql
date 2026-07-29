-- Drop Trčanje (runs) — the running feature has been removed from the app.
--
-- The whole running feature (the /trcanje screens, the /api/trcanje route
-- handler, src/lib/run/**, and the run map components) is gone; this table and
-- its policies/indexes/trigger are now orphaned, so we drop them to keep the
-- schema matching the shipped product. Introduced in 0023_runs.sql.
--
-- DESTRUCTIVE: this permanently deletes every stored run (route traces + the
-- server-computed distance/pace/calorie totals). There is no other copy — the
-- runs never fed any other table. Apply only when you are sure the feature is
-- staying gone. `drop table ... cascade` also removes the four own-row RLS
-- policies, the two indexes, and the updated_at trigger defined in 0023.

drop table if exists public.runs cascade;
