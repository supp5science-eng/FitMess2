# F050: AI infra — Anthropic client, streaming route, usage logging, caps

**Milestone:** M6 — Agent
**Estimated worker time:** 45 minutes
**Depends on:** F002

## Assertion IDs covered
- AS-100 (token usage logged per user/provider), AS-130 (server-side daily caps enforced)

## Draft scope
- @google/genai server-side client; model gemini-3.5-flash (agent AND vision); streaming helper (generateContentStream)
- ai_usage table (user_id, provider, model, input_tokens, output_tokens, kind, created_at) — provider = 'gemini'
- Cap middleware: 30 agent msgs + 10 photo analyses per user per Belgrade day, enforced before provider call

## Files (approximate)
src/lib/ai/gemini.ts, src/lib/ai/caps.ts (+ tests), supabase/migrations/0005_ai_usage.sql

## Notes for clarification
- AMENDED 2026-07-17: agent moved from Anthropic to Gemini (single provider). Both F050 (agent infra) and F060 (vision) now share this @google/genai client.
- GEMINI_API_KEY server-only; never exposed client-side
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F050-clarification.md)

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
