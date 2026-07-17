# F004: Vercel project + git auto-deploy

**Milestone:** M1 — Foundation
**Estimated worker time:** 30 minutes
**Depends on:** F001

## Assertion IDs covered
- AS-007: Push to main triggers automatic production deployment over HTTPS.

## Draft scope
- Link GitHub repo to Vercel project (Hobby plan while free beta)
- Production env vars set in Vercel
- Preview deploys on branches (discovery: prod + preview)

## Files (approximate)
vercel.json (only if needed), README deploy section

## Notes for clarification
- Orchestrator does Vercel setup during /mission-connect; worker verifies deploy works
- MCP at run: Vercel MCP if registered


---

## Clarified implementation (from clarifications/F004-clarification.md)

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
