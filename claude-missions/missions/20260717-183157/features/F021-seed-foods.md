# F021: Seed script — 300+ curated Serbian foods

**Milestone:** M3 — Food DB & Manual Logging
**Estimated worker time:** 45 minutes
**Depends on:** F020

## Assertion IDs covered
- AS-033 (≥300 foods incl. staples + branded), AS-034 (sarma, gibanica, pasulj findable)

## Draft scope
- Curated JSON/CSV dataset: meso, mlečni (Imlek), pekara, voće/povrće, slatkiši (Bambi, Štark), traditional cooked dishes per-100g
- Idempotent seed script (upsert by name+brand), marked source=seed, verified=true
- Common units where natural (parče, kašika, šolja, komad) with gram weights

## Files (approximate)
supabase/seed/foods.json, scripts/seed-foods.ts

## Notes for clarification
- Data quality: worker generates values from nutrition references; admin can correct later
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F021-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: datascript._

- Pattern: Standalone Node/tsx script under scripts/, run once by the orchestrator/worker
- Data shape: foods rows (per-100g macros, common_units, source, verified, barcode)
- State location: Postgres (Supabase) via secret key
- API contract: n/a
- Failure handling: Idempotent upsert; skip malformed rows and log them; safe to re-run
- Empty state: n/a
- Validation: Only rows with complete macros (kcal+protein+carbs+fat) + a name are inserted
- Performance budget: Batched inserts; whole run completes in minutes
- Access control: Server-side secret key; not user-facing
- Touches: foods table only

### Follow-up decisions
- Upsert key: barcode when present, else name+brand
- Seed rows source=seed verified=true; OFF rows source=off verified=false
- OFF import volume capped (~2000) and Serbian-market filtered
- Common units (parce, kasika, solja, komad) with gram weights where natural
- Re-run does not duplicate rows

## Definition of done

- **Primary success test:** Script run + assertion on inserted row count (>=300 for seed)
- **Failure test:** Malformed-row input is skipped, not inserted (test)
- **Manual verification:** Spot-check that sarma, gibanica, pasulj are findable
- **Side-effect verification:** Only the foods table is written
- **Evidence artifact:** Script log + final row count

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
