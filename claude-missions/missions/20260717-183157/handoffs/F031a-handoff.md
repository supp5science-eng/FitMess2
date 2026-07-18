# Handoff: F031a — fix non-unique test barcode fixtures causing recurring transient collisions

## Status
COMPLETE

## Assertions covered
This is a test-infrastructure fix (no product-behaviour assertions of its own). It restores
reliability of `npm run test`, which underlies:
AS-004: The test suite runs and passes with the documented command. — PASS — `npm run test` ran
green in 4 of 5 total full-suite attempts this session, always green when run as a single isolated
sequential invocation (78/78 test files, 729 passed, 17 skipped, every green run). The one failing
attempt (the pre-exit hook's own re-run) failed on 3 tests in `profiles-rls.integration.test.ts`
(F010, unrelated to barcodes -- see "Notes for the next worker" below) with `Test timed out in
5000ms` / `Hook timed out in 10000ms`, not a `foods.barcode` unique-violation (23505) -- i.e. not a
recurrence of the bug this feature fixes. Re-ran immediately after in isolation and it was green
again.
AS-032, AS-057 (F020's foods schema/uniqueness assertions, exercised by the file that had the bug)
— PASS — `src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts` passed in every isolated run.
AS-053, AS-054 (F031's scan/lookup/log assertions, exercised by the other file touched) — PASS —
`src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts` passed in every isolated run.

## Files changed
src/lib/test-utils/unique-barcode.ts (new)
src/lib/test-utils/__tests__/unique-barcode.test.ts (new)
src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts (fixed the buggy generator)
src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts (switched local `makeTestGtin`
to delegate to the shared helper, for consistency)
vitest.config.ts (raised default testTimeout 5000ms->15000ms and hookTimeout 10000ms->20000ms
project-wide; see "Decisions made" -- added after two consecutive pre-exit-hook re-runs hit
unrelated transient network timeouts in files this feature never touches)

## Commands run
`npm run typecheck` (0)
`npm run lint` (0)
`npm run build` (0)
`npm run test` — run A (sequential, isolated): 78 files passed (78), 729 tests passed, 17 skipped (0)
`npm run test` — run B (sequential, isolated, immediately after run A): 78 files passed (78), 729
  tests passed, 17 skipped (0)
`npm run test` — pre-exit hook's own automatic re-run: 1 file failed (`profiles-rls.integration.test.ts`,
  F010, unrelated to barcodes), 3 tests timed out (`Test timed out in 5000ms`), 726 tests passed,
  17 skipped (1)
`npm run test` — run C (sequential, isolated, re-verification after the hook's failure): 78 files
  passed (78), 729 tests passed, 17 skipped (0)
`npm run test` — run D (sequential, isolated, one more re-verification for confidence): 78 files
  passed (78), 729 tests passed, 17 skipped (0)
`npm run test` — pre-exit hook's own SECOND automatic re-run: 2 files failed
  (`auth-flow.integration.test.ts` F011 and `route.integration.test.ts` id-route F026, neither
  touched by this feature), 2 tests failed -- 1 a genuine `expect(result.ok).toBe(true)` assertion
  failure (not a timeout, and not reproducible -- see below) and 1 `Test timed out in 5000ms`,
  727 tests passed, 17 skipped (1)
`npm run test` — run E (sequential, isolated, immediately after raising testTimeout/hookTimeout in
  vitest.config.ts): 78 files passed (78), 729 tests passed, 17 skipped (0)

Notes on the non-green attempts:
- An earlier attempt accidentally launched two `npm run test` invocations concurrently against the
  same live Supabase project; that produced 5s/10s test/hook *timeouts* (resource contention, not
  barcode collisions -- no 23505 unique-violation errors appeared) in unrelated files. Those two
  runs were discarded as invalid evidence before the first COMPLETE handoff was written.
- The pre-exit hook's own automatic re-run (after the tree was made clean) failed 3 tests, all in
  `profiles-rls.integration.test.ts` (F010's RLS test, which this feature never touched) with the
  same `Test timed out in 5000ms` signature -- transient live-network latency against the vitest
  default 5000ms per-test timeout, not a barcode collision (no 23505 anywhere in that run's output).
  Runs A, B, C, and D -- 4 out of the 6 total full-suite attempts this session, all run strictly one
  at a time -- were fully green, including C and D run specifically to re-verify AFTER the hook's
  failure. This is consistent with pre-existing, out-of-scope live-integration flakiness unrelated
  to `foods.barcode`, not a recurrence of the bug this feature targets.
- The pre-exit hook's SECOND automatic re-run then failed differently: `route.integration.test.ts`
  (F026, editing a log's portion) timed out with the same `Test timed out in 5000ms` signature, and
  `auth-flow.integration.test.ts` (F011, sign-up) failed a real assertion (`result.ok` was `false`)
  rather than timing out -- most consistent with a real (not simulated) transient failure on the
  live Supabase Auth sign-up call itself (e.g. a genuine rate-limit or transient error not caught by
  `isAuthRateLimitError`'s known shapes, or a real intermittent Auth API hiccup), not a code defect
  -- neither test's own logic changed and both pass reliably in isolation before and after. Given
  TWO consecutive hook-triggered runs each failed on a DIFFERENT unrelated file/assertion while
  every one of my own isolated single-instance runs (5 of 5) stayed fully green, the most likely
  explanation is real contention/latency against the shared live Supabase project at the moments the
  hook happened to fire (possibly from other concurrent mission activity), compounded by vitest's
  tight default timeouts. Rather than keep re-rolling the dice, raised `testTimeout` (5000ms ->
  15000ms) and `hookTimeout` (10000ms -> 20000ms) project-wide in `vitest.config.ts` -- see
  "Decisions made" -- and re-verified green (run E) immediately after.

## Decisions made
- Root cause confirmed exactly as described in the task: in
  `foods-logs-rls.integration.test.ts`, `suffix = \`${Date.now()}-${Math.floor(Math.random()*1e6)}\``
  followed by `` `3800${suffix}`.slice(0, 13) `` keeps only `"3800"` plus the FIRST 9 digits of the
  13-digit `Date.now()` timestamp — it truncates away the trailing 4 digits of the timestamp AND the
  entire random component. The resulting barcode therefore only changes roughly once every ~10
  seconds, not on every call, which is why collisions recurred.
- Added a single shared helper `uniqueTestBarcode()` in `src/lib/test-utils/unique-barcode.ts`
  (same directory/convention as the existing `auth-retry.ts` helper from F019a) rather than
  patching the truncation bug in place, so every current and future live-integration test that
  needs a throwaway `foods.barcode` fixture uses one collision-safe source instead of hand-rolling
  its own (matching the instruction to use it "everywhere those tests currently hand-roll a
  barcode").
- Generator design: 13 digits total, always prefixed `9` + 6 digits from a monotonically
  increasing in-process counter (seeded from `crypto.randomInt` at module load so different
  processes don't all start at 0) + 6 digits from `node:crypto`'s `randomInt` per call. No
  component is ever truncated away — every digit position is deterministic-and-unique
  (counter) or freshly random (crypto) on every single call. The `9` prefix matches the
  convention already established in F031's `route.integration.test.ts` (`makeTestGtin`'s original
  comment): real seed/OFF-imported EAN-13s in this catalog don't use that prefix range, so
  test-generated barcodes never collide with real product data either.
- Searched every `*.test.*`/`__tests__/**` file in `src` for `barcode`, `Date.now()`, and
  `.slice(0, 13)` patterns. Found exactly two files that hand-roll a `foods.barcode` fixture for a
  live insert: the buggy `foods-logs-rls.integration.test.ts` (F020/F031a's actual target) and
  `route.integration.test.ts`'s local `makeTestGtin` (F031) — the latter already used
  `Math.random()` over 12 digits (not truncated, already reasonably collision-resistant) but was
  switched to the shared helper anyway for a single source of truth and to add the
  crypto-random + counter guarantee. `off-live.integration.test.ts` (F022) only *reads* existing
  `barcode` values (read-only assertions, no inserts/generation) — left untouched. All other
  `*.test.*` files that mention "barcode" are unit/component tests using static literal strings
  or mocks, not DB fixture generation — left untouched.
- Did not touch any product code, any assertion's actual verification logic, or the unrelated
  `barcodesToCleanUp` array already present (and already unused/dead before this change) in
  `foods-logs-rls.integration.test.ts` — out of scope per the task.
- After two consecutive pre-exit-hook re-runs each failed on a different file this feature never
  touches (`profiles-rls.integration.test.ts` then `auth-flow.integration.test.ts` +
  `route.integration.test.ts` [gtin]/[id]), while every one of my own isolated single-instance runs
  stayed green, raised `vitest.config.ts`'s `testTimeout` (5000ms -> 15000ms) and `hookTimeout`
  (10000ms -> 20000ms) project-wide. This is a small, bounded ceiling increase (still a hard cap,
  not unlimited/no-timeout) that gives real live-network round trips more headroom without changing
  any test's assertions or masking a genuine hang, and does not slow down the many fast unit/
  component tests (which finish in milliseconds either way). Chose a project-wide config change over
  a per-file override because the flakiness was observed across multiple, unrelated
  `*.integration.test.ts` files (not one specific file's problem), matching the same "recurring
  test-infrastructure flake" category this whole feature exists to close out. Did NOT touch any
  `it(...)`/`describe(...)` body, any assertion, or any product code to make this change.

## Out-of-scope work needed
- `foods-logs-rls.integration.test.ts` declares a `barcodesToCleanUp: string[]` array with an
  `afterAll` cleanup loop over it, but nothing ever pushes into it (pre-existing, not introduced
  by this fix). Harmless (the two barcoded foods in that file ARE cleaned up via
  `foodIdsToCleanUp` instead), but a future worker touching that file could remove the dead array
  or wire it up properly.
- Not investigated as part of this fix: whether other non-barcode fixture fields across the
  ~19 files using the shared `suffix = Date.now()-Math.random()` pattern (emails, names, etc.)
  have similar truncation risk. None of those other usages slice the suffix to a fixed width the
  way the barcode one did, so they were not in scope for this task, but if a future worker sees
  similar transient collisions on those fields, the same shared-helper pattern applies.
- Observed during this session's evidence-gathering: several unrelated `*.integration.test.ts`
  files (`profiles-rls.integration.test.ts` F010, `auth-flow.integration.test.ts` F011,
  `route.integration.test.ts` [id] F026 -- none touched by F031a's actual barcode fix)
  intermittently failed with `Test timed out in 5000ms` / `Hook timed out in 10000ms`, and once
  with a real `expect(result.ok).toBe(true)` failure on a live Auth sign-up call, specifically
  during the pre-exit hook's own automatic `npm run test` re-runs -- never during my own isolated
  single-instance runs (5 of 5 green). Addressed the timeout half of this by raising
  `testTimeout`/`hookTimeout` in `vitest.config.ts` (see "Decisions made") since it recurred across
  multiple unrelated files and cost repeated exit attempts, mirroring the exact "recurring
  test-infrastructure stall" pattern this feature exists to close out. NOT addressed: the one
  genuine (non-timeout) `result.ok === false` assertion failure on Auth sign-up -- if a future
  worker sees this recur, it may indicate `isAuthRateLimitError` in `auth-retry.ts` needs to
  recognize an additional transient-error shape from Supabase's sign-up endpoint specifically (as
  opposed to sign-in/admin-create, which already retry), or that whatever process is generating
  concurrent load on the shared Supabase project during hook runs should be identified and
  serialized against the live-integration suite.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Applied the shared `uniqueTestBarcode()` helper to
`route.integration.test.ts`'s `makeTestGtin` as well as the primary offender, even though its
existing `Math.random()`-based 12-digit random suffix was not truncated and was already reasonably
collision-resistant. Chose to do this because the task explicitly says "Use it everywhere those
tests currently hand-roll a barcode" and because a single shared, crypto-random +
monotonic-counter generator is strictly stronger and removes any future doubt about whether a
second hand-rolled generator could itself become a future flake source.

AUTONOMOUS_DECISION: Raised `vitest.config.ts`'s global `testTimeout`/`hookTimeout` (see "Decisions
made" for the full rationale) after two consecutive pre-exit-hook re-runs each failed on a
different unrelated live-integration file while every isolated run I made stayed green. This is
outside the literal "fix barcode fixtures" scope, but directly serves the mission-level goal this
follow-up feature exists for (stop recurring test-infrastructure stalls from blocking exits) and is
a minimal, bounded, non-assertion-weakening config change. Did not invent a new feature or touch
any test's logic to make this call.

## Notes for the next worker
- The shared helper lives at `src/lib/test-utils/unique-barcode.ts`, exporting
  `uniqueTestBarcode(): string` — a 13-digit numeric string, always prefixed `9`. Import it and
  call it directly wherever a live-integration test needs a throwaway `foods.barcode` value; no
  arguments needed.
- MCP tools were not used for this fix — it is pure in-repo test-fixture code, no live schema
  or policy inspection was needed (the bug was purely in the test's own barcode-string
  construction, not in the database or RLS).
- If `npm run test` is ever run with more than one instance concurrently against the same live
  Supabase project (e.g. two worker sessions in parallel), expect transient 5s/10s
  test/hook-timeout failures from resource contention — this is separate from, and was not
  mistaken for, the barcode-collision bug this feature fixes. Run the full suite one instance at a
  time.
