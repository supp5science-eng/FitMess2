# FitMess

> **Praćenje kalorija bez griže savesti.** Serbian‑first calorie & nutrition
> tracker built around one idea: the *week* is the unit of success, not any
> single bad day.

FitMess is a mobile‑first PWA that helps you hit a personalized calorie and
macro budget — log meals in seconds, see where you stand today, and watch your
weight trend move toward your goal. The tone is deliberately **zero‑shame**:
no punitive red, no "you failed", just calm signal and a plan you can keep.

🔗 **Live:** [fitmess.app](https://fitmess.app) · 📱 phone‑only (open it on your
phone — desktop shows a QR to hand off)

---

## What you can do

- 🎯 **Personalized plan** — a short onboarding wizard turns your body stats,
  activity, and goal (maintain · lose · gain · tone) into a daily calorie +
  protein/carbs/fat budget.
- 🍽️ **Log a meal in seconds** — search a shared food catalog, pick a portion
  (grams or common units), or add your own product. Barcode scan, nutrition‑label
  photo, and meal photo are on the roadmap (they route to a clear *"uskoro"*
  placeholder until then).
- 📊 **Today at a glance** (`/danas`) — a calorie ring, macro bars, and a
  consumed ↔ remaining toggle over a scrollable date strip.
- 📈 **Weekly analytics** (`/analitika`) — a weekly budget ring, per‑day bars
  with a target line, an on‑track status, 30‑day meal history, **and a weight
  trend chart** with a 7‑day rolling average and a goal line.
- ⚖️ **Weight tracking** — record your weight in a tap; the chart plots the
  smoothed trend (not scary daily noise) and how far you are from your goal.
- ⚙️ **Settings & privacy** (`/profil`) — goal, personal data, eating rules,
  plus GDPR‑style **data export** and account deletion.
- 🤖 **FitMess Agent** (`/agent`) — a conversational logging assistant, coming
  soon.

Everything is in Serbian (sr‑Latn), informal *"ti"*, mobile‑first at 375px, and
printed in one theme — **"Gravira"**: a vivid ultramarine ink on pale warm
paper, with a halftone stipple ground. There is no light/dark switch.

---

## Tech stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router, React Server Components) + React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 (CSS‑first tokens) · shadcn on `@base-ui/react` · lucide‑react |
| **Backend** | Supabase — Postgres, Auth, Row‑Level Security |
| **Hosting** | Vercel (deploys + crons) |
| **Charts** | Hand‑rolled SVG/CSS — no charting library |
| **Validation** | zod |
| **Observability** | PostHog (EU, consent‑gated) · Sentry (EU) |
| **Extras** | Web Push (PWA notifications) · `barcode-detector` · Gemini (vision/agent) |

Charts are deliberately dependency‑light: the calorie ring, day bars, and
weight trend are all drawn by hand in SVG.

---

## Project structure

The product lives under [`claude-missions/`](./claude-missions); the repository
root is the build workspace it was created in (see
[*How this was built*](#how-this-was-built)).

```
claude-missions/
├── src/
│   ├── app/
│   │   ├── (app)/            # authenticated shell (bottom nav)
│   │   │   ├── danas/        # home — daily calorie ring + meals
│   │   │   ├── analitika/    # weekly dashboard + weight trend
│   │   │   ├── dodaj/        # add food: search, portion, scanner, label, photo
│   │   │   ├── agent/        # FitMess Agent (coming soon)
│   │   │   └── profil/       # settings, goal, data, privacy, appearance
│   │   ├── (auth)/           # sign in / up, password reset, phone
│   │   ├── admin/            # food catalog review queue
│   │   └── api/              # route handlers (logs, weigh-ins, export, …)
│   ├── components/           # ui/, home/, weekly/, analytics/, food/, shell/, …
│   └── lib/                  # week/, weight/, budget/, dates, types/db.ts, …
└── supabase/migrations/      # schema, RLS policies (source of truth)
```

### Data model (Supabase)

| Table | What it holds |
|---|---|
| `profiles` | body stats, activity, goal, eating rules |
| `targets` | daily/weekly kcal + macro targets, goal weight (newest wins) |
| `foods` | shared, crowd‑sourced food catalog (per‑100g macros, barcodes) |
| `logs` | user meal entries (macros snapshotted at log time) |
| `weigh_ins` | daily weight entries (one per Belgrade calendar day) |

Every user‑owned table is protected by own‑row RLS policies (`… = auth.uid()`) —
access control lives in the database, not in trust.

---

## Getting started (local dev)

```bash
cd claude-missions
npm install
cp .env.example .env      # fill in Supabase + service keys
npm run dev               # http://localhost:3000
```

Apply the SQL migrations in `supabase/migrations/` to your Supabase project (via
the dashboard SQL editor, the Supabase CLI, or the Management API) so the schema
and RLS policies exist.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest — unit, component, and (credential‑gated) live integration tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Pure logic (calorie budget, weekly summary, weight trend) is unit‑tested with a
"money‑math" rule: every number the UI shows is computed and tested in `src/lib`,
never eyeballed in a component.

---

## How this was built

FitMess was built end‑to‑end with **Claude Missions** — a multi‑agent Claude Code
workflow that drives a project from a one‑line idea to a tested codebase through
seven guided phases (scope → discover → plan → connect → tasks → run → done). The
mission state, feature specs, and validation contract live under
[`claude-missions/missions/`](./claude-missions/missions), and the framework
itself is documented in
[`claude-missions/README.md`](./claude-missions/README.md).

---

<sub>Adaptive Cut Companion — a Serbian fitness app. Built with Next.js, Supabase,
and Claude Code.</sub>
