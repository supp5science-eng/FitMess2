# Connection Manifest

_Generated: 2026-07-17T18:30:00Z_

Credentials go into `.env` (gitignored) only. SDK `npm install`s are deferred to feature F001 (scaffold); credentials are verified now via direct `curl`/CLI so setup does not depend on the not-yet-created project. Remote MCP servers use a token header (not browser OAuth) so non-interactive workers can use them during `/mission-run`.

| # | Service | Type | What I'll set up | What I need from you | Status |
|---|---------|------|------------------|----------------------|--------|
| 1 | Supabase | mcp + api/database | Register Supabase remote MCP via `claude mcp add --transport http` (scoped to your project, token header); write `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` to `.env`; verify | Project URL, publishable key (`sb_publishable_…`), secret key (`sb_secret_…`), personal access token (`sbp_…`) | PASS |
| 2 | Google Gemini | api | Write `GEMINI_API_KEY` to `.env`; verify against models list. Powers **both** the agent (gemini-3.5-flash) and vision. | API key (from Google AI Studio) | PASS |
| ~~3~~ | ~~Anthropic~~ | ~~api~~ | **Removed 2026-07-17** — agent consolidated onto Gemini (billing block + single provider) | — | DROPPED |
| 4 | Google OAuth | oauth-app | Write `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to `.env`; enable + configure the Google provider in Supabase Auth via Management API | OAuth client ID + client secret | PASS |
| 5 | PostHog (EU) | api | Write `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` to `.env`; verify | Project API key (EU region, `phc_…`) | PASS |
| 6 | Sentry | api | Write `SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT` for sourcemaps) to `.env`; verify DSN reachable | DSN; optionally an auth token | PASS |
| 7 | Web Push (VAPID) | orchestrator-only | Generate a VAPID keypair myself; write `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` to `.env` | Nothing — fully automated | PASS |
| 8 | Open Food Facts | none | No account, no key — public API v2 used at import time (F022) | Nothing | N/A |
| 9 | Vercel | deferred | Hosting + crons. Project link, env vars, and git integration are browser/dashboard steps done at first deploy (F004) | Deferred to deploy | DEFERRED |

## Notes

- **Supabase MCP scope:** registered with `project_ref` so it can only touch this one project; NOT read-only (workers run migrations in F010/F020/etc.).
- **Google OAuth ordering:** placed after Supabase because the redirect URI Google needs is `https://<project-ref>.supabase.co/auth/v1/callback`, which I compute from your Supabase URL.
- **Open Food Facts & Vercel** require no credential in `.env`; they are tracked here for completeness. OFF is used by an import script; Vercel is configured in its dashboard at deploy time.
- **Never in `.env` or chat:** credit cards, banking, government IDs. Only developer credentials for your own resources.
