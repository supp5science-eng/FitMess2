# F042 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: schema_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): SQL migration file under supabase/migrations/, applied via Supabase MCP
**2. Data shape** — star (chosen): Normalized table(s) exactly as the draft scope specifies
**3. State / storage** — star (chosen): Postgres (Supabase)
**4. API contract** — star (chosen): n/a (DDL only)
**5. Failure handling** — star (chosen): Migration is transactional; rolls back atomically on any error
**6. Empty / zero state** — star (chosen): Tables start empty; queries return empty sets cleanly
**7. Validation rules** — star (chosen): NOT NULL / CHECK / FK constraints + RLS policies enforce integrity
**8. Performance budget** — star (chosen): Indexed primary lookups; add indexes for hot query paths
**9. Auth / access** — star (chosen): RLS own-row policies for user tables; admin-only for privileged mutations
**10. Touches** — star (chosen): New migration + regenerated src/lib/types/db.ts; no other tables altered

## Round B — 5 follow-up decisions (star defaults)

**11.** RLS: authed users read own rows only; writes scoped to auth.uid()
**12.** Foreign keys cascade on user delete where personal data
**13.** Generate TS types from schema after migration
**14.** Enable pg_trgm/unaccent extensions where search needs them
**15.** Timestamps default now(), Belgrade handled in app layer

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Integration test: migration applies cleanly + RLS denies cross-user access
**17. Failure test** — Test forcing a cross-user read/write returns 403/empty
**18. Manual verification** — Inspect schema + policies via Supabase MCP
**19. Side-effect verification** — No unrelated table is created or altered
**20. Evidence artifact** — Migration file + RLS test output
