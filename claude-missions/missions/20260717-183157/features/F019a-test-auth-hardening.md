# F019a: Live-integration test auth hardening (follow-up to F019)

**Milestone:** M2 — Auth & Onboarding (cross-cutting test infrastructure)
**Estimated worker time:** 30 minutes
**Depends on:** F019 (PARTIAL — code complete, full suite blocked by shared 429)
**Parent clarification:** inherits missions/20260717-183157/clarifications/F019-clarification.md

## Assertion IDs covered
- AS-015, AS-016 (F019's assertions — close the PARTIAL by getting the full suite green)
- Also unblocks AS-004 (test suite passes) for the whole project going forward.

## Why this follow-up exists (from F019 handoff)
F019's own code + tests pass in isolation. But `npm run test` runs ~15+ live-integration test
files that each create/sign-in Supabase Auth users from one IP, exhausting Supabase's auth
rate limit (was 30/5min sign-in-verify) — escalating 429 failures across the full suite. This
is shared test infrastructure, not F019-specific.

The orchestrator has ALREADY raised the project's Supabase Auth rate limits to 2000/5min
(rate_limit_verify, rate_limit_token_refresh, rate_limit_anonymous_users, rate_limit_otp) via
the Management API. This follow-up adds the durable test-side fix so the suite is reliable
regardless.

## Follow-up scope
- Add a SMALL shared test helper (e.g. src/lib/test-utils/auth-retry.ts or similar) that wraps
  Supabase auth operations used in live-integration tests (signInWithPassword, admin.createUser,
  admin.deleteUser) with retry-with-exponential-backoff on 429 (a few retries, jittered, capped
  — NOT an infinite sleep loop). Keep it minimal and well-typed.
- Apply it across the live-integration test files that create/sign-in users (the ~15 files under
  src/**/__tests__/*.integration.test.ts). Prefer a single shared helper imported everywhere over
  copy-paste. Where cheap, reduce redundant user creation (reuse a user within a file instead of
  creating several) to cut total auth calls.
- Confirm the FULL `npm run test` passes reliably — run it at least twice consecutively fully
  green. Also confirm lint/typecheck/build.
- Do NOT weaken any assertion or delete integration tests to make the suite pass. The goal is
  resilience to transient 429s, not removing live verification.

## Definition of done
- `npm run test` passes fully (all files) at least twice in a row, no 429-induced failures.
- F019's AS-015/AS-016 integration tests execute and pass within the full suite.
- Handoff at handoffs/F019a-handoff.md, Status COMPLETE, with the two consecutive green runs as
  evidence.

## Notes for the worker
- MCP tools NOT bound in workers. Management API via Node fetch (SUPABASE_ACCESS_TOKEN +
  SUPABASE_PROJECT_REF in .env; jq absent) if you need live checks.
- The rate limits are already raised; your retry helper is belt-and-suspenders so future
  features and the milestone validators don't flake.
- Keep the helper generic so M3+ features (which will add more integration tests) can reuse it.
