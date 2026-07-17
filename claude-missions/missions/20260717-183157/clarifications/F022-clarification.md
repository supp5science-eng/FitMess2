# F022 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: datascript_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Standalone Node/tsx script under scripts/, run once by the orchestrator/worker
**2. Data shape** — star (chosen): foods rows (per-100g macros, common_units, source, verified, barcode)
**3. State / storage** — star (chosen): Postgres (Supabase) via secret key
**4. API contract** — star (chosen): n/a
**5. Failure handling** — star (chosen): Idempotent upsert; skip malformed rows and log them; safe to re-run
**6. Empty / zero state** — star (chosen): n/a
**7. Validation rules** — star (chosen): Only rows with complete macros (kcal+protein+carbs+fat) + a name are inserted
**8. Performance budget** — star (chosen): Batched inserts; whole run completes in minutes
**9. Auth / access** — star (chosen): Server-side secret key; not user-facing
**10. Touches** — star (chosen): foods table only

## Round B — 5 follow-up decisions (star defaults)

**11.** Upsert key: barcode when present, else name+brand
**12.** Seed rows source=seed verified=true; OFF rows source=off verified=false
**13.** OFF import volume capped (~2000) and Serbian-market filtered
**14.** Common units (parce, kasika, solja, komad) with gram weights where natural
**15.** Re-run does not duplicate rows

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Script run + assertion on inserted row count (>=300 for seed)
**17. Failure test** — Malformed-row input is skipped, not inserted (test)
**18. Manual verification** — Spot-check that sarma, gibanica, pasulj are findable
**19. Side-effect verification** — Only the foods table is written
**20. Evidence artifact** — Script log + final row count
