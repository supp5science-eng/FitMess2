# F072: Sentry integration

**Milestone:** M8 — Polish, PWA & Compliance
**Estimated worker time:** 30 minutes
**Depends on:** F001

## Assertion IDs covered
- AS-119 (client + server errors reported; no credentials in events)

## Draft scope
- @sentry/nextjs wizard config (client, server, edge); DSN via env
- beforeSend scrubbing (auth headers, tokens); sample rates tuned for free tier
- Verify with a deliberate test error, then remove

## Files (approximate)
sentry.client.config.ts, sentry.server.config.ts, next.config wrapping

## Notes for clarification
- MCP at run: Sentry MCP if registered


---

## Clarified implementation (from clarifications/F072-clarification.md)

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
