# M1 Foundation — Scrutiny Report

**Mission:** 20260717-183157 (Adaptive Cut Companion)
**Milestone:** M1 — Foundation (F001–F005)
**Reviewer:** scrutiny-validator (adversarial, read-only)
**Date:** 2026-07-17
**Verdict:** PASS — all in-scope assertions met. AS-007 correctly DEFERRED, not failed.

The reviewer independently re-ran the full toolchain on a clean tree (test, lint,
typecheck, production build), started the production server and curled `/`, and grepped
the compiled client bundle for real secret values. Findings are based on the code and
live artifacts, not the worker handoffs.

## Assertion results

| ID | Verdict | Reason |
|----|---------|--------|
| AS-001 | PASS | `npm run build` succeeds clean (Next 16.2.10 Turbopack, 4 static routes); `npm start` serves `/` HTTP 200 with no errors. Reproduced. |
| AS-002 | PASS | `/` renders genuine Serbian body copy "Aplikacija za pracenje ishrane i adaptivno mrsavljenje..." plus sr-Latn nav labels. Verified in live HTML. See minor note on `lang`. |
| AS-003 | PASS | `.env.example` lists all 17 vars, name-for-name identical to `.env`. No real secret/publishable/url/gemini value appears verbatim in `.env.example` (grep by value: 0 matches). `.env` untracked; only `.env.example` in git. |
| AS-004 | PASS | `npm run test` -> 7 files, 28 tests, all green. Reproduced. |
| AS-005 | PASS | `npm run lint` -> exit 0, zero errors/warnings. Reproduced. |
| AS-006 | PASS | `npm run typecheck` (`tsc --noEmit`, strict:true) -> exit 0, zero errors. Reproduced. |
| AS-007 | DEFERRED (out of scope) | Live Vercel auto-deploy needs a one-time browser GitHub-link. Not counted against M1 per orchestrator directive. Code-side readiness (Node 22 pin, standard `next build`, runbook `docs/deploy.md`, build-without-`.env`) present and tested. |
| AS-125 | PASS (fragile test) | Shell forces `overflow-x-hidden` on html/body AND on the `max-w-[430px]` column; at 375px the placeholder screen has no horizontal scroll. See fragility note. |
| AS-126 | PASS | `AppShell` is a full-width `bg-muted` wrapper with an `mx-auto max-w-[430px] bg-background` inner column — a genuine centered mobile-width column on desktop. Code + evidence screenshot at 1440px. |
| AS-127 | PASS | Single green accent `#16a34a` drives --primary/--ring/--sidebar-primary/--sidebar-ring; --accent/--accent-foreground are same-hue tints; charts grayscale; --background white; `.dark` block inert. Only other non-neutral token is semantic --destructive (red), not a brand accent. |

## Security check (explicitly requested)

- Secret key does NOT reach the client bundle. After a production build the real
  SUPABASE_SECRET_KEY value appears in 0 files under `.next/static`. It appears only in
  `.next/dev/cache/turbopack/*.sst` (gitignored dev cache, not shipped).
- `next.config.ts` env block re-exposes ONLY SUPABASE_PUBLISHABLE_KEY; the secret is
  never referenced there. SUPABASE_SECRET_KEY is read solely inside `createAdminClient()`
  in `src/lib/supabase/server.ts` (server module, no "use client").
- Publishable key also shows 0 matches in `.next/static` — expected, no client component
  imports `createClient()` yet (plumbing only). Not a defect; re-check at runtime when the
  first browser client mounts.
- `.env.example` has no real values; `.env` is not tracked by git.

## Failures / weaknesses

No blockers. No majors that fail an assertion. Recorded for follow-up:

- minor (AS-002): `<html lang="sr">` is used, not `lang="sr-Latn"` as the spec/plan named.
  Visible text is genuinely Latin-script Serbian, so the assertion (about visible text) is
  met. Recommend `lang="sr-Latn"` for precision ahead of AS-124 locale/a11y work.
- minor/fragile (AS-125, AS-126, AS-127): the unit tests are structural string-matches
  against source (className contains `max-w-[430px]`/`overflow-x-hidden`/`mx-auto`;
  globals.css contains `--primary: #16a34a`). jsdom computes no layout or CSS cascade, so
  these tests would still pass if a future screen overflowed horizontally, dropped the
  centered column, or introduced a second accent inside a component. They confirm the
  implementation, not the behavior. Correct today for the placeholder shell (verified via
  live render + screenshots), so PASS — but true behavioral proof must come from the UX
  validator against real 375px/desktop renders and be re-checked as each core screen lands.
  Do not treat the green suite as coverage of these three assertions on future screens.
- minor (AS-125 approach): "no horizontal scroll" is partly achieved by
  `overflow-x-hidden`, which hides overflow rather than preventing it and can mask a real
  layout bug while the toolchain stays green. UX validator should confirm content actually
  fits at 375px rather than being clipped.

## Recommended follow-up features (specs for the orchestrator to formalize)

1. Set the document locale to `sr-Latn` and add a locale regression guard. Change
   `src/app/layout.tsx` to `<html lang="sr-Latn">` and add a test asserting the root layout
   emits the Latin-script Serbian locale tag, giving AS-124 a stable signal. Tiny; fold
   into the next UI-touching feature.

2. Behavioral 375px/desktop layout verification harness. Add a lightweight real-browser
   (Playwright) check that loads each core route at 375px and a desktop width and asserts
   `scrollingElement.scrollWidth <= clientWidth` (no horizontal scroll) and that the content
   column is centered and width-clamped — replacing the source-string matches for
   AS-125/AS-126 with assertions that fail if the behavior actually breaks. Run it over
   every screen as they ship.

3. Runtime publishable-key smoke for the browser Supabase client. When the first "use
   client" component calls `createClient()`, verify NEXT_PUBLIC_SUPABASE_URL +
   SUPABASE_PUBLISHABLE_KEY actually resolve in the browser bundle at runtime (the
   next.config.ts env re-export path is currently unexercised end-to-end), and re-confirm
   the secret key still never appears in `.next/static`.

## Appendix — full command output (clean re-run by reviewer)

### npm run test
```
 RUN  v4.1.10 C:/FitMess2/exexutor/claude-missions
 Test Files  7 passed (7)
      Tests  28 passed (28)
 Duration  5.71s
EXIT=0
```

### npm run lint
```
> eslint
EXIT=0   (zero errors/warnings)
```

### npm run typecheck
```
> tsc --noEmit
EXIT=0   (strict:true, zero errors)
```

### npm run build
```
Next.js 16.2.10 (Turbopack)
- Environments: .env
Compiled successfully in 4.3s
Finished TypeScript in 5.6s
Generating static pages (4/4)
Route (app):  / (static)   /_not-found (static)
EXIT=0
```

### Production server smoke (npm start)
```
docs/deploy.md: present
HTTP code: 200
lang attr: lang="sr"
Serbian body present: 1  (matches "Aplikacija za pracenje ishrane")
nav labels present: Agent Danas Nedelja Profil
Ready in 391ms
```

### Secret-leak grep (values never printed)
```
secret length: 41 | publishable length: 46 | gemini length: 53
SECRET in .next/static:      0 files
PUBLISHABLE in .next/static: 0 files
GEMINI in .next/static:      0 files
SECRET anywhere in .next:    2 files (both dev/cache/turbopack/*.sst — gitignored)
real SECRET/PUBLISHABLE/URL/GEMINI verbatim in .env.example: 0 / 0 / 0 / 0
.env tracked? no  |  .env.example tracked? yes  |  only .env* in git: .env.example
```
