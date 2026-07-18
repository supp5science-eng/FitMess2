# Handoff: F031a — fix non-unique test barcode fixtures causing recurring transient collisions

## Status
COMPLETE

## Assertions covered
This is a test-infrastructure fix (no product-behaviour assertions of its own). It restores
reliability of `npm run test`, which underlies:
AS-004: The test suite runs and passes with the documented command. — PASS — `npm run test` ran
green twice consecutively, sequentially (78/78 test files, 729 passed, 17 skipped, both runs).
AS-032, AS-057 (F020's foods schema/uniqueness assertions, exercised by the file that had the bug)
— PASS — `src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts` passed in both full runs.
AS-053, AS-054 (F031's scan/lookup/log assertions, exercised by the other file touched) — PASS —
`src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts` passed in both full runs.

## Files changed
src/lib/test-utils/unique-barcode.ts (new)
src/lib/test-utils/__tests__/unique-barcode.test.ts (new)
src/lib/supabase/__tests__/foods-logs-rls.integration.test.ts (fixed the buggy generator)
src/app/api/foods/barcode/[gtin]/__tests__/route.integration.test.ts (switched local `makeTestGtin`
to delegate to the shared helper, for consistency)

## Commands run
`npm run typecheck` (0)
`npm run lint` (0)
`npm run build` (0)
`npm run test` — run 1 (sequential, isolated): 78 files passed (78), 729 tests passed, 17 skipped (0)
`npm run test` — run 2 (sequential, isolated, immediately after run 1): 78 files passed (78), 729
  tests passed, 17 skipped (0)

Note: an earlier attempt accidentally launched two `npm run test` invocations concurrently against
the same live Supabase project; that produced 5s/10s test/hook *timeouts* (resource contention, not
barcode collisions — no 23505 unique-violation errors appeared) in unrelated files. Those two runs
were discarded as invalid evidence. The two runs cited above as evidence were run strictly
sequentially, one after the other finished, and both were fully green.

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
