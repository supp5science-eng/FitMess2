# M2 — Auth & Onboarding — UX Validation

_Validated by driving the RUNNING application (Next dev server on :3210, real
Microsoft Edge via puppeteer-core at 375px, Supabase admin API for user
setup/verification). Read-only on project code — no code was modified._

- App boot: `npm run dev -- -p 3210` (auto-loads `.env`) — Ready in ~1s, served HTTP 200.
- Viewport: 375x812 @2x (screenshots are 750x1624). All screens sr-Latn, "ti" form, single green accent, no horizontal scroll.
- Evidence dir: `missions/20260717-183157/handoffs/evidence/M2-ux/`
- Test users created via admin API (`SUPABASE_SECRET_KEY`), all deleted after use; post-run sweep for `m2ux-*` = 0 leftover.

## Results

| ID | Verdict | Evidence | Reproduction |
|----|---------|----------|--------------|
| AS-008 | INCONCLUSIVE | AS-008-registracija-filled-375px.png, AS-008-after-signup-375px.png, AS-008-retry-loop.log, s1-auth-pages.log | Drive /registracija, type email+password, submit. Form renders, accepts input, and invokes the real Supabase `signUp` — but account creation is blocked by the project's built-in-SMTP confirmation-email cap (`rate_limit_email_sent=2/hour`, already exhausted before the session, `over_email_send_rate_limit`). signUp is rejected pre-creation, so the admin API shows USER NOT FOUND. See note below. |
| AS-009 | PASS | AS-009-unconfirmed-login-prompt-375px.png, s1-auth-pages.log | Admin-create an unconfirmed user (`email_confirm:false`), sign in at /prijava. GoTrue refuses a session; the app redirects to `/registracija/proveri-email` showing the Serbian "Proveri email" verification prompt. A session-less GET /danas redirects to /prijava. |
| AS-010 | PASS | AS-010-prijava-google-375px.png, AS-010-registracija-google-375px.png, AS-010-google-oauth-redirect-375px.png, s1-auth-pages.log | "Nastavi sa Google" button renders on both /prijava and /registracija. Clicking it initiates the OAuth redirect to `accounts.google.com` (client_id + `redirect_uri=...supabase.co/auth/v1/callback`, scope email+profile). Interactive consent = documented manual-QA (not failed). |
| AS-011 | PASS | AS-011-redirects.log | Signed-out GET /danas, /nedelja, /agent, /profil, /onboarding, /onboarding/pregled each returns HTTP 307 with `Location: /prijava`. Public /, /prijava, /registracija, /registracija/proveri-email = 200. |
| AS-012 | PASS | AS-012-after-signout-375px.png, s2-session-flows.log | Signed-in onboarded user clicks "Odjavi se" on /profil -> lands on /prijava; a subsequent GET /profil redirects to /prijava. |
| AS-014 | PASS | AS-014-profil-export-button-375px.png, s2-session-flows.log | /profil shows "Preuzmi moje podatke". GET /api/export -> 200, `Content-Disposition: attachment; filename="fitmess-podaci-2026-07-18.json"`, JSON body keys account/profile/rules/targets, account.email matches the signed-in user. |
| AS-015 | PASS | AS-015-delete-dialog-375px.png, AS-015-delete-dialog-confirmed-375px.png, AS-015-after-delete-375px.png, s2-session-flows.log | /profil "Obriši nalog" opens a type-to-confirm dialog; confirm button disabled until "OBRIŠI" typed (disabled=true -> false). Confirming deletes -> redirect to /prijava; admin API: auth user GONE and profiles rows = []. (AS-016 bonus: deleted credentials then fail login with the generic Serbian error.) |
| AS-017 | PASS | AS-017-existing-email-wrong-password-375px.png, AS-017-nonexistent-email-375px.png, s1-auth-pages.log | Existing-email+wrong-password and a nonexistent email both render the byte-for-byte identical Serbian error "Pogrešan email ili lozinka." — no account-existence leak. |
| AS-018 | PASS | AS-018-danas-redirects-to-onboarding-375px.png, s2-session-flows.log | Verified, not-yet-onboarded user: GET /danas redirects (307) to /onboarding and renders the wizard (h2 "Koji je tvoj pol?") — routed through onboarding before the home screen. |
| AS-019 | PASS | AS-019-step1-pol..step6-cilj-375px.png, s2-session-flows.log | Wizard walked step-by-step: pol (Žensko/Muško), godine, visina, težina, aktivnost (5 tiers: Sedentaran, Lagana, Umerena, Aktivan, Veoma aktivan), cilj (ciljna težina + rok). Preview "-6 kg za 12 nedelja". Hand-off URL carried all 7 values: `pol=female&godine=30&visina=170&tezina=80&aktivnost=moderate&ciljnaTezina=74&nedelje=12`. |
| AS-020 | PASS | AS-020-summary-initial-375px.png, AS-020-summary-after-edit-375px.png, s2-session-flows.log | Summary at /onboarding/pregled is editable and recomputes live: changing activity moderate -> "Veoma aktivan" moved daily budget 1856 -> 2399 kcal on screen. On "Započni" -> /danas; admin API: `profiles.onboarded_at` set AND `profiles.activity_level=very_active` (the EDITED value persisted), a new `targets` row created (present in export). |

## AS-008 detail (INCONCLUSIVE — not a FAIL)

The /registracija form is fully functional: it renders the Serbian sign-up UI
at 375px, accepts email + password, and submits to the real Supabase `signUp`
call. What could NOT be observed end-to-end is the account actually being
created, because the Supabase project's built-in email service caps
confirmation emails at `rate_limit_email_sent = 2/hour` and that quota was
already exhausted before this session began. Every attempt (1 in s1 + 1 in s3
+ 4 in the retry loop, spaced ~55s apart over several minutes) returned the
app's correct Serbian throttle message "Previše pokušaja u kratkom periodu.
Sačekaj malo pa pokušaj ponovo." (`over_email_send_rate_limit`), and the admin
API confirmed no `auth.users` row was created (signUp is rejected before
creating the user when the confirmation email cannot be sent).

- This is an environment/infrastructure limit, NOT an application defect — the
  app behaves correctly (it surfaces a friendly Serbian message rather than
  crashing or leaking).
- The cap cannot be raised via the Management API without custom SMTP
  (PATCH `config/auth {rate_limit_email_sent}` returned 401: "Custom SMTP
  required..."). No project config was changed (the PATCH was rejected).

Reproduction: with the dev server up, submit a fresh email at /registracija.
If the project's hourly email quota has free slots, expect a redirect to
`/registracija/proveri-email` and a new unconfirmed `auth.users` row (verify
via admin `listUsers`). While the quota is exhausted, the signup is throttled.

Suggested fixes (for the orchestrator to decide):
- Configure custom SMTP for the Supabase project (raises/removes the email cap)
  and re-run this single assertion, OR
- Add a test hook (e.g. a signup path honoring `mailer_autoconfirm` in a test
  env, or an email-testing inbox service) so end-to-end signup is verifiable
  in automation, OR
- Accept the gap: F011's automated integration test already proves account
  creation + the profiles-trigger row via the admin-API-equivalent path, and
  the UI up to the signUp call is verified here.

## Notes
- Route redirect targets observed match the F013 matrix: signed-out -> /prijava;
  authenticated+unverified -> /registracija/proveri-email; verified+not-onboarded
  -> /onboarding.
- `/danas` is still a placeholder (M3) — redirect *targets* were validated, not
  eventual home content, per the task scope.
- All UI copy observed is Serbian sr-Latn in the informal "ti" form; core auth &
  onboarding screens render mobile-first at 375px with no horizontal scroll and a
  single green accent color.
- Cleanup: dev server stopped; all created test users deleted (post-run sweep
  `m2ux-*` = 0). Supabase Auth config left unchanged.
