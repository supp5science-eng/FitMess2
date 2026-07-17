# F071: Web Push daily reminder

**Milestone:** M8 — Polish, PWA & Compliance
**Estimated worker time:** 45 minutes
**Depends on:** F070

## Assertion IDs covered
- AS-116 (prompt only after explicit enable), AS-117 (daily push at chosen time), AS-118 (disable stops pushes)

## Draft scope
- VAPID keys + web-push; push_subscriptions table; settings toggle with time picker
- Vercel cron sending due reminders (Belgrade time); Serbian notification copy
- Note: iOS requires installed PWA; Serbia unaffected by EU PWA restrictions

## Files (approximate)
src/app/api/push/subscribe/route.ts, src/app/api/cron/reminders/route.ts, service worker push handler

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F071-clarification.md)

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
