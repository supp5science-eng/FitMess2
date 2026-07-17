# F014: Budget engine (Mifflin-St Jeor, caps, macros)

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 45 minutes
**Depends on:** F003

## Assertion IDs covered
- AS-021, AS-022, AS-023, AS-024, AS-025, AS-026 (BMR/TDEE/caps/macros/weekly), AS-030 (unsafe goal auto-adjust)

## Draft scope
- Pure TS functions: bmr, tdee, dailyTarget (25% deficit cap + 1400/1200 kcal floors), macroTargets, weeklyBudget
- Unit tests against published Mifflin-St Jeor reference values
- Goal-adjustment returns adjusted values + reason codes for UI messaging

## Files (approximate)
src/lib/budget/engine.ts, src/lib/budget/engine.test.ts

## Notes for clarification
- Activity multipliers table (5 tiers, ~1.2 to 1.9) to confirm
- MCP at run: none


---

## Clarified implementation (from clarifications/F014-clarification.md)

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
