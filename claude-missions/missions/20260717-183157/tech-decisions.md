# Tech decisions

_All versions verified via web search / npm registry on 2026-07-17. PRD deviations noted inline._

## Stack

- Language: TypeScript ^5.9 <!-- pinned to 5.x deliberately: TypeScript 7.0 (native compiler) went GA 2026-07-08 but Next.js 16.2 support is still landing (experimental.useTypeScriptCli in 16.3 preview) — verified against https://github.com/vercel/next.js/discussions/95633 and https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ as of 2026-07-17; revisit at Next 16.3 -->
- Framework: Next.js 16.2.x (App Router, React 19.2) <!-- 16.2.10 latest stable per npm + https://endoflife.date/nextjs as of 2026-07-17 -->
- Styling: Tailwind CSS 4.x + shadcn/ui (`npx shadcn@latest init`) <!-- tailwindcss 4.3.3 on npm; shadcn Tailwind-v4 support verified against https://ui.shadcn.com/docs/tailwind-v4 as of 2026-07-17 -->
- Database/Backend: Supabase (Postgres, Auth, Storage, RLS) <!-- verified against https://supabase.com/docs as of 2026-07-17 -->
- Auth keys: **new publishable/secret key format** — `sb_publishable_...` client-side, `sb_secret_...` server-only; legacy anon/service_role keys are being deprecated by end of 2026 <!-- verified against https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys as of 2026-07-17 -->
- Hosting: **Vercel** (user decision in discovery Q21 — supersedes PRD's Cloudflare Pages; avoids the Next-on-Cloudflare adapter friction). Hobby plan during the free, non-commercial beta; upgrade to Pro before any monetization (Hobby prohibits commercial use) <!-- verified against https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines as of 2026-07-17 -->
- **Agent + Vision AI: Google Gemini API, model `gemini-3.5-flash` for both** <!-- AMENDED 2026-07-17 (post-APPROVED): agent moved from Anthropic Claude to Gemini after the user hit Anthropic billing failures and chose to consolidate on one provider. No contract assertion names Anthropic (AS-081–AS-101 are provider-agnostic), so this is a clean swap. Design safety: redistribution math is deterministic code (AS-086), so the agent LLM only handles Serbian phrasing + structured JSON — well within Flash range. gemini-3.5-flash chosen over Flash-Lite to preserve agent tone quality. Verified against https://ai.google.dev/gemini-api/docs/models as of 2026-07-17 (3.5 Flash GA 2026-05-19, behind gemini-flash-latest). Cheaper vision fallback if photo volume demands: gemini-3.1-flash-lite. Agent-on-Claude remains a documented v2 A/B option. -->
  - Agent: `gemini-3.5-flash` — streaming chat; structured output via `responseMimeType: "application/json"` + `responseSchema`
  - Vision: `gemini-3.5-flash` — label reading + meal-photo estimation (multimodal), same JSON-schema mechanism
- Runtime: Node.js 22 LTS (Vercel default for Next 16)

## Libraries used

- `next` ^16.2.10 — framework (npm latest 2026-07-17)
- `react` / `react-dom` ^19.2.7 — installed by create-next-app
- `@supabase/supabase-js` ^2.110.7 — Supabase client (npm 2026-07-17)
- `@supabase/ssr` ^0.12.3 — cookie-based auth for App Router; replaces deprecated `@supabase/auth-helpers` <!-- https://supabase.com/docs/guides/auth/server-side -->
- `@google/genai` ^2.12.0 — official Gen AI JS SDK for Gemini; powers **both** the agent chat/streaming/structured-output **and** vision; replaces deprecated `@google/generative-ai` <!-- https://www.npmjs.com/package/@google/genai, https://ai.google.dev/gemini-api/docs/libraries. AMENDED 2026-07-17: now the sole AI SDK — @anthropic-ai/sdk removed (see Stack note). -->
- `barcode-detector` ^3.2.1 — BarcodeDetector API polyfill backed by ZXing WASM; deterministic client-side EAN-13 decoding, zero API cost (npm 2026-07-17)
- `recharts` ^3.9.2 — weight trend chart (npm 2026-07-17)
- `zod` ^4.4.3 — schema validation + agent structured-output schemas (npm 2026-07-17)
- `posthog-js` ^1.404.0 — analytics, EU cloud host `https://eu.i.posthog.com` <!-- https://posthog.com/docs/getting-started/install -->
- `@sentry/nextjs` ^10.66.0 — error monitoring (npm 2026-07-17)
- `serwist` / `@serwist/next` ^9.5.11 — service worker / PWA (npm 2026-07-17)
- `web-push` ^3.6.7 — VAPID Web Push for the daily reminder (npm 2026-07-17)
- `vitest` ^4.1.10 — unit tests (npm 2026-07-17)
- `tailwindcss` ^4.3.3 + `shadcn/ui` (CLI-generated components) — UI

## Libraries explicitly avoided

- `html5-qrcode` — unmaintained per 2026 ecosystem reviews; superseded by ZXing-WASM-based `barcode-detector` <!-- https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/ -->
- `@zxing/browser` / `@zxing/library` — pure-JS port, slower and less active than the WASM path; `barcode-detector` wraps ZXing WASM behind the standard API
- `next-pwa` (5.6.0) — stale since 2022; Serwist is its maintained successor
- `@supabase/auth-helpers-nextjs` — deprecated in favor of `@supabase/ssr`
- `@google/generative-ai` — legacy Gemini SDK; `@google/genai` is where new features land
- `typescript@7` — Next.js 16.2 compatibility not yet stable (see Stack note); pin 5.9 and revisit
- Legacy Supabase `anon`/`service_role` JWT keys — replaced by `sb_publishable_`/`sb_secret_` keys
- NextAuth/Auth.js, Lucia/better-auth — unnecessary; Supabase Auth covers email + Google OAuth
- Quagga/QuaggaJS — abandoned barcode library

## File layout

```
/ (repo root = Next.js app)
├── supabase/
│   ├── migrations/          # SQL migrations (profiles, foods, logs, weigh_ins, adjustments, ai_usage, conversations)
│   └── seed/                # foods.json curated seed data
├── scripts/                 # seed-foods.ts, import-off.ts
├── src/
│   ├── app/
│   │   ├── (auth)/          # prijava, registracija
│   │   ├── (app)/           # danas, nedelja, agent, profil, onboarding, dodaj/*
│   │   ├── admin/           # hrana (queue/editor), korisnici, troskovi
│   │   └── api/             # agent, vision, foods, logs, export, push, cron/*
│   ├── components/          # shell, home, food, scan, photo, chat, weekly, onboarding
│   └── lib/
│       ├── supabase/        # client.ts, server.ts, middleware.ts
│       ├── budget/          # engine, weekly, redistribute, streak, effective, rules (+tests)
│       ├── ai/              # anthropic, gemini, context, prompts, schema, caps
│       └── food/            # translit, search, portions
├── public/                  # manifest.json, icons
└── .env.example
```

## External services needed

- **Supabase** — Postgres + Auth + Storage. Official MCP available (remote: `https://mcp.supabase.com/mcp`, OAuth login, no PAT needed; also installable as Claude Code plugin) <!-- https://supabase.com/docs/guides/ai-tools/mcp as of 2026-07-17 -->. Needs: project URL, `sb_publishable_` key, `sb_secret_` key. Worker use: yes (schema, migrations, RLS verification).
- **Google Gemini API** — **agent AND vision** (single provider as of 2026-07-17 amendment). SDK direct via AI Studio API key. Needs: `GEMINI_API_KEY`.
- ~~Anthropic API~~ — **removed 2026-07-17**; agent consolidated onto Gemini (billing block + single-provider simplification).
- **Vercel** — hosting + crons. Official MCP available (remote, OAuth, beta) <!-- https://vercel.com/docs/agent-resources/vercel-mcp -->. Setup done by orchestrator; needs GitHub repo link + env vars.
- **Google Cloud Console** — OAuth client ID/secret for Google sign-in (browser-only signup by user; values pasted into Supabase Auth settings by orchestrator).
- **PostHog Cloud EU** — analytics. Official MCP available (`https://mcp.posthog.com/mcp`) <!-- https://posthog.com/docs/model-context-protocol -->. Needs: project API key (EU region).
- **Sentry** — errors. Official remote MCP available <!-- vendor remote MCP, Feb 2026 -->. Needs: DSN (+ auth token for sourcemaps).
- **Open Food Facts** — one-time import via public API v2 (`https://world.openfoodfacts.org/api/v2/product/{barcode}`); no key, no MCP needed <!-- https://openfoodfacts.github.io/openfoodfacts-server/api/ -->.
- **Web Push (VAPID)** — no external account; orchestrator generates VAPID key pair into `.env`.

## How to run the app

```
npm run dev
```

## How to run tests

```
npm run test
```

## How to run linter

```
npm run lint
```

## How to run type-check

```
npm run typecheck
```

## Conventions

- **Language:** All UI copy in Serbian latin (sr-Latn), informal "ti" form. Route segments in Serbian (prijava, danas, nedelja, dodaj). Code identifiers/comments in English.
- **Timezone:** All day/week boundaries in Europe/Belgrade via the shared `src/lib/dates.ts` utilities — never raw `new Date()` day math.
- **Money-math rule:** Budget, TDEE, redistribution, streak, and proration are pure functions in `src/lib/budget/` with unit tests. LLMs never compute these numbers; they only phrase them.
- **AI calls:** Server-side only (API routes / server actions). Both agent and vision use `gemini-3.5-flash` via `@google/genai`. Every call goes through the caps middleware and logs to `ai_usage` (provider column = `gemini`). Structured outputs use Gemini `responseMimeType: "application/json"` + `responseSchema`, then validated with zod; one retry on parse failure, then a Serbian error.
- **Secrets:** `sb_secret_`, `GEMINI_API_KEY`, VAPID private key are server-only env vars — never in client bundles, never in markdown, always in `.env` (gitignored) with placeholders in `.env.example`.
- **Database:** Every user table has RLS with own-row policies; foods are shared-read, admin-write (user inserts allowed for crowdsourcing). Schema changes only via `supabase/migrations/` SQL files. Log rows snapshot food name + macros (immune to later food edits).
- **Errors:** User-facing errors in Serbian, friendly, never technical. Server errors to Sentry with scrubbed payloads.
- **Components:** shadcn/ui primitives + Tailwind; mobile-first at 375px; single accent color from theme tokens; no dark mode.
- **Testing:** Vitest for pure logic (budget, redistribution, translit, portions, dates) and API route handlers. Every worker runs test/lint/typecheck before commit.
- **Commits:** Conventional-ish, one feature per commit, reference feature ID (e.g. `F053: redistribution engine`).
