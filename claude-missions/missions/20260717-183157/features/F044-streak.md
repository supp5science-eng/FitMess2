# F044: Streak — weeks in deficit

**Milestone:** M5 — Weekly Dashboard, Weight & Streak
**Estimated worker time:** 30 minutes
**Depends on:** F040

## Assertion IDs covered
- AS-076 (consecutive completed weeks ≤ budget+5%), AS-077 (current week excluded)

## Draft scope
- Streak computation over completed weeks (pure + tests)
- Display "X nedelja u deficitu" on weekly screen; zero-state copy encouraging, not punitive

## Files (approximate)
src/lib/budget/streak.ts (+ tests), weekly screen component

## Notes for clarification
- MCP at run: none


---

## Clarified implementation (from clarifications/F044-clarification.md)

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
