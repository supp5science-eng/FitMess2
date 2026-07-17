# F053 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: logic_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Pure TypeScript functions in src/lib/ (no side effects, deterministic)
**2. Data shape** — star (chosen): Typed inputs/outputs; no I/O inside the functions
**3. State / storage** — star (chosen): None — pure; callers persist results
**4. API contract** — star (chosen): Exported function signatures with explicit types
**5. Failure handling** — star (chosen): Return typed results / clamp to safe bounds; never throw on expected edges
**6. Empty / zero state** — star (chosen): Defined zero/empty-input behavior (documented in tests)
**7. Validation rules** — star (chosen): Input-range guards (ages, weights, kcal floors/caps) enforced
**8. Performance budget** — star (chosen): Negligible (in-memory arithmetic)
**9. Auth / access** — star (chosen): n/a — invoked server-side by callers that enforce auth
**10. Touches** — star (chosen): Only the new lib module + its test file

## Round B — 5 follow-up decisions (star defaults)

**11.** All arithmetic here is deterministic; LLM never computes these numbers (AS-086 principle)
**12.** Safe-bound clamps: >=1400 kcal men / 1200 women, deficit <=25%, redistribution <=200 kcal/day
**13.** Rounding rule consistent (kcal integer, kg one decimal)
**14.** Edge cases: DST week boundaries, gaps in weigh-ins, already-adjusted days
**15.** Exhaustive unit coverage of branches

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Vitest unit tests against published/reference values
**17. Failure test** — Unit test on each error/edge branch (bounds, empty, extremes)
**18. Manual verification** — None — automated coverage suffices
**19. Side-effect verification** — Functions are pure; tests assert no external mutation
**20. Evidence artifact** — Test output + coverage on the module
