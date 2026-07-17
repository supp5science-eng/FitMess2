# F055: Apply confirmed redistribution + log

**Milestone:** M6 — Agent
**Estimated worker time:** 45 minutes
**Depends on:** F054, F053, F046

## Assertion IDs covered
- AS-085 (confirmed entry appears in log + updates remaining), AS-090 (apply only after confirmation), AS-091 (targets change in daily/weekly views)

## Draft scope
- Confirm action: save log entry + insert target_adjustments rows atomically
- Home ring, weekly view, and agent context reflect adjustments immediately
- Undo within session (delete adjustment + log) — nice-to-have, confirm in clarification

## Files (approximate)
src/app/api/agent/confirm/route.ts, chat wiring

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F055-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: api._

- Pattern: Next.js route handler / server action; deterministic helpers factored into src/lib/
- Data shape: Reads/writes the tables named in the draft scope via Supabase
- State location: Postgres (Supabase); server-side only
- API contract: JSON {ok,data} on success / Serbian error object on failure; streaming where the spec says so
- Failure handling: No partial writes (transactional); friendly Serbian error; report to Sentry
- Empty state: Sensible empty response (empty list / null) with 200
- Validation: zod-validated inputs; reject malformed with 400 + Serbian message
- Performance budget: <500ms p95 (excluding external AI latency, which streams)
- Access control: Authenticated; own-user scope enforced by RLS + session; admin routes require admin
- Touches: New route/action + lib helpers + reads existing schema

### Follow-up decisions
- AI routes go through the caps middleware and log token usage (provider=gemini)
- Structured AI output via Gemini responseSchema, validated with zod, 1 retry then Serbian error
- All mutations idempotent where re-run is possible
- Belgrade day/week boundaries via src/lib/dates.ts
- Secrets server-only; never in client bundle

## Definition of done

- **Primary success test:** Integration test (DB + HTTP route)
- **Failure test:** Integration test forcing the failure path (asserts no partial write, Serbian error)
- **Manual verification:** Exercise via the UI flow it powers
- **Side-effect verification:** Only the intended rows are mutated; no cross-user leakage
- **Evidence artifact:** Integration test output

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
