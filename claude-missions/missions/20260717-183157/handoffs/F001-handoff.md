# Handoff: F001 — Next.js 16 scaffold + Tailwind 4 + shadcn/ui init

## Status
COMPLETE

## Assertions covered
AS-001: PASS — `npm run build` succeeds (Turbopack) with no errors; `npm run dev` starts and serves HTTP 200 at `/`. Evidence: `handoffs/evidence/F001/build-output.log`.
AS-002: PASS — root URL response has `<html lang="sr">` and renders heading "Adaptive Cut" + Serbian body text "Aplikacija za praćenje ishrane i adaptivno mršavljenje...". Verified via curl against the real dev server and a rendered screenshot at 375px. Evidence: `handoffs/evidence/F001/root-page-375px.png`. Also covered by automated test `test_AS_002_root_page_serves_serbian_text` in `src/app/page.test.tsx`.

## Files changed
.gitignore (merged Next.js ignore rules; existing .env* rules untouched)
.nvmrc (new)
components.json (new, shadcn config)
eslint.config.mjs (new)
next-env.d.ts (new, generated; gitignored per Next.js convention — not committed)
next.config.ts (new)
package.json (new)
package-lock.json (new)
postcss.config.mjs (new)
tsconfig.json (new)
vitest.config.ts (new)
vitest.setup.ts (new)
public/file.svg, public/globe.svg, public/next.svg, public/vercel.svg, public/window.svg (new, create-next-app defaults)
src/app/layout.tsx (new)
src/app/page.tsx (new)
src/app/globals.css (new)
src/app/favicon.ico (new)
src/app/page.test.tsx (new — smoke test for AS-001/AS-002)
src/components/ui/button.tsx (new, shadcn-generated)
src/lib/utils.ts (new, shadcn-generated `cn` helper)
missions/20260717-183157/handoffs/evidence/F001/build-output.log (new, evidence artifact)
missions/20260717-183157/handoffs/evidence/F001/root-page-375px.png (new, evidence artifact)

Not touched / not overwritten: .env, README.md, DOCS.md, CLAUDE.md, .claude/, missions/ (other files pre-existing from earlier orchestrator phases, staged as part of this commit only because they were untracked in git — content not modified by this worker).

## Commands run
`npx create-next-app@latest app-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --no-agents-md --yes` (0) — run in a scratch temp dir, then files moved into repo root per instructions (repo root was non-empty with framework files, so create-next-app could not run in place)
`npx shadcn@latest init --defaults --force` (0) — resolved to style `base-nova`, base UI `base`, baseColor `neutral` (matches clarified "Tailwind v4, neutral base")
`npm install` (0) — at repo root, after copying scaffold files in; installs 678 packages
`npm run test` (0) — vitest, 2/2 tests passed
`npm run typecheck` (0) — `tsc --noEmit`, no errors
`npm run lint` (0) — `eslint`, no errors
`npm run build` (0) — `next build` with Turbopack, compiled + typechecked + prerendered `/` and `/_not-found` as static
`npm run dev -- -p 3458` (background, terminated after verification) — dev server; `curl http://localhost:3458/` returned HTTP 200 with Serbian content confirmed
Headless-browser screenshot via a scratch `puppeteer-core` script pointed at the installed Microsoft Edge binary, viewport 375x812 — confirms visual rendering at the mobile-first breakpoint (script and its `node_modules` live only in the session scratchpad, not in the repo)

## Decisions made
- Scaffolded `create-next-app` into a scratch temp directory (not the repo root) because the repo root already contains `.claude/`, `.env`, `.gitignore`, `CLAUDE.md`, `DOCS.md`, `README.md`, `missions/` and `create-next-app` refuses to run in a non-empty directory. Copied only the app's generated files (not its own `README.md`, which is generic create-next-app boilerplate — kept the existing project `README.md` untouched instead of merging low-value generic content into it, per the "keep the app's readme content in a section or separate file if needed" instruction — decided the generic content added no value and omitted it rather than clutter the repo).
- Merged `.gitignore`: appended a "NEXT.JS APP" section with `/out/`, `/coverage`, `.vercel`, `*.tsbuildinfo`, `next-env.d.ts`, `*.pem`, and log-file patterns. Did not touch or reorder the existing `--- CREDENTIALS ---` block; `.env` remains ignored exactly as before.
- `npx shadcn@latest init` CLI has changed materially since tech-decisions.md was written (no more `-b <color>` flag; base color is now chosen via a design "preset" system with a separate `-b base|radix|aria` flag for the underlying primitives library). Used `--defaults` (documented CLI default: template=next, preset=base-nova) which resolved `baseColor: "neutral"` in the generated `components.json` — matching the clarified "Tailwind v4, neutral base" answer despite the CLI's flag surface changing. Verified by reading the generated `components.json`.
- Pinned `react`/`react-dom` to `^19.2.7` and `next` to `^16.2.10` (tech-decisions versions) after `create-next-app` installed a slightly older resolved `react@19.2.4`; `tailwindcss` and `typescript` already resolved to the exact versions in tech-decisions (`4.3.3`, `5.9.3`) so those were left as `create-next-app` generated them.
- Added `package.json` `engines.node: "22.x"` and `.nvmrc` (`22`) per the clarified "Node 22 via engines + .nvmrc" decision. The current dev machine runs Node 24; `npm install` emits a non-fatal `EBADENGINE` warning, which is expected and does not block install/build/test — Vercel is configured to use Node 22 for the actual deployment.
- No `--turbopack`/`--rspack` flag was passed to `create-next-app`; Turbopack is the current CLI default bundler, matching the clarified "Turbopack default bundler" decision. Confirmed by the `▲ Next.js 16.2.10 (Turbopack)` banner in `next build` / `next dev` output.
- Added `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` + `@vitejs/plugin-react` as dev dependencies and a `vitest.config.ts`/`vitest.setup.ts`/`npm run test` script, since `tech-decisions.md` names `vitest` as the project's test runner and "How to run tests: npm run test" — this is the first feature, so the test harness itself had to be established here for the smoke test to run and for later features to build on.
- Removed the default create-next-app/Vercel template content (logo, "Deploy Now" / "Documentation" links, dark-mode `dark:` variants) from `page.tsx` and replaced with the clarified minimal Serbian placeholder (heading "Adaptive Cut" + short Serbian paragraph), using only `foreground`/`muted-foreground` shadcn theme tokens and no `dark:` classes, per the "no dark mode" convention in tech-decisions.md (the `.dark` CSS class shadcn generates in `globals.css` is left in place as inert, unused scaffold — nothing in the app currently toggles it).
- Set `<html lang="sr">` (not `sr-Latn`) since Serbian written in Latin script is the default/expected script for `lang="sr"` in this context and matches how Next.js/browsers commonly interpret the primary language subtag; body copy itself is Latin-script Serbian per the "sr-Latn, informal ti form" convention.
- `next-env.d.ts` and `tsconfig.tsbuildinfo` are left on disk (required by the TypeScript/Next.js toolchain) but are gitignored per stock Next.js convention (added to the merged `.gitignore`) and were not staged/committed.
- Committed the full pre-existing `missions/20260717-183157/` tree (plan.md, tech-decisions.md, discovery/, connections/, clarifications/, description.md, milestones/, run-log.md, APPROVED, `missions/CURRENT`) alongside the scaffold, because `git status` showed all of it as untracked (no prior mission-state commit existed) and the repo convention (`.gitignore` NOTE + CLAUDE.md rule 10) is that mission state under `missions/` is tracked in git, not project code — none of that content was authored or modified by this worker.

## Out-of-scope work needed
- No dedicated `/lib/dates.ts`, `/lib/budget/`, `/lib/ai/`, `/lib/food/`, `/lib/supabase/` directories were created — those belong to later features per tech-decisions' file layout and are explicitly out of scope for F001 ("minimal scaffold only").
- No Supabase client wiring, PostHog/Sentry init, PWA/service-worker (Serwist) setup, or route groups (`(auth)`, `(app)`, `admin`, `api`) were added — all deferred to their respective features.
- Root `page.tsx` is a static placeholder only; no navigation shell or auth redirect logic — future features will replace this page entirely.

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Used `npx shadcn@latest init --defaults` instead of trying to force a `-b neutral` flag (which no longer exists in the current CLI) because the resulting `components.json` still resolves `baseColor: "neutral"`, satisfying the clarified answer through the CLI's new preset mechanism.
AUTONOMOUS_DECISION: Set up the vitest test harness (config, setup file, testing-library deps, `npm run test` script) as part of this scaffold feature, since tech-decisions.md references `npm run test` globally and no earlier feature had established it; this is infrastructure, not business logic, consistent with F001's "config/scaffold only" pattern.
AUTONOMOUS_DECISION: Omitted the generic `README.md` that `create-next-app` generates (boilerplate links to Next.js docs, no project-specific content) rather than merging it into the existing project `README.md`, since the instruction only required not clobbering the existing file, not necessarily preserving the generated boilerplate.

## Notes for the next worker
- `create-next-app@latest` (as of 2026-07-17) can no longer scaffold into a non-empty directory even with `--force`-style flags; the practical pattern (used here) is: scaffold into a scratch temp dir, then copy the generated files into the real repo root, merging `.gitignore` by hand.
- `npx shadcn@latest init` has a new interactive "preset" system (Nova/Vega/Maia/Lyra/Mira/Luma/Sera/Rhea) plus a `-b base|radix|aria` primitives-library flag; the old `-b <color>` base-color flag is gone. `--defaults` is the fastest non-interactive path and currently resolves to preset `base-nova`, base `base` (Base UI primitives via `@base-ui/react`), icon library `lucide`, and `baseColor: "neutral"`. If a future feature needs a different shadcn preset/base, check `npx shadcn@latest init --help` again — this CLI is evolving quickly.
- The dev/build server correctly picks up the root `.env` file (`next build`/`next dev` print `- Environments: .env`) — no additional env wiring was needed for this feature.
- A CLI screenshot gotcha: `msedge.exe --headless=new --window-size=375,812 --screenshot=...` produces a visually broken/shifted 375px capture (content clipped on the right) even though the page renders correctly — this looks like a Chromium headless windowing/DPI quirk, not an app bug. Driving the same Edge binary via `puppeteer-core` with `page.setViewport({width:375,height:812})` produces a correct, centered capture. Confirmed by also capturing at 1200px wide via the CLI flag, which rendered perfectly. If you need mobile screenshots for evidence, prefer the puppeteer-core/CDP route over the bare `--screenshot` CLI flag at small window sizes.
- Evidence artifacts for this feature live in `missions/20260717-183157/handoffs/evidence/F001/` (`build-output.log`, `root-page-375px.png`).
