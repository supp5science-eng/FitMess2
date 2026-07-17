# F001: Next.js 16 scaffold + Tailwind 4 + shadcn/ui init

**Milestone:** M1 — Foundation
**Estimated worker time:** 30 minutes
**Depends on:** none

## Assertion IDs covered
- AS-001: App builds and starts locally without errors.
- AS-002: Root URL serves a page with Serbian (sr-Latn) text.

## Draft scope
- `create-next-app@latest` (App Router, TypeScript, Tailwind, ESLint)
- `npx shadcn@latest init` with Tailwind v4
- Placeholder Serbian landing page
- Verify build and dev server run

## Files (approximate)
package.json, src/app/layout.tsx, src/app/page.tsx, components.json

## Notes for clarification
- Repo layout: app at repo root vs subfolder
- MCP at run: none


---

## Clarified implementation (from clarifications/F001-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: infra._

- Pattern: Config/scaffold via current CLI commands (create-next-app, shadcn init, wizards); no business logic
- Data shape: n/a (configuration + generated files)
- State location: Filesystem / config files; nothing runtime
- API contract: n/a
- Failure handling: Build fails loudly; fix before proceeding, never mask errors
- Empty state: n/a
- Validation: build + typecheck + lint all pass
- Performance budget: Not a constraint at this stage
- Access control: n/a
- Touches: Only new config/scaffold files; must not clobber .env or .gitignore

### Follow-up decisions
- Pin versions per tech-decisions (Next 16.2, React 19.2, TS 5.9, Tailwind 4)
- Keep existing .gitignore/.env rules intact
- Turbopack default bundler
- src/ dir + @/* alias
- Node 22 via engines + .nvmrc

## Definition of done

- **Primary success test:** Build + smoke test passes (npm run build, npm run dev serves the page)
- **Failure test:** n/a / manual — a broken build is self-evident
- **Manual verification:** Run dev server, confirm Serbian text renders at 375px
- **Side-effect verification:** Does not overwrite .env, .gitignore secret rules, or other features files
- **Evidence artifact:** Build output + screenshot of the running page

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
