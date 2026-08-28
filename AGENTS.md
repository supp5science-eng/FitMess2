# FitMess — Agent & Contributor Guide

Working context for anyone (human or AI) editing this codebase. Read this before
making changes. For the product overview see [`README.md`](./README.md).

## What this is

FitMess is a Serbian‑first (sr‑Latn, informal *"ti"*, **zero‑shame**), mobile‑first
calorie & nutrition tracking PWA. Live at **[fitmess.app](https://fitmess.app)**
(phone‑only). The product code lives in **[`claude-missions/`](./claude-missions)**;
the repo root is the build workspace.

- **Stack:** Next.js 16 (App Router / RSC) · React 19 · TypeScript · Tailwind CSS v4
  · shadcn on `@base-ui/react` · Supabase (Postgres + Auth + RLS) · Vercel · zod.
- **Charts are hand‑rolled SVG/CSS** — do not add a charting library.

## Where things live (`claude-missions/src`)

- `app/(app)/` — authenticated screens: `danas` (home), `analitika` (weekly +
  weight), `dodaj/*` (add food), `profil` (settings).
- `app/(auth)/`, `app/admin/`, `app/api/*` — auth flows, food‑catalog admin, route handlers.
- `components/` — `ui/` primitives (Button, Input, **Card**, …), plus feature
  folders: `home/`, `weekly/`, `analytics/`, `food/`, `shell/`, `settings/`.
- `lib/` — pure logic and data access: `week/`, `weight/`, `budget/`, `home/`,
  `dates.ts` (Belgrade day/week helpers), `types/db.ts` (hand‑authored DB types).
- `supabase/migrations/` — schema + RLS, numbered `NNNN_name.sql`, source of truth.

## Conventions (follow the surrounding code)

- **Money‑math rule.** Every number the UI shows is computed in a pure, tested
  `lib/**` function (e.g. `computeWeekSummary`, `computeWeightTrend`) — never
  eyeballed in a component. Add tests next to the logic in `__tests__/`.
- **Dates are Belgrade calendar days.** Never do raw `new Date()` day/week math —
  use `src/lib/dates.ts` (`toBelgradeCalendarDay`, `belgradeWeekDayKeys`, …).
- **RLS enforces ownership.** Every user‑owned table has own‑row policies
  (`… = auth.uid()`); routes use the session‑bound client and never filter on trust.
- **Serbian, zero‑shame copy.** sr‑Latn, informal, calm. Never punitive red for
  going over — over‑target uses a warm accent (`--chart-5`), never `--destructive`.
- **Theme tokens, not hex.** Colors come from CSS custom properties in
  `app/globals.css` (`--primary`, `--card`, `--macro-*`, `--mark-*`, `--brand`, …).
  Don't inline hex.
- **ONE theme — "Gravira".** Ultramarine ink (`--ink` / `--primary`) on pale warm
  paper (`--paper` / `--background`), with a halftone stipple ground (`.app-aurora`,
  `.fm-halftone`) and a letterpress card lift (`.fm-lift`) instead of soft
  shadows. There is no dark palette, no `dark:` variant and no theme cookie —
  `src/app/theme.test.ts` fails the build if one comes back.
- **Cards use the shared `components/ui/card.tsx`** on the `bg-card` surface.
- **Server is the source of truth.** Client mutations POST to `app/api/*`, then
  `router.refresh()` — server components re‑read and re‑render.

## Commands (run from `claude-missions/`)

```bash
npm run dev        # dev server
npm run build      # production build
npm run test       # vitest (unit, component, credential‑gated live integration)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Some `*.integration.test.ts` suites hit a live Supabase and self‑skip without
`SUPABASE_*` credentials in `.env`. Before committing product changes, run
`typecheck`, `lint`, and `test`.

## Database changes

Add a new migration in `supabase/migrations/` (mirror the existing header‑comment
+ RLS style), then update the hand‑authored types in `src/lib/types/db.ts` — the
two are kept in sync manually. Apply migrations to Supabase via the dashboard SQL
editor, the Supabase CLI, or the Management API.

## Feature notes worth reading before touching them

Some features carry a decision history that is expensive to rediscover. Those
live in `claude-missions/docs/`:

- [`docs/klon.md`](./claude-missions/docs/klon.md) — the avatar klon (photos in,
  drawn character out). **Read it before touching anything under
  `src/lib/avatar/`, `src/app/klon`, `src/app/api/klon`, or the klon gate in
  `route-protection.ts`.** It carries what is still unfinished, the switch that
  turns the feature on, and six traps already paid for once.
- [`docs/okret.md`](./claude-missions/docs/okret.md) — the okret (photos in, a
  turnable avatar out). **Read it before touching `src/lib/avatar/okret-prompt.ts`,
  `src/lib/ai/veo.ts`, `src/app/admin/okret`, or `src/app/api/admin/okret`.**
  Carries where the work stopped (the video call), eight traps already paid for
  once, and the decisions that are settled so they are not re-litigated.
- [`docs/pocetna-avatar.md`](./claude-missions/docs/pocetna-avatar.md) — the
  PLAN for putting the okret avatar on the `/danas` home screen. **Read it
  before adding anything to `src/app/(app)/danas/layout.tsx`, the
  `IntakePager`, or before starting `src/lib/avatar/okret.ts`.** Nothing in it
  is built yet; it carries where the avatar goes, the three walls on that
  screen (a third horizontal gesture, the per-day remount, a photograph in an
  engraved theme) and the decisions that are settled.
- [`docs/naplata.md`](./claude-missions/docs/naplata.md) — billing state and the
  two mistakes not to repeat.
- [`docs/prijava-sa-google.md`](./claude-missions/docs/prijava-sa-google.md),
  [`docs/prijava-sa-apple.md`](./claude-missions/docs/prijava-sa-apple.md) — auth
  provider setup.

## How this repo was built

FitMess was generated with the **Claude Missions** multi‑agent workflow; its
docs and mission state live in [`claude-missions/`](./claude-missions) (see
[`claude-missions/README.md`](./claude-missions/README.md) and
[`claude-missions/CLAUDE.md`](./claude-missions/CLAUDE.md)). Those files govern the
*build harness*; this file governs working on the *product code*.
