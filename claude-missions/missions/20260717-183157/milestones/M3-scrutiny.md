# M3 Scrutiny — Food Database and Manual Logging (F020-F028)

Adversarial milestone review. Read-only on project code. Mission 20260717-183157.
Reviewer: scrutiny-validator (Opus 4.8). Date: 2026-07-18.

## Overall verdict: PASS (with non-blocking follow-ups)

All 24 in-scope assertions are met. Every behavioural claim was independently
verified against the LIVE Supabase project (1678 foods: 350 seed + 1328 off),
not just against handoff claims or green tests. The full test suite, linter, and
type-checker all pass. No blocker-severity defects found.

The one systemic weakness worth the orchestrator attention is TEST SELF-DEFENSE
(severity major/fragile, not a blocker): the DB-touching behavioural proofs for
roughly half the milestone live in describe.skipIf(!hasCredentials or
!schemaReady) integration suites that degrade to a GREEN diagnostic when live
creds or migrations are absent. In THIS environment those suites actually ran
green (confirmed by two reviewers and by my own Management-API checks), so the
assertions hold today. In a credential-less CI run several assertions would be
backed only by static/mirror tests while the suite still reported all-green.

## Assertion results

| ID | Verdict | Reason (what the CODE does, verified) |
|------|---------|----------------------------------------|
| AS-032 | PASS | foods stores name_sr, brand, per-100g kcal/protein/carbs/fat, common_units jsonb, source enum, verified, nullable barcode; live round-trip insert/read test asserts every field. |
| AS-057 | PASS | barcode text UNIQUE (constraint foods_barcode_key). Live duplicate-barcode insert attempt rejected, 0 rows persisted; multiple NULL barcodes coexist. Integration test asserts 23505 on the 2nd insert. |
| AS-033 | PASS | Live count 1678 (at least 300); seed file 350 rows; 76 branded rows across 22 distinct brands. Unguarded dataset test asserts length at least 300. |
| AS-034 | PASS | sarma, gibanica, pasulj (and karadjordjeva) present and FINDABLE: live search_foods for each returns the dish. |
| AS-035 | PASS | hasCompleteMacros requires all 4 macros as finite non-negative numbers plus a name; every OFF row stamped source=off, verified=false. Live: 0 OFF rows with incomplete macro, 0 OFF rows verified. Zero-as-valid and string/negative rejection unit-tested. |
| AS-036 | PASS | Live search_foods(sarma), (cevapi) return the matching foods; accent and case insensitive via immutable_unaccent(lower(...)). |
| AS-037 | PASS | cyrillicToLatin (JS, pre-RPC) maps all 30 Serbian Cyrillic letters incl digraphs lj/nj/dz; verified cyr-sarma to sarma, cyr-pasulj to pasulj. Raw Cyrillic sent to the RPC without transliteration does NOT find Latin rows, so the JS translit step is load-bearing and is wired into searchFoods and the route. |
| AS-038 | PASS | Live typo tests: search_foods(srma) (missing char) and (sarmp) (wrong char) both return Sarma. pg_trgm set_limit(0.2) plus word_similarity threshold 0.45 plus prefix branch. |
| AS-039 | PASS | FoodListItem renders neprovereno badge iff not verified; tests assert BOTH directions at item and full-search-flow layers. |
| AS-040 | PASS | Client re-rank rankResultsWithRecentsFirst promotes recents to the front; order-sensitive test feeds [generic, recent] and asserts recent renders at index 0. Recents also power the empty-box quick-add list. |
| AS-041 | PASS | computeMacrosForGrams = value_100g times grams/100, rounded 1dp; tests assert concrete numbers (150g to 300kcal) that break on a wrong multiplier. Server recomputes from live per-100g and SNAPSHOTs into logs columns (verified by admin re-read). |
| AS-042 | PASS | resolveUnitGrams = unit.grams times quantity; picker resolves unit to grams before POST. Seed units include parce, kasika, casa, kasicica, kriska. Concrete-number tests at pure and UI layers. |
| AS-043 | PASS | HomeScreen folds edit/delete results into React state; ring/bars/list re-render with NO router navigation; test asserts ring 1800 to 1600 (edit) and 1700 to 1900 (delete) and router.push/refresh NOT called. |
| AS-047 | PASS | Ring shows centered remaining kcal (computeRemaining); test asserts the center value node (800 for 1200/2000). |
| AS-048 | PASS | MacroBars renders 3 bars with consumed/target g and fill ratios; over-target case tested (200/150, fill capped 100%). |
| AS-049 | PASS | MealList renders a card per todays log (name/portion/kcal) with edit/delete; integration test confirms only todays Belgrade-day rows with food joined. |
| AS-050 | PASS | Overshoot shows amount plus calm copy (Jedan dan vise ne menja nista. Nastavi sutra kao i obicno.); ring stays var(--primary) (no red), full arc, never throws. Test asserts absence of alarming vocabulary and non-destructive color. Copy judged genuinely neutral and non-shaming. |
| AS-044 | PASS | updateLogFromPortion recomputes from the food CURRENT per-100g values and updates snapshot columns; live test seeds macros=0, PATCHes 150g, asserts kcal:300/protein:15/carbs:30/fat:7.5 in response AND DB. Cross-user edit gives 404, target row unchanged. |
| AS-045 | PASS | deleteLog uses delete().eq(id).select(id); empty result reported as 404 (no silent no-op success); cross-user delete leaves row intact; deletion persistence verified. |
| AS-046 | PASS | src/lib/dates.ts uses the Intl offset-delta technique. Independently verified: 23:30Z near-midnight assigns to the correct Belgrade day across the UTC boundary; CET(+1) vs CEST(+2) both correct; spring-forward (23h) and fall-back (25h) transition days handled with hand-computed UTC oracles. |
| AS-051 | PASS | Floating plus (tap 1) opens a role=dialog sheet; each of 4 methods is a real anchor (tap 2). Unbuilt barcode/photo methods route to a real /dodaj/uskoro/[metoda] page (not a dead click or 404), asserted rendering real Serbian headings. |

Score: 24 / 24 PASS. 0 FAIL. 0 INCONCLUSIVE.

Note on AS-036/037/038: the per-feature reviewer marked these INCONCLUSIVE
because, from a read-only vantage, it could not confirm live creds were present
and the behavioural proof is skip-gated. I resolved that gap by querying the
live catalog directly (Management API) and confirming each retrieval behaviour,
so I record them as PASS with the skip-gating noted as follow-up M3-A.

## Findings by severity

### Major (met but fragile) - no blockers

- M3-A. Live integration suites degrade to green when creds or schema are
  absent. foods-logs-rls.integration, search route.integration, logs and
  logs/[id] integration, recents.integration, today.integration, seed-live,
  off-live all use describe.skipIf(!hasCredentials or !schemaReady) with a
  fallback branch whose diagnostic asserts expect(schemaReady).toBe(false),
  which PASSES on a DB-less run. Consequence: without live creds or applied
  migrations, AS-032, AS-057, AS-036/037/038, AS-040 (DB ordering), and
  AS-044/045 (server recompute plus cross-user isolation) are exercised only by
  static/mirror tests while CI stays green. In THIS review the suites ran for
  real and passed, so the assertions hold today.

- M3-B. Daily totals recalculate (AS-044/045) is only satisfied transitively.
  Totals are derived-on-read by computeDayTotals (F027). No edit/delete test
  re-runs that reducer over the mutated row set to assert the day total shifts.
  Architecturally sound (no stored total to go stale), but the recalculate
  clause is implied, not asserted at the edit/delete layer. The F027 home-screen
  test does assert the ring re-renders on edit/delete, covering the
  user-visible outcome.

### Minor

- M3-C. OFF import contains non-Serbian Cyrillic-named rows. 21 catalog rows
  have Cyrillic name_sr (Macedonian/Bulgarian product names). Stored in
  Cyrillic, so a Serbian-Cyrillic query (transliterated to Latin before the RPC)
  can never match them, and they are low-value noise in a Serbian catalog. Not
  an assertion failure (AS-035 only requires complete macros plus source=off),
  but a data-quality wart from the OFF quality filter not enforcing a
  script/locale check.

- M3-D. AS-050 neutrality is guarded by a denylist regex. The test pins the
  exact current copy AND checks for absence of specific alarming words; a future
  shaming phrase outside that word list would pass. Low risk while the exact-copy
  assertion remains.

- M3-E. AS-043 for brand-NEW logs is documented, not tested. New-log creation
  relies on router.push(/danas) plus App Router server re-fetch (no full reload)
  rather than local state; only the edit/delete no-reload path is asserted. If a
  regression turned that into a hard reload, no test in this milestone catches
  it.

- M3-F. AS-051 from the home screen not asserted at HomeScreen level. HomeScreen
  renders AddSheet but no test proves the plus is mounted on /danas; if a future
  edit dropped it, the 2-tap chain would silently break.

- M3-G. Negative-macro and enum CHECK constraints and foods UPDATE/DELETE RLS
  denial are only mirror-tested. The migration adds check(kcal_100g at least 0)
  etc and deliberately omits UPDATE/DELETE policies on foods, but no live test
  attempts a negative-macro insert or an ordinary-user update/delete of a foods
  row to prove rejection. Outside strict AS-032/AS-057 scope, but the admin-only
  mutation posture is unproven behaviourally.

## Recommended follow-up features (specs for the orchestrator)

1. Harden live-integration gating so absent creds fail, not skip. Replace the
   skipIf(!hasCredentials) green-diagnostic pattern used across the
   food/logs/search/home integration suites with a policy where a designated CI
   environment MUST have live Supabase creds plus applied migrations, and the
   suite FAILS (not skips) when they are missing there. Keep local-dev skip
   behaviour, but add an env flag (for example REQUIRE_LIVE_DB=1) honoured in CI
   so the AS-032/057/036/037/038/040/044/045 behavioural proofs are
   self-defending. Addresses M3-A.

2. Add an OFF-import locale/script guard plus one-time cleanup. Extend the OFF
   quality filter to reject entries whose name_sr is not Serbian-Latin (drop
   rows containing Cyrillic or otherwise non-sr-Latn names), and run a one-off
   cleanup of the ~21 existing Cyrillic-named catalog rows. Add a unit test
   asserting a Cyrillic-named OFF hit is skipped. Addresses M3-C.

3. Assert daily-total recalculation end-to-end after edit/delete. Add a test
   that computes computeDayTotals over the day rows before and after an edit and
   a delete, asserting the total shifts by exactly the changed entry kcal and
   macros, closing the transitive gap in AS-044/045. Optionally assert the
   new-log no-full-reload path (AS-043) and that AddSheet is mounted on /danas
   (AS-051). Addresses M3-B, M3-E, M3-F.

4. Behavioural coverage for foods CHECK constraints plus mutation RLS. Add live
   tests: a negative-macro insert is rejected (23514), an invalid source/method
   enum is rejected, and an ordinary authenticated (non-admin) client cannot
   UPDATE or DELETE a foods row. Addresses M3-G.

## Tooling output

### Lint (npm run lint) - exit 0
```
> adaptive-cut@0.1.0 lint
> eslint
(no errors)
LINT_EXIT=0
```

### Type-check (npm run typecheck) - exit 0
```
> adaptive-cut@0.1.0 typecheck
> tsc --noEmit
(no errors)
TYPECHECK_EXIT=0
```

### Test suite (npm run test, single non-concurrent run) - exit 0
```
> adaptive-cut@0.1.0 test
> vitest run

 RUN  v4.1.10 C:/FitMess2/exexutor/claude-missions

 Test Files  70 passed (70)
      Tests  686 passed | 17 skipped (703)
   Start at  10:06:32
   Duration  298.04s
```
The 17 skipped are the credential-gated live-integration diagnostics (see
M3-A). In this environment the live suites for F020/F021 (and my own
Management-API probes) executed against the real DB and passed; the skips do not
indicate a failing behaviour.

### Independent live-DB verification (Supabase Management API)
```
foods: total 1678 | seed 350 | off 1328 | user 0 | with_barcode 1328 | verified 350
constraint: foods_barcode_key UNIQUE (barcode)  plus foods_pkey
AS-057 dup-barcode insert -> rejected, 0 rows persisted
AS-035: OFF rows with incomplete macro = 0 ; OFF rows verified = 0
AS-034: search_foods(sarma|gibanica|pasulj) each return the dish
AS-036: search_foods(cevapi) -> Cevapi... (accent and case tolerant)
AS-038: search_foods(srma) and (sarmp) -> Sarma...
AS-037: cyrillicToLatin(cyr sarma) -> sarma, (cyr pasulj) -> pasulj; raw Cyrillic to RPC does NOT match Latin rows (translit required and present)
AS-046: 23:30Z near-midnight, CET/CEST, spring-forward 23h, fall-back 25h all assign correct Belgrade day
data-quality: 21 catalog rows have Cyrillic name_sr (M3-C)
```
