# M3 UX Validation — Food Database and Manual Logging

Behavioural validation of milestone M3 (features F020-F028) by driving the RUNNING
application. Mission 20260717-183157. Validator: ux-validator (Opus 4.8). Date: 2026-07-18.

## Environment

- App booted from the repo per tech-decisions "How to run": Next.js 16.2.10 dev server.
  A dev server was already running on port 3000 (same repo, Turbopack) and served the
  app; root returned 200, /danas returned 307 to /prijava when signed-out (route
  protection active). All flows were driven against http://localhost:3000.
- Driver: puppeteer-core driving the installed Microsoft Edge binary, headless, real
  page.setViewport({ width: 375, height: 812 }) for genuine 375px mobile rendering.
- Test users created via the Supabase admin client (SUPABASE_SECRET_KEY): a verified
  user with profiles.onboarded_at set and a targets row (daily 2000 kcal / 150 P /
  200 C / 60 F) seeded directly so route protection admitted the user into /danas.
- Playwright MCP was NOT registered; drove via Bash + puppeteer-core as instructed.
- All test users and log rows created were deleted afterwards (see Cleanup).

## Verdict summary: 15 / 15 behavioural assertions PASS. 0 FAIL. 0 INCONCLUSIVE.

Test food used for logging: Kackavalj (per-100g 353 kcal / 26 P / 1.5 C / 27 F,
common unit parce = 30 g), id 142550a8-8db2-4b76-bd03-fd3e75a4febd (live catalog).

## Results

| ID | Verdict | Evidence | Reproduction / measured observation |
|------|---------|----------|--------------------------------------|
| AS-036 | PASS | search-neprovereno-375px.png; results.json | On /dodaj/pretraga a Latin query "sarma" returned 16 results including matching sarma dishes (e.g. "Sarma, sa mlevenim mesom i pirincem"). |
| AS-037 | PASS | results.json | The SAME query typed in Cyrillic (U+0441 U+0430 U+0440 U+043C U+0430) returned 16 results including the Latin-named sarma foods. Cyrillic input resolves to Latin-stored rows. |
| AS-038 | PASS | results.json | A one-character typo "srma" (missing a) still returned the intended food: "Sarma, sa mlevenim mesom i pirincem". |
| AS-039 | PASS | search-neprovereno-375px.png | Search "plazma": the verified "Plazma keks" (Bambi) shows NO badge; multiple unverified entries ("Bambi - Plazma Keks", "Plazma", "Plazma cheesecake", "Plazma Mini Mini", "Plazma Mlevena") each show the yellow "neprovereno" marker. |
| AS-040 | PASS | recents-userA-375px.png; as040.json | User A (who previously logged Kackavalj) sees it in the empty-box "Nedavno korisceno" quick-add list AND, when searching "kackavalj", it is the TOP result tagged "nedavno". A separate freshly-onboarded user B (isolated browser profile) sees an EMPTY recents list and does not see the user A food. |
| AS-041 | PASS | portion-grams-375px.png; results.json | Logged Kackavalj by grams: 150 g. Live preview computed kcal 530 (353 x 1.5 = 529.5 rounded), Proteini 39 g, UH 2.3 g, Masti 40.5 g. After confirm the row persisted (DB read: grams 150, kcal 529.5, protein 39, carbs 2.3, fat 40.5, method search). |
| AS-042 | PASS | portion-unit-parce-375px.png; results.json | Logged by common unit: selected the "parce (30 g)" chip, quantity 2. Resolved grams field = 60, preview kcal 212 (353 x 0.6 = 211.8), Proteini 15.6 g. Row persisted correctly. |
| AS-043 | PASS | danas-normal-375px.png; results.json | Saving a new log returned to /danas with "Preostalo" dropping 2000 -> 1471 (client router.push, no manual reload). Stronger no-reload proof: an IN-PLACE portion edit on /danas changed the ring 1259 -> 765 while a window marker survived and the URL stayed /danas, proving no full page reload. |
| AS-044 | PASS | results.json | Edited a logged meal portion via the meal-card "Izmeni" sheet from 150 g to 200 g; "Preostalo" recalculated 1259 -> 765 immediately. |
| AS-045 | PASS | results.json | Deleted a logged meal via "Obrisi"; meal cards went 2 -> 1 and "Preostalo" recalculated 765 -> 1471. |
| AS-047 | PASS | danas-empty-375px.png; danas-normal-375px.png | /danas shows a circular ring with remaining calories centered: empty "Preostalo 2000 kcal", after logging "Preostalo 1471 kcal". |
| AS-048 | PASS | danas-normal-375px.png; results.json | Three macro bars render with consumed vs target: Proteini 39 / 150 g, UH 2 / 200 g, Masti 41 / 60 g. |
| AS-049 | PASS | danas-normal-375px.png | /danas lists today logged meals under "Obroci danas" (a card per entry with name, portion, kcal). |
| AS-050 | PASS | danas-overshoot-375px.png; results.json | Logged 700 g Kackavalj (2471 kcal) to exceed the 2000 budget. Ring shows "Prekoraceno 1001 kcal" with calm copy "Jedan dan vise ne menja nista. Nastavi sutra kao i obicno." The ring stroke stayed the single green accent rgb(22,163,74) (NOT red), macro bars show real over-target numbers, and the app stayed fully usable (the "+" add sheet opened normally). No shaming vocabulary present. |
| AS-051 | PASS | (driven live) | From /danas, tap 1 = the floating "+" opened the add sheet with all 4 logging methods; tap 2 = "Pretrazi" navigated to /dodaj/pretraga. Starting a logging method is exactly 2 taps. |

## Cross-cutting UI confirmations (M3 screens)

- Mobile-first 375px: every screen rendered at a real 375px viewport; screenshots above.
- No horizontal scroll (AS-125 spot-check): /danas documentElement.scrollWidth 375 = innerWidth 375; /dodaj/pretraga scrollWidth 375 = innerWidth 375.
- Single green accent (AS-127 spot-check): ring, progress bars, FAB, primary buttons and the search focus ring all use one green accent (rgb(22,163,74)); overshoot did NOT introduce a red/alarming color.
- Serbian sr-Latn ti form (AS-124 spot-check): observed informal address, e.g. the search subheading "Pretrazi namirnicu ili brzo dodaj nesto sto si nedavno jeo/la" (si / ti form), plus "Dodaj u dnevnik", "Obroci danas", "Preostalo", "Prekoraceno".
- Centered mobile column (AS-126 spot-check): content and the floating "+" are anchored to a centered max-width column.

## Not UX-observable in a single session (deferred to scrutiny, already PASS there)

These M3-assigned assertions are data-layer or internal invariants that cannot be
proven from the UI in one session; the M3 scrutiny report validated them against the
live Supabase project. Listed for completeness, not re-tested from the UI:

- AS-032 (foods schema fields), AS-057 (unique-barcode rejection) — DB schema/constraint.
- AS-033 (>=300 seeded foods), AS-034 (sarma/gibanica/pasulj findable) — seed data; sarma findability WAS observed here via search.
- AS-035 (OFF import quality filter + source stamping) — import-pipeline invariant.
- AS-046 (log day assignment in Europe/Belgrade) — requires clock/timezone manipulation to observe a boundary; internal date math, unit-tested + live-probed in scrutiny.

## Observations (non-blocking, no assertion failure)

- A grams-logged entry whose gram amount happens to equal a whole multiple of a
  common unit is DISPLAYED using that unit label: the 150 g Kackavalj entry shows
  "5 x parce (150 g)" on its meal card. The stored grams and kcal are correct; only
  the human-readable portion label is inferred. Cosmetic, not an AS-041/049 failure.

## Suggested fixes

None required for M3 behavioural scope. Optional cosmetic: consider only showing a
common-unit label for entries actually logged by that unit, to avoid the "5 x parce"
label on a raw-grams entry (see Observations).

## Cleanup

All test users (2 in the main run, 2 in the AS-040 isolation run) and every log row
they created were deleted via the admin client; deletions confirmed. The dev server
on port 3000 was pre-existing (not started by this validator) and is left as found;
the extra dev instance this validator attempted to start on port 3210 refused to boot
(Next.js single-dev-server guard) and left no process.

## Evidence index (missions/20260717-183157/handoffs/evidence/M3-ux/)

- danas-empty-375px.png — home ring "Preostalo 2000 kcal", empty state.
- danas-normal-375px.png — home after logging: ring 1471, 3 macro bars, meal card.
- danas-overshoot-375px.png — overshoot "Prekoraceno 1001 kcal", green ring, calm copy.
- search-neprovereno-375px.png — search "plazma": verified vs neprovereno-badged.
- portion-grams-375px.png — grams portion picker preview (150 g -> 530 kcal).
- portion-unit-parce-375px.png — unit portion picker (2 x parce = 60 g -> 212 kcal).
- recents-userA-375px.png — recents quick-add + recent-ranked search for user A.
- results.json — per-assertion measurements from the main run.
- as040.json — AS-040 recents/isolation measurements.
