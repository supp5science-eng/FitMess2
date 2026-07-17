# F019 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: api_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Next.js route handler / server action; deterministic helpers factored into src/lib/
**2. Data shape** — star (chosen): Reads/writes the tables named in the draft scope via Supabase
**3. State / storage** — star (chosen): Postgres (Supabase); server-side only
**4. API contract** — star (chosen): JSON {ok,data} on success / Serbian error object on failure; streaming where the spec says so
**5. Failure handling** — star (chosen): No partial writes (transactional); friendly Serbian error; report to Sentry
**6. Empty / zero state** — star (chosen): Sensible empty response (empty list / null) with 200
**7. Validation rules** — star (chosen): zod-validated inputs; reject malformed with 400 + Serbian message
**8. Performance budget** — star (chosen): <500ms p95 (excluding external AI latency, which streams)
**9. Auth / access** — star (chosen): Authenticated; own-user scope enforced by RLS + session; admin routes require admin
**10. Touches** — star (chosen): New route/action + lib helpers + reads existing schema

## Round B — 5 follow-up decisions (star defaults)

**11.** AI routes go through the caps middleware and log token usage (provider=gemini)
**12.** Structured AI output via Gemini responseSchema, validated with zod, 1 retry then Serbian error
**13.** All mutations idempotent where re-run is possible
**14.** Belgrade day/week boundaries via src/lib/dates.ts
**15.** Secrets server-only; never in client bundle

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Integration test (DB + HTTP route)
**17. Failure test** — Integration test forcing the failure path (asserts no partial write, Serbian error)
**18. Manual verification** — Exercise via the UI flow it powers
**19. Side-effect verification** — Only the intended rows are mutated; no cross-user leakage
**20. Evidence artifact** — Integration test output
