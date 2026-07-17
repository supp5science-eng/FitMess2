# F053: Deterministic redistribution engine

**Milestone:** M6 — Agent
**Estimated worker time:** 45 minutes
**Depends on:** F040

## Assertion IDs covered
- AS-086 (deterministic, unit-tested, LLM never does arithmetic), AS-087 (max 200 kcal/day reduction), AS-088 (spread over next 2–3 days), AS-089 (timeline extension when beyond capacity)

## Draft scope
- Pure function redistribute(overshootKcal, upcomingDays, existingAdjustments) → list of {date, adjustment_kcal} or {timelineExtension}
- Caps: never cut more than 200 kcal from a future day; prefer even spread across 2–3 days
- Exhaustive unit tests (small overshoot, huge overshoot, already-adjusted days, week boundary)

## Files (approximate)
src/lib/budget/redistribute.ts, src/lib/budget/redistribute.test.ts

## Notes for clarification
- MCP at run: none


---

## Clarified implementation (from clarifications/F053-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: logic._

- Pattern: Pure TypeScript functions in src/lib/ (no side effects, deterministic)
- Data shape: Typed inputs/outputs; no I/O inside the functions
- State location: None — pure; callers persist results
- API contract: Exported function signatures with explicit types
- Failure handling: Return typed results / clamp to safe bounds; never throw on expected edges
- Empty state: Defined zero/empty-input behavior (documented in tests)
- Validation: Input-range guards (ages, weights, kcal floors/caps) enforced
- Performance budget: Negligible (in-memory arithmetic)
- Access control: n/a — invoked server-side by callers that enforce auth
- Touches: Only the new lib module + its test file

### Follow-up decisions
- All arithmetic here is deterministic; LLM never computes these numbers (AS-086 principle)
- Safe-bound clamps: >=1400 kcal men / 1200 women, deficit <=25%, redistribution <=200 kcal/day
- Rounding rule consistent (kcal integer, kg one decimal)
- Edge cases: DST week boundaries, gaps in weigh-ins, already-adjusted days
- Exhaustive unit coverage of branches

## Definition of done

- **Primary success test:** Vitest unit tests against published/reference values
- **Failure test:** Unit test on each error/edge branch (bounds, empty, extremes)
- **Manual verification:** None — automated coverage suffices
- **Side-effect verification:** Functions are pure; tests assert no external mutation
- **Evidence artifact:** Test output + coverage on the module

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
