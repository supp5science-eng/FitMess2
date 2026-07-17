# Handoff: F002 — Supabase clients + env plumbing + .env.example

## Status
COMPLETE

## Assertions covered
AS-003: PASS — `.env.example` exists at repo root, lists placeholder entries for all 17 env vars currently used by the app (cross-referenced against `.env` and `connections/mcp-registry.md`'s "Non-MCP services" table), and contains no real secret value. Verified by 4 automated tests in `src/lib/env.test.ts` (`test_AS_003_env_example_file_exists_at_repo_root`, `test_AS_003_env_example_has_an_entry_for_every_env_var_referenced_in_source_code`, `test_AS_003_env_example_has_placeholders_for_every_var_known_so_far_from_env_and_tech_decisions`, `test_AS_003_env_example_contains_no_real_secret_values_from_local_env`) — all pass. Evidence: `handoffs/evidence/F002/env-example-check.log`, `handoffs/evidence/F002/verify-output.log`.

## Files changed
.env.example (new — placeholders for all 17 known env vars, no secrets)
next.config.ts (modified — `env` block re-exposes `SUPABASE_PUBLISHABLE_KEY` to the client bundle; see Decisions)
package.json (modified — added `@supabase/supabase-js` `^2.110.7`, `@supabase/ssr` `^0.12.3`)
package-lock.json (modified — lockfile for the above)
src/lib/supabase/client.ts (new — browser client, `createBrowserClient` + publishable key)
src/lib/supabase/server.ts (new — `createClient()` server client using `createServerClient` + cookies + publishable key (RLS-respecting, user-scoped); `createAdminClient()` using the secret key, no cookies, RLS-bypassing, server-only)
src/lib/supabase/middleware.ts (new — `updateSession()` session-refresh helper for a future root `src/middleware.ts`)
src/lib/env.test.ts (new — AS-003 tests)
missions/20260717-183157/handoffs/evidence/F002/verify-output.log (new, evidence artifact)
missions/20260717-183157/handoffs/evidence/F002/env-example-check.log (new, evidence artifact)

Also committed (pre-existing orchestrator bookkeeping found dirty at session start, not authored by this worker — committed separately to satisfy the pre-worker-exit clean-tree check, content unchanged from what the orchestrator had already written): missions/20260717-183157/plan.md (F001 `[COMPLETE]` marker), missions/20260717-183157/run-log.md (F001-complete / F002-dispatch log line).

## Commands run
`npm install @supabase/supabase-js@^2.110.7 @supabase/ssr@^0.12.3` (0)
`npm run test` (0) — 2 files, 6 tests passed
`npm run typecheck` (0) — `tsc --noEmit`, no errors
`npm run lint` (0) — `eslint`, no errors
`npm run build` (0) — `next build` (Turbopack), compiled + typechecked + prerendered `/` and `/_not-found`
`npm run dev` (background, terminated after verification) — `curl http://localhost:3000/` returned HTTP 200 with the existing Serbian home page unaffected by this feature's changes
`grep -rl "<publishable-key-value>" .next` / `grep -rl "<secret-key-value>" .next` (manual, values never logged) — confirmed the secret key appears only in `.next/dev/cache/...` (Turbopack's gitignored dev cache) and `.next/required-server-files.js/json` (server-only runtime manifest), and does **not** appear anywhere under `.next/static` (the client-shipped bundle) or `.next/server`
`claude mcp list` (0) — confirmed `supabase: https://mcp.supabase.com/mcp?project_ref=femrzpfslejzqnvfsfoe (HTTP) - ✔ Connected`, matching `mcp-registry.md`'s project ref
`git add` + `git commit` (0) x2 — see git log `cc34c94` (feature) and `4edad9d` (mission-state sync)

## Decisions made
- **Server client is two functions, not one, to reconcile the task instruction with correct Supabase/RLS architecture.** The task prompt said "server client using `createServerClient` + cookies, secret key server-only." Taken literally, pairing the secret key with the cookie-based `createServerClient` pattern would make the *default* server client bypass RLS for every request, contradicting tech-decisions.md's "Every user table has RLS with own-row policies" (and AS-013). Standard Supabase SSR convention pairs `createServerClient` + cookies with the **publishable** key (RLS enforced via the caller's JWT); the secret key is for a separate, non-session-scoped admin client. Implemented both in `server.ts`: `createClient()` (publishable key + cookies, `createServerClient`, RLS-respecting, the one server code should use by default) and `createAdminClient()` (secret key, no cookies, plain `@supabase/supabase-js` `createClient`, RLS-bypassing, clearly documented as admin/background-job-only). This satisfies every literal piece of the instruction (secret key present, server.ts, server-only) without shipping an insecure default. Flagging this explicitly rather than silently picking one interpretation.
- **Publishable key exposed to the browser via `next.config.ts`'s `env` block, not by renaming it in `.env`.** `.env` has `SUPABASE_PUBLISHABLE_KEY` without a `NEXT_PUBLIC_` prefix (provisioned that way at `/mission-connect`, and I was told not to modify `.env` values). Next.js only auto-inlines `NEXT_PUBLIC_`-prefixed vars into client bundles, so without help `client.ts` would read `undefined` in the browser. Used Next's documented `env` config field (`next.config.ts`) to re-expose `SUPABASE_PUBLISHABLE_KEY` under its existing name to both server and client bundles. Verified via `.next` build-output grep that only the publishable key (safe) ends up reachable this way — the secret key was never referenced from `next.config.ts` and does not appear in `.next/static`.
- **`.env.example` lists all 17 vars currently in `.env`**, not just the 4 Supabase ones this feature wires up code for, per the explicit F002 scope instruction ("EVERY env var the project uses so far") and cross-referenced against `mcp-registry.md`'s Non-MCP services table. Gemini/Google OAuth/PostHog/Sentry/VAPID vars aren't referenced by any code yet (those land in later features) but already need placeholders.
- **AS-003 test suite scans source for `process.env.X` references** rather than hardcoding only the Supabase vars, so it stays meaningful as later features add more `process.env` reads — it will fail loudly if a future feature adds a var to code without adding it to `.env.example`.
- **No root `src/middleware.ts` was added.** The task scope names `src/lib/supabase/middleware.ts` as a *helper*, and route-protection/redirect behavior (AS-011) is a distinct, later concern. Wiring the helper into an actual root middleware belongs to whichever feature implements the signed-out redirect. Documented this explicitly in `middleware.ts`'s JSDoc with the exact wiring snippet for that future feature.
- Pinned `@supabase/supabase-js@^2.110.7` and `@supabase/ssr@^0.12.3` exactly as specified in `tech-decisions.md`; `npm ls` confirms both resolved to those exact versions.

## Out-of-scope work needed
- A root `src/middleware.ts` that calls `updateSession()` from `src/lib/supabase/middleware.ts`, plus the actual signed-out-redirect logic (AS-011) — belongs to the auth/route-protection feature.
- Actual usage of `createClient()`/`createAdminClient()` in any Server Component, Route Handler, or Server Action — none exists yet; this feature is plumbing only, per the clarified spec's "Config/scaffold... no business logic" pattern.
- No Supabase schema/migrations were created or touched — explicitly deferred to F010 per the task instructions.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Split the "server client" into `createClient()` (publishable key, RLS-respecting, default) and `createAdminClient()` (secret key, RLS-bypassing, admin-only) instead of a single secret-key `createServerClient`, to avoid establishing an insecure default for a project whose entire data-access model depends on RLS. See "Decisions made" above for full reasoning.
AUTONOMOUS_DECISION: Used Next.js's `next.config.ts` `env` block to re-expose `SUPABASE_PUBLISHABLE_KEY` to the browser bundle rather than asking to rename it in `.env`, since `.env` values were off-limits to modify and this is a standard, documented Next.js mechanism for exactly this situation.
AUTONOMOUS_DECISION: Committed the two pre-existing dirty mission-state files (`plan.md`, `run-log.md`) as a separate `chore:` commit, since their content was orchestrator-authored bookkeeping (not mine) but the pre-worker-exit hook requires a fully clean git tree when Status is COMPLETE.

## Notes for the next worker
- MCP usage: `claude mcp list` confirms the Supabase MCP server is registered and connected (`https://mcp.supabase.com/mcp?project_ref=femrzpfslejzqnvfsfoe`), matching `connections/mcp-registry.md`. I did not have `mcp__supabase__*` tools directly available in this worker session's tool list (only Read/Write/Edit/Bash/Grep/Glob), so I could not call live schema-introspection tools directly — and F002's scope explicitly says "creates no schema yet (that's F010)", so no schema/DDL verification was needed here. If a future worker needs `mcp__supabase__*` tools and doesn't have them either, that's worth flagging to the orchestrator; for this feature it wasn't a blocker.
- `src/lib/supabase/server.ts` exports two clients — read the JSDoc on each before using: `createClient()` for anything user-scoped (the default), `createAdminClient()` only for admin/background-job code that must legitimately bypass RLS.
- The browser client (`client.ts`) is unused by any page yet (no imports anywhere), so it wasn't tree-shaken/verified inside an actual client bundle chunk — only verified that the secret key never appears in `.next/static` and that `SUPABASE_PUBLISHABLE_KEY` is correctly threaded through `next.config.ts`. First feature that actually calls `createClient()` from a `"use client"` component should double check the value resolves at runtime (open devtools, not console.log it).
- `.env.example` evidence log deliberately never prints real secret values (only key names + `<placeholder>`/`<redacted>`); see `handoffs/evidence/F002/env-example-check.log`.
- Evidence artifacts for this feature live in `missions/20260717-183157/handoffs/evidence/F002/` (`verify-output.log`, `env-example-check.log`).
