# Handoff: F004 — Vercel project + git auto-deploy

## Status
COMPLETE

## Assertions covered
AS-007: DEFERRED — requires one-time Vercel GitHub-link, a browser-only step; code-side readiness done. All automatable preconditions verified PASS (see below); the live-deploy behaviour itself cannot be exercised without the Vercel dashboard project link, which is out of an autonomous worker's reach (no browser, no OAuth).

## Files changed
docs/deploy.md (new)
src/lib/__tests__/deploy-readiness.test.ts (new)

## Commands run
`npm run build` (0) — clean production build, `Compiled successfully`, 4/4 static pages generated
`npm run build` with `.env` temporarily removed (0) — confirms zero build-time dependency on secrets; restored `.env` immediately after
`npm run typecheck` (0)
`npm run lint` (0)
`npm run test` (0) — 15/15 tests pass across 4 files (includes the 6 new deploy-readiness tests)
`npm run dev` + `curl -s http://localhost:3000/` (HTTP 200) — smoke test; response body contains "Adaptive Cut" and the Serbian placeholder copy ("Aplikacija za praćenje ishrane i adaptivno mršavljenje...")

## Decisions made
- Followed the orchestrator's explicit scope reduction: did NOT attempt `vercel login`/`vercel link`/project creation (browser-only OAuth step, cannot be done autonomously). Confirmed via `connections/mcp-registry.md` ("Deferred / keyless" section) and `tech-decisions.md` ("Setup done by orchestrator; needs GitHub repo link + env vars") that this was always the intended split of responsibility.
- Verified build has no build-time dependency on secrets by deleting `.env` entirely and re-running `npm run build` — succeeded identically (0 exit, same page output). This matters because Vercel's very first deploy can happen before every env var is filled in on the dashboard, and it proves no page/route does Supabase/Gemini work at module-import or static-generation time (both `src/lib/supabase/client.ts` and `server.ts` only touch `process.env` inside functions, never at module scope).
- Did not create `vercel.json`. Nothing in the current app needs one (no headers/redirects/crons yet); the spec explicitly said not to invent config — crons arrive with F045/F057/F071.
- Wrote the deploy runbook at `docs/deploy.md` rather than appending to the repo-root `README.md`. That `README.md` is the claude-missions *framework's own* meta-documentation (seven-phase system description), not an app-specific readme — appending app deploy instructions there would conflict with its content and risks the orchestrator's "must not clobber... other features files" touches constraint. `docs/deploy.md` is a clean, additive, app-specific file, consistent with the orchestrator's explicit note that tech-decisions names `docs/deploy.md`.
- Added `src/lib/__tests__/deploy-readiness.test.ts` covering only what's testable from inside the repo (Node 22 pin via `engines`/`.nvmrc`, standard `next build` script Vercel autodetects, presence/completeness of the runbook, no speculative `vercel.json`). Explicitly did not write a test that asserts AS-007's actual behaviour (live HTTPS deploy on push) since that's infrastructure state outside the repo/test runner's reach — documented this reasoning in the test file's header comment so a validator doesn't mistake the narrow scope for an oversight.
- AUTONOMOUS_DECISION: Env var list in `docs/deploy.md` was cross-checked programmatically (via the test suite) against `.env.example` rather than hand-copied, so the table can't silently drift out of sync as later features add more variables — a failing test is the signal to update the doc.

## Out-of-scope work needed
- **The actual Vercel project creation + GitHub repo link** (import repo in the Vercel dashboard, authorize the GitHub App, set env vars from `.env` real values) is the mission's one-time human browser step, per `CLAUDE.md`'s "what the user does" list ("Visit provider websites to sign up and generate credentials") and `mcp-registry.md`'s "Deferred / keyless" note on Vercel. This is not a code task and no future worker can do it either — it needs the mission's human at deploy time. `docs/deploy.md` is the exact checklist for that step.
- **Live verification of AS-007** (push to `main` → watch Vercel dashboard produce a Production deployment reachable over HTTPS) can only happen after the dashboard link above exists. Once it does, this is a one-time manual check (push a small commit, watch the Deployments tab) rather than a new feature — no code work required, just the human following step 6 of `docs/deploy.md`.
- Vercel Cron config (`vercel.json` `crons` block) is intentionally deferred to F045 (weekly TDEE recalc) / F057 (conversation summarization) / F071 (whichever feature owns the daily reminder push job) — do not add it early.

## Blockers
(none — Status is COMPLETE for the automatable scope; AS-007 is DEFERRED, not blocked, per orchestrator instruction. There is no follow-up feature to spawn: the remaining work is a one-time human browser action already documented in `docs/deploy.md`, not something a worker can pick up.)

## Autonomous decisions
AUTONOMOUS_DECISION: Chose `docs/deploy.md` over appending to repo-root `README.md` because the latter is the claude-missions framework's own meta-README, not an app readme — see "Decisions made" above.
AUTONOMOUS_DECISION: Verified env-var-name completeness of the runbook via an automated test against `.env.example` rather than a one-time manual copy, so future features that add env vars get a failing test (not silent doc drift) if they forget to update `docs/deploy.md`.

## Notes for the next worker
- The build-without-`.env` check is cheap and worth repeating any time a new integration (Gemini, PostHog, Sentry, Web Push) is wired in — the invariant "the app must build with zero env vars" should hold through the whole project so Vercel's first deploy from a fresh env-var setup never breaks the build (runtime is a different story; it will legitimately 500 on features that need a real key, but the *build* must not fail).
- No MCP tools were used for this feature — no Vercel MCP tool calls were made (per orchestrator instruction not to attempt login/link), and this feature doesn't touch Supabase's live state.
- `docs/deploy.md` env var table currently mirrors 17 variable names from `.env.example` as of F002; the test `test_AS_007_readiness_deploy_runbook_lists_every_env_var_name_present_in_env_example` will fail (correctly) if a later feature adds a new `.env.example` entry without updating the table — that failure is the signal to update `docs/deploy.md`, not a bug in this feature.
