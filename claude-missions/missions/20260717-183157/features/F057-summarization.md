# F057: Conversation summarization + transcript pruning

**Milestone:** M6 — Agent
**Estimated worker time:** 45 minutes
**Depends on:** F054

## Assertion IDs covered
- AS-096 (summarize after 30 min inactivity, delete transcript), AS-097 (summaries feed future context)

## Draft scope
- conversations + messages tables with last_activity; summaries table
- Cron job (e.g. every 15 min): sessions idle >30 min → summarize via Claude (cheap, short), store summary, delete transcript messages
- Summaries loaded by F052 context assembly

## Files (approximate)
src/app/api/cron/summarize/route.ts, migrations, src/lib/ai/summarize.ts

## Notes for clarification
- Summarization calls exempt from user caps (system-initiated) — confirm
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F057-clarification.md)

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
