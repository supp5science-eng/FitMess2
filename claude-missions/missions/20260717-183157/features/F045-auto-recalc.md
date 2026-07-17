# F045: Weekly TDEE auto-recalc from weight trend

**Milestone:** M5 — Weekly Dashboard, Weight & Streak
**Estimated worker time:** 45 minutes
**Depends on:** F043, F014

## Assertion IDs covered
- AS-078 (weekly auto-recalc from 7-day trend), AS-079 (Serbian notice with new budget)

## Draft scope
- Vercel cron (Monday early morning): recompute targets from latest trend weight, insert new targets row (effective_from)
- Skip when no recent weigh-ins; small-change threshold to avoid noise
- In-app dismissible notice showing old→new budget

## Files (approximate)
src/app/api/cron/recalc/route.ts, vercel.json (crons), notice component

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F045-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: job._

- Pattern: Next.js route handler triggered by a Vercel cron schedule
- Data shape: Per the draft scope
- State location: Postgres (Supabase)
- API contract: n/a (invoked by scheduler); returns 200 + summary
- Failure handling: Idempotent; safe to re-run; errors reported to Sentry, partial work not left inconsistent
- Empty state: No-op cleanly when nothing is due
- Validation: Guards on due-ness and preconditions
- Performance budget: Completes within the serverless function timeout
- Access control: Protected by a cron secret header; not publicly invocable
- Touches: Per the draft scope + writes a small state/notice row

### Follow-up decisions
- Schedule declared in vercel.json crons
- Belgrade-time due-ness computed via src/lib/dates.ts
- Second run in the same window no-ops (idempotent)
- Skips users with no recent data
- Summarization/reminder jobs exempt from user AI caps (system-initiated)

## Definition of done

- **Primary success test:** Integration test invoking the handler directly
- **Failure test:** Test of the no-op / failure path (nothing due, or forced error)
- **Manual verification:** Trigger manually once, confirm the effect
- **Side-effect verification:** Idempotent — a second run in the window changes nothing
- **Evidence artifact:** Log lines from a real run + test output

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
