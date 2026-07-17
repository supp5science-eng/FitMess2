# Deploying Adaptive Cut to Vercel

**Assertion:** AS-007 — a push to `main` triggers an automatic production
deployment over HTTPS.

## Why this is a one-time manual step

Vercel deployments are triggered by a **project ↔ GitHub repo link** that is
created once, interactively, in the Vercel dashboard (OAuth into Vercel,
authorize the GitHub App, pick the repo). There is no way to complete that
OAuth/App-install handshake from an automated script or CI job — it requires
a signed-in human in a browser. Everything else (build config, env var
*names*, runtime target) is code-side and is already in place; this doc is
the checklist for that one remaining browser step.

Once the link exists, Vercel's own GitHub integration handles AS-007
automatically forever after: every push to `main` redeploys production over
HTTPS, and every other branch/PR gets a preview deployment. No further app
code or Vercel config is needed for that behavior.

## Code-side readiness (already done, verified by this repo's tests/build)

- Next.js 16.2 App Router project at the repo root — Vercel autodetects this
  framework with zero extra config.
- `package.json` → `"engines": { "node": "22.x" }` and a root `.nvmrc`
  pinning Node 22, matching Vercel's current Node 22 LTS runtime.
- `npm run build` (`next build`) produces a clean production build **with no
  environment variables set at all** — verified by building with `.env`
  temporarily removed. No page or route does AI/DB work at module-import
  time or during static generation; Supabase/Gemini clients are only
  instantiated inside request-time functions. This means the first deploy
  will succeed even before every env var below is filled in on Vercel, and
  the build will never silently mask a real runtime error as a build
  failure.
- No `vercel.json` is committed. Nothing in the app yet needs one (no custom
  headers/redirects/crons at this milestone — Vercel Cron config lands with
  the features that need it, e.g. the weekly recalculation and conversation
  summarization jobs). Adding an empty or speculative `vercel.json` now
  would be dead config; skipped deliberately.

## One-time steps a human does in the Vercel dashboard

1. Go to https://vercel.com/new and sign in (or create a Hobby-plan
   account — Hobby is fine while the app is free/non-commercial per
   `tech-decisions.md`; upgrade to Pro before any monetization).
2. **Import the GitHub repo** for this project. Authorize the Vercel GitHub
   App for this repo (or the whole account/org) when prompted — this is the
   step that makes `git push` to `main` auto-deploy.
3. In the import screen (or Project Settings → General afterward):
   - **Root Directory:** repo root (leave as `.` / default — this is a
     single Next.js app at the repo root, not a monorepo subpackage).
   - **Framework Preset:** Next.js (auto-detected).
   - **Node.js Version:** 22.x (matches `engines` / `.nvmrc`; set explicitly
     in Project Settings → General → Node.js Version if Vercel's project
     default ever drifts from 22).
   - **Build Command / Output:** leave as Vercel's Next.js defaults
     (`next build`, `.next`) — do not override.
4. In Project Settings → Environment Variables, add every variable below for
   the **Production** environment (and Preview, if preview deploys should
   also talk to live services). Copy the real values from the local `.env`
   file — **never paste them into this repo or into chat**; this doc lists
   variable *names* only, per `mcp-registry.md` and `tech-decisions.md`.

   | Variable | Scope |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
   | `SUPABASE_PUBLISHABLE_KEY` | Production + Preview |
   | `SUPABASE_SECRET_KEY` | Production only (server-only secret) |
   | `GEMINI_API_KEY` | Production only (server-only secret) |
   | `GEMINI_MODEL` | Production + Preview |
   | `GOOGLE_CLIENT_ID` | Production + Preview |
   | `GOOGLE_CLIENT_SECRET` | Production only (server-only secret) |
   | `NEXT_PUBLIC_POSTHOG_KEY` | Production + Preview |
   | `NEXT_PUBLIC_POSTHOG_HOST` | Production + Preview |
   | `SENTRY_DSN` | Production only (server-only secret) |
   | `NEXT_PUBLIC_SENTRY_DSN` | Production + Preview |
   | `SENTRY_ORG` | Production + Preview |
   | `SENTRY_PROJECT` | Production + Preview |
   | `VAPID_PUBLIC_KEY` | Production only (server-only secret) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Production + Preview |
   | `VAPID_PRIVATE_KEY` | Production only (server-only secret) |
   | `VAPID_SUBJECT` | Production + Preview |

   (This list is the full set of variable names in `.env.example` as of
   F004. Later features may add new server-side integrations — keep this
   table and `.env.example` in sync when that happens.)
5. Click **Deploy**. Vercel builds and deploys; the resulting `*.vercel.app`
   URL (and any custom domain added later in Project Settings → Domains) is
   served over HTTPS automatically — Vercel issues and renews TLS
   certificates for every domain it serves, no extra config needed.
6. Confirm the link worked: push a small commit to `main` and watch the
   Vercel dashboard's Deployments tab show a new **Production** deployment
   triggered by that commit, reachable over HTTPS. This is the live
   verification of AS-007 and is the one part of this feature that cannot
   be automated — see the handoff for this feature
   (`missions/20260717-183157/handoffs/F004-handoff.md`) for why it is
   deferred rather than blocked.

## Preview deployments

No extra setup: once the GitHub repo is linked (step 2 above), every branch
push and pull request automatically gets its own Preview deployment with its
own HTTPS URL, per Vercel's default Git integration behavior. Preview
environment variables use the same table above (Preview column) if the
preview environment should hit live services rather than being deploy-only
smoke tests.
