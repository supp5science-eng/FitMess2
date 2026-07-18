# Handoff: F025 — Log entry creation — grams + common units

## Status
COMPLETE

## Assertions covered
AS-041: PASS — unit-tested `computeMacrosForGrams` (grams -> kcal/protein/carbs/fat from per-100g values) in `src/lib/food/__tests__/portions.test.ts`, plus a live integration test hitting `POST /api/logs` and asserting the persisted `logs` row's computed + snapshotted values (`src/app/api/logs/__tests__/route.integration.test.ts` `test_AS_041_...`). Also exercised end-to-end via a real headless-browser walkthrough (375px screenshot 00).
AS-042: PASS — unit-tested `resolveUnitGrams` (unit gram weight × quantity) in `portions.test.ts`, plus a live integration test creating a food with a `{label:"parče",grams:50}` common unit, resolving "2 parčeta" to 100g, and asserting the persisted log row's grams + macros match (`test_AS_042_...`). Also exercised end-to-end via the same real-browser walkthrough (375px screenshot 01, selecting the "parče" chip with quantity=2).

## Files changed
src/lib/food/portions.ts
src/lib/food/__tests__/portions.test.ts
src/app/api/logs/route.ts
src/app/api/logs/__tests__/route.integration.test.ts
src/components/food/portion-picker.tsx
src/components/food/__tests__/portion-picker.test.tsx
src/components/food/food-list-item.tsx (modified — now links to the portion picker)
src/app/(app)/dodaj/porcija/[foodId]/page.tsx

## Commands run
`npx vitest run src/lib/food/__tests__/portions.test.ts` (0)
`npx vitest run src/app/api/logs/__tests__/route.integration.test.ts` (0) — 6 passed, 1 skipped (the standard "diagnostic when credentials present" block)
`npx vitest run src/components/food/__tests__/portion-picker.test.tsx` (0)
`npx vitest run src/components/food/__tests__/food-list-item.test.tsx src/components/food/__tests__/search-screen.test.tsx` (0) — proves F024's own tests still pass unmodified against the now-linked `FoodListItem`
`npm run test` (0) — full suite: 571 passed, 15 skipped (all 15 are the pre-existing "live diagnostic, credentials present" pattern used across every prior live-integration test file — verified individually, see `Notes for the next worker`)
`npm run lint` (0)
`npm run typecheck` (0)
`npm run build` (0) — confirms `/api/logs` and `/dodaj/porcija/[foodId]` compile into the route table
`node shots.mjs` (scratchpad, 0) — real headless-Edge walkthrough against `npm run build && npm run start -p 3105`: sign in a real confirmed+onboarded test user, navigate to the portion picker for a deterministic test food (per-100g 280/8/45/7, common unit `{label:"parče",grams:60}`), capture the default-100g preview, select the unit chip + set quantity=2, capture that preview, click confirm, capture the post-redirect page. All seeded/created data (test user, test food, the one real log row the confirm click created) deleted afterward and independently re-verified as fully gone via a separate `verify-clean.mjs` admin-client query.

## Decisions made
- **Units/quantity resolved to a final `grams` number entirely client-side** (`src/components/food/portion-picker.tsx`), before ever reaching `POST /api/logs`. The server/shared-lib layer (`src/lib/food/portions.ts`, the route) only ever deals with one gram number — this keeps the reusable core (explicitly meant for F031/F062/F064) as small and DB/UI-agnostic as possible: those features just need to resolve a `foodId` + `grams` however fits their own flow (barcode lookup, vision estimate) and POST the same shape.
- **`POST /api/logs` re-fetches the food's per-100g values server-side** (never trusts client-submitted kcal/macros) and recomputes via `computeMacrosForGrams` — matches the "money-math rule" (tech-decisions.md: deterministic code computes numbers, never trusts the client) and the existing snapshot convention from `0004_foods_logs.sql`.
- **Grams bounds: 1–5000** (`MIN_PORTION_GRAMS`/`MAX_PORTION_GRAMS` in `portions.ts`) — generous enough for a whole-meal single entry, tight enough to catch a fat-fingered typo. No clarified spec answer specified an exact bound, so this is an autonomous default (see below).
- **Route path `/dodaj/porcija/[foodId]`** (not e.g. `/dodaj/pretraga/[foodId]`) — "porcija" (portion) is the Serbian word for what this screen does, keeping route segments in Serbian per tech-decisions.md's convention, and keeps it a sibling of `/dodaj/pretraga` rather than nested under it (the picker is reachable from other future entry points too — barcode/photo — not just search).
- **`FoodListItem`'s existing `<li>` and every `data-testid` left completely unchanged** — only wrapped its inner content in a `next/link` `<a>` — specifically so F024's own component tests (`food-list-item.test.tsx`, `search-screen.test.tsx`) needed zero edits and still pass, verified by an explicit test run of just those two files.
- **`method` defaults to `'search'` server-side** if the request body omits it, but the portion picker itself always sends `method: "search"` explicitly (this is the search-originated flow, F024→F025). Future callers (F031/F062/F064) pass their own `method` value.
- Did not build a bottom-sheet/modal (`Sheet` primitive) — no shadcn `Sheet` component exists yet in this repo (`src/components/ui/` only has button/input/label/badge/skeleton) and the clarified spec says "bottom sheet / component" (component explicitly offered as an equivalent). Built `/dodaj/porcija/[foodId]` as its own full-screen route instead — simpler, no new UI-primitive dependency to install, and consistent with how `/dodaj/pretraga` itself is a full route rather than a sheet over `/dodaj`.

## Out-of-scope work needed
- `/danas` (F027, home/today view) does not exist yet — the post-save redirect target is currently a blank page (Next 404-shaped placeholder). This is explicitly called out as fine in the clarified spec ("for now redirect to /danas which may be placeholder — that's fine"); no action needed until F027 lands.
- Editing/deleting an already-created log entry is out of scope for this feature (F025 is create-only) — not attempted.
- Belgrade day-boundary handling for `logged_at` (F028) was explicitly deferred per the clarified spec; this feature relies on the `logs.logged_at` column's Postgres `now()` default and does not touch `src/lib/dates.ts`.
- F031 (barcode scan) and F062/F064 (photo label/meal logging) should call `POST /api/logs` (or `createLogFromPortion` directly if they're server-side already) with their own `method` value once they've resolved a `foodId` + `grams` — see `src/lib/food/portions.ts`'s header comment for the full reuse contract. Neither of those features' UI was touched here.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Chose 1–5000g as the valid single-entry gram range (`src/lib/food/portions.ts`'s `MIN_PORTION_GRAMS`/`MAX_PORTION_GRAMS`) — the clarified spec/clarification file specify validation should be zod-based with a Serbian error message but don't name an exact numeric bound for a food portion; 5000g (5kg) comfortably covers even an entire large pot of soup logged as one entry while still catching an obvious typo (e.g. "10000").
AUTONOMOUS_DECISION: Built the portion picker as a dedicated full-screen route (`/dodaj/porcija/[foodId]`) rather than an actual overlay/bottom-sheet component, because no shadcn `Sheet`/`Dialog`-with-portal primitive exists in this repo yet and the clarified spec explicitly allows "bottom sheet / component" as equivalent options. A future feature could restyle this into a true bottom sheet (visually) without changing any of the data flow — the `PortionPicker` component itself is UI-shell-agnostic (just a `<main>` today).
AUTONOMOUS_DECISION: Quantity multiplier input is a plain number `<input>` (min 0.5, step 0.5, max 20) rather than a stepper with +/- buttons — the clarified spec says "a quantity multiplier is allowed (e.g. 2 parčeta)" without prescribing the exact input control; a native number input is the smallest, most keyboard/screen-reader-accessible option that satisfies "enter a quantity."

## Notes for the next worker
- **Reuse `src/lib/food/portions.ts` and `POST /api/logs`** for F031 (barcode) and F062/F064 (photo) rather than re-implementing "per-100g × grams/100, snapshot into `logs`" — see that file's header comment for the exact contract (`createLogFromPortion(supabase, {userId, food, grams, method})`, or just `POST /api/logs` with `{foodId, grams, method}` if you're client-side). `computeMacrosForGrams`/`resolveUnitGrams` are also directly reusable if a future flow needs the same live-preview math (e.g. editing a portion before confirming a photo estimate).
- `FoodListItem` (F024) now links every result/recents row to `/dodaj/porcija/[foodId]` — if a future feature needs a *non*-navigating food row (e.g. an admin food-browser), don't reuse this component as-is; it's now specifically "tap to log."
- Real-browser 375px evidence (`evidence/F025/*.png`) was captured with `puppeteer-core` driving locally-installed headless Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) against `npm run build && npm run start -p 3105`, following the exact F024 precedent. One correction worth flagging for future screenshot scripts in this repo: **both the sign-in Server Action redirect and `router.push()` are client-side (History API) navigations, not full browser navigations** — `page.waitForNavigation()` times out waiting for them; use `page.waitForFunction(() => window.location.pathname === "...")` instead (this file's script does). Also: `networkidle0` never resolves against this app's built server (likely a long-lived Supabase realtime/websocket connection keeps the network non-idle) — use `waitUntil: "load"` instead. Script (`shots.mjs`, `verify-clean.mjs`) and its `puppeteer-core`/`@supabase/supabase-js` deps live only in this session's scratchpad, not the repo, matching the F001/F011/F015/F016/F017/F024 precedent (not committed).
- MCP tools were not used for this feature (no live schema/policy change — `foods`/`logs` schema is unchanged from F020; this feature only reads/writes through the already-established session-scoped client pattern and RLS policies). Per the run-mode instructions and `mcp-registry.md`'s documented finding, `mcp__supabase__*` tools are not bound inside worker subagents anyway — all live-DB verification (creating/cleaning up test fixtures, confirming no orphaned `f025-*` test data) went through the admin Supabase client (`@supabase/supabase-js` + `sb_secret_` key from `.env`), matching every prior feature's pattern in this repo.
- `plan.md`/`run-log.md` were left untouched by this worker (visible as pre-existing uncommitted orchestrator edits in `git status` at the start of this session, unrelated to F025) — per the established F018–F024 precedent, mission-control files are the orchestrator's responsibility, not committed by the worker.
