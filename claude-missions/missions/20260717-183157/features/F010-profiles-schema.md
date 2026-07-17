# F010: DB schema — profiles + targets + RLS

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 45 minutes
**Depends on:** F002

## Assertion IDs covered
- AS-013: RLS denies cross-user access. AS-031: Onboarding state persisted.

## Draft scope
- profiles (user_id PK/FK auth.users, sex, birth_year, height_cm, weight_kg, activity_level, is_admin, onboarded_at)
- targets (daily kcal, protein_g, fat_g, carbs_g, weekly kcal, goal weight, timeframe, effective_from)
- RLS own-row policies on all user tables; migrations via supabase CLI

## Files (approximate)
supabase/migrations/0001_profiles.sql, src/lib/types/db.ts

## Notes for clarification
- MCP at run: Supabase MCP (apply migrations, verify RLS)


---

## Clarified implementation (from clarifications/F010-clarification.md)

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
