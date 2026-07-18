# M2 -- Auth & Onboarding -- Scrutiny Report

Adversarial milestone review. Read-only on project code. Validator saw code + live Supabase project, not worker chat history.

- Reviewer verdict: PASS (GREEN) -- all 20 in-scope assertions verified.
- Date: 2026-07-18
- Features in milestone: F010, F010a, F011, F012, F013, F014, F015, F016, F017, F018, F019, F019a
- Suite state: `npm run test` -> 39 files, 375 passed, 11 skipped, 0 failed. `npm run lint` clean. `npm run typecheck` clean.
- Independent live verification performed against the Supabase project (Management API SQL + a fresh behavioral RLS/deletion test written from scratch by this reviewer, not the workers' tests). Every security-critical claim was reproduced, not taken on trust.

## What the code actually DOES (not what the workers said)

- Auth boundary is server-enforced and default-deny. src/middleware.ts calls auth.getUser() (server-revalidated, not a locally-decoded JWT) and delegates to the pure decideRouteAccess. Any path not in the explicit public allowlist (/, /prijava, /registracija*, /auth/*) is protected. Unauth -> /prijava; verified-not-onboarded -> /onboarding; onboarding routes exempt so no redirect loop.
- RLS is the real cross-user guard, live-confirmed. profiles/targets both have relrowsecurity=true and exactly 4 own-row policies each (user_id = auth.uid(), to authenticated, no using(true)). Reviewer two-user live test: user B reading A's profile/targets returns 0 rows; B's UPDATE of A no-ops (A's height stayed 180, not 999); B's INSERT as A is blocked with Postgres 42501.
- Account deletion is a single atomic auth.admin.deleteUser relying on ON DELETE CASCADE FKs (both confdeltype c live). Reviewer live test: after delete, A's profile rows=0, targets rows=0, auth user gone, A's credentials return invalid_credentials. The route resolves user.id from the session only; there is no userId body param, so no cross-user deletion vector exists.
- Data export uses the caller's session-bound RLS client (collectUserExport), never an admin client; user.id comes from auth.getUser(). Cross-user isolation is enforced by RLS + explicit .eq(user_id).
- Budget engine is pure Mifflin-St Jeor. Reviewer hand-recomputed 4 reference values from the published formula (1805, 1370, 1599, 1279); all match. Caps/floors/macros/weekly are tested against independently-derived expected numbers, not implementation echoes.
- Login errors are genuinely non-enumerating. GoTrue returns identical invalid_credentials for wrong-password and unknown-email; mapAuthErrorToSerbian branches only on code/status (never message text) and fails closed to a generic message for unmapped codes.

## Per-assertion results

| ID | Result | Severity | One-line reason |
|----|--------|----------|-----------------|
| AS-008 | PASS | - | Email/password signup creates an unconfirmed auth.users row; on_auth_user_created trigger (live) auto-creates the profiles shell. |
| AS-009 | PASS | - | GoTrue refuses a session for an unconfirmed account; distinct Serbian verification prompt; middleware not-verified branch is defense-in-depth. |
| AS-017 | PASS | - | Wrong-password and unknown-email both map to the identical invalidCredentials Serbian string; mapping never branches on message text; fails closed. |
| AS-010 | PASS | - | Automatable parts verified: button calls signInWithOAuth(provider google, redirectTo /auth/callback); external_google_enabled=true live; provider-agnostic isEmailVerified gate + provider-agnostic profiles trigger. Interactive consent click is the documented manual-QA item, correctly excluded from FAIL per review scope. |
| AS-011 | PASS | - | Default-deny middleware; live 307 -> /prijava for a cookie-less request; 20 pure branch tests. |
| AS-012 | PASS | - | signOutAction clears the session cookie + redirect(/prijava); middleware then blocks protected pages; live sign-in/signout/redirect integration test. |
| AS-013 | PASS | - | Independently live-reproduced: cross-user SELECT=0 rows, UPDATE no-op, INSERT blocked 42501. RLS enabled + 4 own-row policies/table confirmed via Management API. |
| AS-031 | PASS | - | profiles.onboarded_at is nullable timestamptz (live); set at onboarding confirm; middleware routes on onboarded_at IS NOT NULL; a returning user reaches /danas. |
| AS-014 | PASS | - | /api/export returns caller-only data via session-bound RLS client; user.id from session; cross-user isolation asserted; 401 + Serbian error when signed out. |
| AS-015 | PASS | - | Independently live-reproduced: single atomic deleteUser cascades (both FKs ON DELETE CASCADE) removing profile+targets rows AND the auth user. |
| AS-016 | PASS | - | Independently live-reproduced: deleted credentials return invalid_credentials, no session. |
| AS-018 | PASS | - | Verified-not-onboarded user is 307'd from /danas to /onboarding; /onboarding itself allowed (no loop). |
| AS-019 | PASS | - | 6-step wizard collects sex, age, height, weight, activity (5 tiers), target weight, timeframe; state preserved Back/Dalje. |
| AS-020 | PASS | - | Summary re-runs the F014 engine on every edit; server persists the freshly-recomputed value (integration test edits activity -> targets.daily_kcal changes live). |
| AS-021 | PASS | - | Mifflin-St Jeor exact; 4 reference values hand-verified by reviewer against the published equation. |
| AS-022 | PASS | - | TDEE = BMR x multiplier; all 5 tiers (1.2/1.375/1.55/1.725/1.9) asserted + monotonic-increase check. |
| AS-023 | PASS | - | dailyTarget floors at 1400 (m)/1200 (f); boundary + below + above cases tested. |
| AS-024 | PASS | - | Deficit clamped to MAX_DEFICIT_PCT=0.25; 50%, exactly-25%, just-over, and negative-surplus cases tested; goal path clamps the implied deficit too. |
| AS-025 | PASS | - | Protein 2.0 g/kg (in 1.8-2.2), fat >=0.6 g/kg floor honored under tight budgets, carbs are the exact kcal remainder (sum-to-total assertion). |
| AS-026 | PASS | - | weeklyBudget = round(daily) x 7; fractional-rounding and zero/negative-clamp cases tested. |
| AS-030 | PASS | - | planGoalAdjustment clamps to 25% cap + sex floor, emits stable reason codes; explainGoalAdjustment renders genuine Serbian sentences shown on the summary. |
| AS-028 | PASS | - | generateRules deterministically yields 3-5 Serbian rules (5 core rules pad to the 3 minimum; hard cap at 5); hooked into persistOnboarding at onboarding completion; live-persisted to profiles.rules. |
| AS-029 | PASS | - | /profil/pravila toggles + edits persist via session-bound RLS client with server-side re-validation; cross-user overwrite blocked by RLS. |

No assertion passes merely because a test mirrors the implementation: the budget reference values were re-derived by hand, and the RLS/deletion/credential behaviors were re-executed live by the reviewer.

## Findings (none blocking)

- [minor / forward-risk] AS-014 export completeness is not type-enforced across future tables. USER_OWNED_TABLES in src/lib/export/user-data.ts currently covers targets (+ profile/rules). It is complete for M2 (those are the only personal tables that exist), but when M3/M5/M6/vision add logs/weigh_ins/conversations/user-foods, nothing forces a worker to append them; a forgotten entry would silently ship a truncated export. A future scrutiny pass at those milestones must diff USER_OWNED_TABLES against the live schema. Not an M2 defect.
- [minor / forward-risk] AS-015 deletion completeness depends on future FKs staying ON DELETE CASCADE. deleteAccount deletes only via the auth-user cascade. Any future user-owned table must add an ON DELETE CASCADE FK (or, for shared/crowdsourced rows, ON DELETE SET NULL to anonymize) or its rows will survive account deletion. Correct for M2 (only profiles/targets, both cascade). Flag for M3+.
- [minor] Unauthenticated /api/* requests get a 307 redirect to /prijava (HTML) from the middleware before the route's own JSON 401 runs. Access is denied either way (both /api/export and /api/account/delete also re-check auth.getUser()), so this is cosmetic API semantics, not a gap.
- [minor / by-design] AS-017: the email_not_confirmed branch returns a distinct message. It is only reachable with the correct password (GoTrue checks password first), so it does not leak account existence to a third party who is guessing. Acceptable and correctly reasoned in code comments.
- [observation] The onboarding wizard is loss-only (target weight must be strictly below current). AS-019 only requires collecting the inputs, and AS-030's safe-bound adjustment concerns the deficit magnitude, which is handled. No assertion requires maintenance/gain goals. Fine.

## Recommended follow-up features (specs for the orchestrator)

1. Export/deletion completeness guard (M3+ hardening). As each later milestone adds a user-owned table, its migration commit must also (a) append a one-line USER_OWNED_TABLES entry in src/lib/export/user-data.ts, and (b) ensure the table's user_id/created_by FK is ON DELETE CASCADE (owned data) or ON DELETE SET NULL (shared/crowdsourced). Add a lightweight test that enumerates public tables with a user_id column and asserts each is present in USER_OWNED_TABLES and has the correct FK delete rule, so a forgotten table fails CI rather than silently shipping a partial export or leaving orphaned rows after deletion.

## Manual-QA carry-forward (not failures)

- AS-010 interactive Google consent click: one human click-through at /prijava or /registracija with a real Google account (per manual-qa.md). Everything else about Google OAuth is automated + verified.

## Appendix -- command output

### npm run test
```
Test Files  39 passed (39)
     Tests  375 passed | 11 skipped (386)
  Duration  ~134s   exit code 0
```
(11 skips are the documented describe.skipIf(hasCredentials) diagnostic-only branches, correctly inert because .env has valid credentials.)

### npm run lint
```
> eslint
(clean -- zero errors, zero warnings, exit code 0)
```

### npm run typecheck
```
> tsc --noEmit
(clean -- zero errors, exit code 0)
```

### Live Supabase verification (reviewer-run, Management API + @supabase/supabase-js)
```
RLS enabled:   profiles=true, targets=true
Policies:      profiles & targets each have 4 own-row policies (select/insert/update/delete),
               all qual/with_check = (user_id = auth.uid()), roles = {authenticated}
FK on-delete:  profiles_user_id_fkey=CASCADE, targets_user_id_fkey=CASCADE
Columns:       profiles.onboarded_at = timestamptz NULLable; rules = jsonb NOT NULL default []; is_admin = boolean NOT NULL default false
Trigger:       on_auth_user_created present on auth.users
Auth config:   external_google_enabled=true, mailer_autoconfirm=false, uri_allow_list=http://localhost:3000/**, site_url=http://localhost:3000

Behavioral (fresh two-user test written by reviewer):
  AS-013 B reads A profile      -> 0 rows
  AS-013 B reads A targets      -> 0 rows
  AS-013 B updates A profile    -> 0 rows returned; A.height_cm still 180
  AS-013 B inserts target as A  -> blocked (42501)
  AS-015 deleteUser(A)          -> no error
  AS-015 A profile rows after   -> 0
  AS-015 A targets rows after   -> 0
  AS-015 A auth user exists     -> false
  AS-016 deleted creds sign-in  -> invalid_credentials
```
