# F010a: Apply + behaviorally verify profiles/targets schema (follow-up to F010)

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 20 minutes
**Depends on:** F010 (PARTIAL — migration written, not verified live)
**Parent clarification:** inherits missions/20260717-183157/clarifications/F010-clarification.md

## Assertion IDs covered
- AS-013: RLS denies cross-user access to profiles/targets (behavioral proof).
- AS-031: onboarded_at column exists and records onboarding completion.

## Why this follow-up exists (from F010 handoff)
F010 could not apply/verify the migration live because `mcp__supabase__*` tools are NOT bound
in worker subagents. The orchestrator has since APPLIED the migration via the Supabase
Management API (2026-07-17) — `profiles` + `targets` exist, RLS enabled on both, 4 own-row
policies each, verified live. The migration SQL and the RLS integration tests are already
written and committed by F010. This follow-up only needs to RUN and confirm the behavioral
tests now that the schema is live.

## Follow-up scope
- The schema is already applied live (do NOT re-apply unless a check shows it missing; if
  missing, apply supabase/migrations/0001_profiles.sql via the Management API method
  documented in connections/mcp-registry.md).
- Run the existing RLS integration tests
  (src/lib/supabase/__tests__/profiles-rls.integration.test.ts). They were gated by a
  schema-reachability preflight; now that the schema is live they must actually EXECUTE
  (not skip) and PASS: create two users via the admin client (secret key), seed a profiles
  row + a targets row for user A, then confirm a user-B-scoped client CANNOT read them and
  CAN read its own — proving AS-013. Confirm onboarded_at round-trips (AS-031).
- If the tests still skip, fix the preflight so they run against the live DB. Do not weaken
  RLS to make anything pass.
- Update evidence and confirm the full suite (test/lint/typecheck/build) passes.

## Definition of done
- The RLS integration tests EXECUTE (not skipped) and PASS, with output captured as evidence
  under handoffs/evidence/F010a/.
- AS-013 and AS-031 behaviorally proven against the live DB.
- Handoff at handoffs/F010a-handoff.md, Status COMPLETE.

## Notes for the worker
- Use the Management API path (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env, Node
  fetch — jq not installed) only if you need to run raw SQL checks. Test user creation uses
  createAdminClient() (SUPABASE_SECRET_KEY) from src/lib/supabase/server.ts.
- MCP at run: none available in worker; use Management API / SDK only.
