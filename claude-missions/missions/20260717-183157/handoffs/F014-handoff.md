# Handoff: F014 — Budget engine (Mifflin-St Jeor, caps, macros)

## Status
COMPLETE

## Assertions covered
AS-021: PASS — `bmr()` implements Mifflin-St Jeor exactly; unit tests compare against hand-computed reference values (see "Reference values" below), plus a boundary/purity check.
AS-022: PASS — `tdee()` multiplies BMR by the activity multiplier; all 5 tiers (`sedentary` 1.2, `light` 1.375, `moderate` 1.55, `active` 1.725, `very_active` 1.9) individually asserted against a fixed BMR=1500, plus a monotonic-increase check across all tiers.
AS-023: PASS — `dailyTarget()` never returns below `KCAL_FLOOR.male` (1400) / `KCAL_FLOOR.female` (1200); tested with a TDEE far below the floor, exactly at the floor boundary, and comfortably above it.
AS-024: PASS — `dailyTarget()` clamps `desiredDeficitPct` to `MAX_DEFICIT_PCT` (0.25); tested a 50% request, the exact 25% boundary, just-over-25%, and a negative (surplus) request clamping to 0.
AS-025: PASS — `macroTargets()` returns protein at 2.0 g/kg (inside the clarified 1.8–2.2 g/kg range), fat ≥0.6 g/kg (`FAT_G_PER_KG_MIN`), and carbs as the exact kcal remainder; tight-deficit branch pulls fat toward its floor and flags `clamped: true`; an even-tighter case (protein alone plus floor-fat exceeds dailyKcal) shows fat holding its floor while carbs pin at 0.
AS-026: PASS — `weeklyBudget()` = `dailyKcal * 7`; tested with typical values, a fractional daily value (rounds first), and zero/negative clamping to 0.
AS-030: PASS — `planGoalAdjustment()` derives the implied daily deficit from `target weight + timeframe` (via `KCAL_PER_KG_BODY_MASS`), clamps it to the 25% cap and the sex floor, and returns `{ adjusted, reasonCodes }` with `"deficit_capped_25_percent"` / `"floor_kcal_applied"` string-enum codes (Serbian copy intentionally left to the UI layer per the clarified spec); tested a within-bounds goal (not adjusted), a goal exceeding only the 25% cap, a goal hitting both caps, maintenance/gain goals (no deficit implied), and a zero/negative timeframe edge case that doesn't throw.

## Files changed
src/lib/budget/engine.ts
src/lib/budget/engine.test.ts

## Commands run
`npm run test -- src/lib/budget/engine.test.ts` (0) — 48/48 passed
`npm run test` (0) — full suite: 17 files, 164 passed | 5 skipped (pre-existing skips unrelated to this feature)
`npm run lint` (0) — zero errors
`npm run typecheck` (0) — zero errors
`npm run build` (0) — Next.js production build succeeded (pre-existing "middleware deprecated" warning is unrelated, from an earlier feature)

## Decisions made
- Reused the existing `Sex` / `ActivityLevel` types from `src/lib/types/db.ts` (defined in F010's profiles schema) instead of redefining them, per the clarified spec's instruction that activity-level tier names must match the profiles schema enum. Re-exported them from `engine.ts` for ergonomic imports by later features.
- No MCP/DB access needed or used — this is a pure-logic feature per the spec ("MCP at run: none").
- Kept `bmr`/`tdee`/`dailyTarget`/`macroTargets`/`weeklyBudget` matching the exact function names/signatures given in the draft scope; added one extra function, `planGoalAdjustment`, to satisfy AS-030's requirement for a goal-adjustment function (not explicitly named in the draft scope, but described in prose there).

## Out-of-scope work needed
- F016 (onboarding summary/UI) will need to add the Serbian explanation copy keyed off `GoalAdjustReasonCode` values (`"deficit_capped_25_percent"`, `"floor_kcal_applied"`) — the clarification explicitly assigns that copy to the UI layer, not this module.
- No other gaps noticed; `src/lib/budget/` is otherwise empty pending F040 (weekly), F045 (auto-recalc), F053 (redistribution) per the file-layout note in tech-decisions.md — those are separate features, not touched here.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: `dailyTarget(tdeeKcal, sex, desiredDeficitPct?)` takes an optional third parameter (`desiredDeficitPct`, default `DEFAULT_DEFICIT_PCT = 0.2`) even though the draft scope's function header only lists `(tdee, sex)`. A fat-loss deficit magnitude has to come from somewhere, and the draft's own prose ("apply a fat-loss deficit, but CAP it") implies a deficit input exists; making it an optional parameter keeps the two-arg call site simple (uses a sensible 20% default, safely under the 25% cap) while still letting `planGoalAdjustment` (or any future caller) pass an explicit deficit derived from a real goal.
AUTONOMOUS_DECISION: Chose `PROTEIN_G_PER_KG = 2.0` (midpoint of clarified 1.8–2.2 g/kg) and `FAT_G_PER_KG_DEFAULT = 0.8` g/kg (comfortably above the 0.6 g/kg floor) as the default macro targets, since the clarified spec says "pick a default within range" for protein and only specifies a floor (not a default) for fat.
AUTONOMOUS_DECISION: In the tight-deficit macro clamp, when protein + default fat exceed `dailyKcal`, fat is pulled down toward its budget-derived value but never below its `FAT_G_PER_KG_MIN` (0.6 g/kg) floor — even if that means protein + fat still exceed `dailyKcal` and carbs clamp to 0. Chose to protect the fat floor (a physiological minimum) over exactly hitting the kcal number, and to leave protein untouched (the clarified spec only mentions clamping "sensibly" without specifying which macro yields first — protein was judged the least safe one to cut for a fat-loss product).
AUTONOMOUS_DECISION: Physiologically-plausible input clamp ranges (`MIN_WEIGHT_KG`/`MAX_WEIGHT_KG` 30–300, `MIN_HEIGHT_CM`/`MAX_HEIGHT_CM` 100–250, `MIN_AGE_YEARS`/`MAX_AGE_YEARS` 13–100) were chosen defensively to satisfy "Input-range guards ... enforced" + "never throw on expected edges" together — out-of-range/zero/negative inputs clamp into these bounds rather than throwing or producing NaN/negative output. Documented and unit-tested at both the zero/negative and extreme-high ends, plus the exact boundary values.
AUTONOMOUS_DECISION: `KCAL_PER_KG_BODY_MASS = 7700` used only inside `planGoalAdjustment` to translate a target-weight delta into an implied daily deficit — the standard clinical rule-of-thumb energy density (~3500 kcal/lb), used purely for goal-pacing estimation, not asserted directly by any AS-ID but necessary plumbing for AS-030.
AUTONOMOUS_DECISION: An unrecognized `ActivityLevel` at runtime (e.g. stale/bad DB data outside the TS union) falls back to the `sedentary` (lowest) multiplier in `tdee()`, and a missing/invalid `Sex` falls back to the higher, safer `male` floor (1400) in `dailyTarget`/`planGoalAdjustment` — chosen as the more conservative (safer, not artificially inflated) default in each case.

## Notes for the next worker
- `src/lib/budget/engine.ts` exports `bmr`, `tdee`, `dailyTarget`, `macroTargets` (returns `{ proteinG, fatG, carbsG, clamped }`), `weeklyBudget`, and `planGoalAdjustment` (returns `{ dailyKcal, weeklyKcal, impliedDeficitPct, appliedDeficitPct, adjusted, reasonCodes }`), plus the constants (`ACTIVITY_MULTIPLIERS`, `KCAL_FLOOR`, `MAX_DEFICIT_PCT`, `DEFAULT_DEFICIT_PCT`, `PROTEIN_G_PER_KG`, `FAT_G_PER_KG_DEFAULT`, `FAT_G_PER_KG_MIN`, `KCAL_PER_KG_BODY_MASS`, and the `MIN_*`/`MAX_*` input-clamp bounds) that F015/F016/F040/F045/F053 will likely want to reuse rather than re-derive.
- All rounding follows the clarified convention: kcal values are whole numbers (`Math.round`), kg/gram macro values keep one decimal place.
- No MCP tools were used — this feature is pure TypeScript with zero external state, per the spec ("MCP at run: none").
- Everything in this module is a pure function with no I/O; F015 (onboarding wizard) and F016 (editable summary) are expected to call these functions and persist the results into `public.targets` (see `supabase/migrations/0001_profiles.sql`) themselves — this feature does not touch the database.
