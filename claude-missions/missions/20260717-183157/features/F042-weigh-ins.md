# F042: Weigh-in recording

**Milestone:** M5 — Weekly Dashboard, Weight & Streak
**Estimated worker time:** 30 minutes
**Depends on:** F010

## Assertion IDs covered
- AS-072 (kg with 1 decimal), AS-073 (same-day weigh-in replaces earlier)

## Draft scope
- weigh_ins table (user_id, date unique per user, weight_kg numeric(4,1)) + RLS
- Quick-entry UI on weekly screen; upsert on same date

## Files (approximate)
supabase/migrations/0003_weigh_ins.sql, src/components/weekly/WeighIn.tsx

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F042-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: schema._

- Pattern: SQL migration file under supabase/migrations/, applied via Supabase MCP
- Data shape: Normalized table(s) exactly as the draft scope specifies
- State location: Postgres (Supabase)
- API contract: n/a (DDL only)
- Failure handling: Migration is transactional; rolls back atomically on any error
- Empty state: Tables start empty; queries return empty sets cleanly
- Validation: NOT NULL / CHECK / FK constraints + RLS policies enforce integrity
- Performance budget: Indexed primary lookups; add indexes for hot query paths
- Access control: RLS own-row policies for user tables; admin-only for privileged mutations
- Touches: New migration + regenerated src/lib/types/db.ts; no other tables altered

### Follow-up decisions
- RLS: authed users read own rows only; writes scoped to auth.uid()
- Foreign keys cascade on user delete where personal data
- Generate TS types from schema after migration
- Enable pg_trgm/unaccent extensions where search needs them
- Timestamps default now(), Belgrade handled in app layer

## Definition of done

- **Primary success test:** Integration test: migration applies cleanly + RLS denies cross-user access
- **Failure test:** Test forcing a cross-user read/write returns 403/empty
- **Manual verification:** Inspect schema + policies via Supabase MCP
- **Side-effect verification:** No unrelated table is created or altered
- **Evidence artifact:** Migration file + RLS test output

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
