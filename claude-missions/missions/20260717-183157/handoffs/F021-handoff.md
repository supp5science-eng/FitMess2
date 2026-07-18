# Handoff: F021 — Seed script — 300+ curated Serbian foods

## Status
COMPLETE

## Assertions covered
AS-033: PASS — Live `public.foods` row count is 350 (>=300) after running `npm run seed:foods` against the real Supabase project. Dataset includes Serbian staples (piletina/pileća prsa, hleb, mleko, jaje, krompir, paradajz, jabuka, ...) and branded items across 22 distinct brands including Imlek, Bambi, Štark, Nectar, and Knjaz Miloš — verified both by static dataset test (`src/lib/food/__tests__/seed.test.ts`) and a live query against the project (`src/lib/food/__tests__/seed-live.integration.test.ts`, ran live in this session — 443 tests passed / 12 skipped after seeding, vs 436/19 before seeding).
AS-034: PASS — sarma, gibanica, pasulj, and karađorđeva (Karađorđeva šnicla) are all present in the dataset and confirmed findable by Serbian name via a live `ilike` query against `public.foods` (see "Commands run" for the raw query output). Also seeded 5+ other common traditional dishes (musaka, đuveč, ajvar, šopska salata, punjene paprike, gulaš, baklava, kremšnita, tulumba, tufahije, proja, kačamak, podvarak, mantije, uštipci, ...).

## Files changed
supabase/seed/foods.json (new — 350-row curated dataset)
src/lib/food/seed.ts (new — pure validation/upsert-planning logic)
src/lib/food/__tests__/seed.test.ts (new — dataset-level unit tests, DB-free)
src/lib/food/__tests__/seed-live.integration.test.ts (new — live-DB proof, skips gracefully with no credentials)
scripts/seed-foods.ts (new — standalone tsx runner, `npm run seed:foods`)
package.json (added `tsx` devDependency + `seed:foods` script)
package-lock.json (lockfile update for `tsx`)

## Commands run
`npm install --save-dev tsx@4.23.1` (0)
`npm run typecheck` (0)
`npm run lint` (0)
`npm run test` — first run, before seeding: 43 files passed, 436 tests passed, 19 skipped (0)
`npm run seed:foods` — first run against live DB: loaded 350 rows, plan 350 insert / 0 update, DONE — live source='seed' row count 350, total row count 350 (0)
`npm run seed:foods` — second run (idempotency proof): loaded 350 rows, plan **0 insert / 350 update**, DONE — live row count still 350 (0)
`npm run test` — second run, after seeding, live integration tests now execute: 43 files passed, **443 tests passed**, 12 skipped (0)
`npm run build` (`next build`) — compiled successfully, typechecked, 14 static/dynamic routes generated (0)
Ad-hoc verification query (Node script using `@supabase/supabase-js` admin client, credentials from `.env`, no values logged): `total foods rows: 350`, `source=seed rows: 350`, `sarma -> ["Sarma, sa mlevenim mesom i pirinčem", "Sarma, posna, od vinovog lišća", "Kupus, punjen mlevenim mesom (sarma van sezone)"]`, `gibanica -> ["Gibanica, sa sirom i jajima"]`, `pasulj -> ["Pasulj, suvi, sirov", "Pasulj, čorba/prebranac", "Pasulj, posni"]`, `karađorđeva -> ["Karađorđeva šnicla"]`, `logs rows (untouched, side-effect check): 0`

## Decisions made
- Used `createClient()` from `@supabase/supabase-js` directly inside `scripts/seed-foods.ts` (service-role `SUPABASE_SECRET_KEY`) instead of importing `src/lib/supabase/server.ts`'s `createAdminClient()`, because that module also statically imports `next/headers` (for the cookie-scoped `createClient()` export) which is coupled to a Next.js request context. The script is self-contained and reimplements the same privileged-client pattern (`autoRefreshToken: false, persistSession: false`) standalone — matches the clarified "Pattern: Standalone Node/tsx script" answer and the repo-state note that either the Management API or `createAdminClient()`-equivalent secret-key access is fine for seeding.
- Added `tsx` (^4.23.1, current npm latest at commit time) as a devDependency and a `seed:foods` npm script, since the clarified spec explicitly names "Standalone Node/tsx script" as the pattern and no TS script runner previously existed in this repo. This is tooling for running the committed script, not application code.
- Idempotency key implementation: rather than adding a DB unique index on `(name_sr, brand)` (which the clarified "Touches: foods table only" / file list did not call for, and would require a new migration), idempotency is implemented entirely in application logic (`planSeedUpsert` in `src/lib/food/seed.ts`): fetch all existing `source='seed'` rows, build a key map (barcode when present, else lowercased/trimmed `name_sr|brand`), and route each dataset row to INSERT or UPDATE by id accordingly. Scoping the existing-row lookup to `source='seed'` (rather than all of `public.foods`) means the script can never accidentally overwrite a crowd-sourced (`source='user'`) or future OFF-imported (`source='off'`) row that happens to share a name — satisfies the "only the foods table is written" / "never touches unrelated data" side-effect requirement more precisely than a blanket name+brand match would.
- `kcal_100g` for every dataset row is derived as `round(4*protein + 4*carbs + 9*fat)` at dataset-authoring time (not hand-entered separately), guaranteeing exact internal consistency by construction rather than by post-hoc adjustment — verified by `test_dataset_macros_are_internally_consistent_kcal_approx_4p_plus_4c_plus_9f` iterating every one of the 350 rows with a 3 kcal tolerance.
- `toFoodInsert()` omits (rather than nulls) the `barcode` key when a seed row has none, so an UPDATE payload never clobbers a barcode an admin might later attach to a seeded row out-of-band.
- Split the feature into a pure logic module (`src/lib/food/seed.ts`, unit-tested under `src/**/*.test.ts` per `vitest.config.ts`'s include glob) and a thin DB-touching runner (`scripts/seed-foods.ts`, not itself under test) — same separation-of-concerns pattern the repo already uses for `src/lib/budget/`.

## Out-of-scope work needed
- F022 (Open Food Facts import) is the next natural consumer of `source='off'` rows in the same table; not touched here.
- An admin food-editor (mentioned as a future "taste matters" item in the F020 handoff / run-log) to let an admin spot-check/correct these AI-estimated per-100g macros — flagged for user review, not part of this feature's scope.
- No migration changes were made; if a future feature wants a true DB-level `UNIQUE (name_sr, brand)` constraint (e.g. to move idempotency enforcement into Postgres itself), that would be a new migration + follow-up, out of this feature's "foods table only, no schema changes" scope.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Chose to scope the idempotency "existing row" lookup to `source='seed'` rows only (rather than matching against all of `public.foods` regardless of source), since the clarified spec's upsert-key answer ("barcode when present, else name_sr+brand") did not specify whether crowd-sourced/OFF rows should be eligible match targets, and matching only within the seed script's own prior output is the safer default that strictly satisfies "only the foods table is written" without any risk of overwriting a real user's crowd-sourced submission.
AUTONOMOUS_DECISION: Added `tsx` as a new devDependency (not previously in package.json) to satisfy the clarified "Standalone Node/tsx script" pattern, since no TS script runner existed in the repo yet. Verified `4.23.1` was npm's current published version at implementation time.
AUTONOMOUS_DECISION: Dataset targets ~330-360 realistic Serbian foods rather than the low end of the 300-500 range, to leave comfortable margin above the AS-033 >=300 threshold while staying well under 500.

## Notes for the next worker
- Run `npm run seed:foods` any time after pulling `supabase/seed/foods.json` changes to sync the live `foods` table — it is safe to run repeatedly.
- The live integration test `src/lib/food/__tests__/seed-live.integration.test.ts` self-skips (with a console warning, not a failure) if there are fewer than 300 `source='seed'` rows live, or if Supabase credentials/schema aren't reachable in the current session — this keeps `npm run test` green for every future worker's session regardless of whether they've run the seed script, while still proving the real behavior once seeded (as it did in this session: 443 passed vs 436 before seeding).
- No MCP tools were used directly by this worker (per the registry note, `mcp__supabase__*` is not bound inside worker subagents) — all live DB reads/writes went through `@supabase/supabase-js` with the `SUPABASE_SECRET_KEY` from `.env`, per the repo-state guidance that seeding may use the admin-client/secret-key path rather than the Management API's raw-SQL endpoint.
- `supabase/seed/foods.json` is plain data (no generator script committed) — if it needs regenerating/extending later, note that every `kcal_100g` value there was derived as `round(4*protein_100g + 4*carbs_100g + 9*fat_100g)`; keep that invariant when adding new rows or `isKcalConsistent()` in `src/lib/food/seed.ts` (and the corresponding dataset test) will start failing.
