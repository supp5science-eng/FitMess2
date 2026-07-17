# F060: Gemini client + vision route + photo caps

**Milestone:** M7 — Vision
**Estimated worker time:** 45 minutes
**Depends on:** F050

## Assertion IDs covered
- AS-106 (11th photo analysis blocked with Serbian message)

## Draft scope
- @google/genai server client; model gemini-3.5-flash (current Flash tier — supersedes PRD's 3.1)
- Vision route accepting image + task (label|meal); structured JSON responses with confidence
- Photo-cap integration (10/day) via F050 caps middleware; usage logged per provider

## Files (approximate)
src/lib/ai/gemini.ts, src/app/api/vision/route.ts

## Notes for clarification
- MCP at run: none


---

## Clarified implementation (from clarifications/F060-clarification.md)

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
