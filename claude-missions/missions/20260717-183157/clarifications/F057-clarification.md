# F057 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: job_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Next.js route handler triggered by a Vercel cron schedule
**2. Data shape** — star (chosen): Per the draft scope
**3. State / storage** — star (chosen): Postgres (Supabase)
**4. API contract** — star (chosen): n/a (invoked by scheduler); returns 200 + summary
**5. Failure handling** — star (chosen): Idempotent; safe to re-run; errors reported to Sentry, partial work not left inconsistent
**6. Empty / zero state** — star (chosen): No-op cleanly when nothing is due
**7. Validation rules** — star (chosen): Guards on due-ness and preconditions
**8. Performance budget** — star (chosen): Completes within the serverless function timeout
**9. Auth / access** — star (chosen): Protected by a cron secret header; not publicly invocable
**10. Touches** — star (chosen): Per the draft scope + writes a small state/notice row

## Round B — 5 follow-up decisions (star defaults)

**11.** Schedule declared in vercel.json crons
**12.** Belgrade-time due-ness computed via src/lib/dates.ts
**13.** Second run in the same window no-ops (idempotent)
**14.** Skips users with no recent data
**15.** Summarization/reminder jobs exempt from user AI caps (system-initiated)

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Integration test invoking the handler directly
**17. Failure test** — Test of the no-op / failure path (nothing due, or forced error)
**18. Manual verification** — Trigger manually once, confirm the effect
**19. Side-effect verification** — Idempotent — a second run in the window changes nothing
**20. Evidence artifact** — Log lines from a real run + test output
