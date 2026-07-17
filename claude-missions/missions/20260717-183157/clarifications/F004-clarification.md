# F004 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: infra_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Config/scaffold via current CLI commands (create-next-app, shadcn init, wizards); no business logic
**2. Data shape** — star (chosen): n/a (configuration + generated files)
**3. State / storage** — star (chosen): Filesystem / config files; nothing runtime
**4. API contract** — star (chosen): n/a
**5. Failure handling** — star (chosen): Build fails loudly; fix before proceeding, never mask errors
**6. Empty / zero state** — star (chosen): n/a
**7. Validation rules** — star (chosen): build + typecheck + lint all pass
**8. Performance budget** — star (chosen): Not a constraint at this stage
**9. Auth / access** — star (chosen): n/a
**10. Touches** — star (chosen): Only new config/scaffold files; must not clobber .env or .gitignore

## Round B — 5 follow-up decisions (star defaults)

**11.** Pin versions per tech-decisions (Next 16.2, React 19.2, TS 5.9, Tailwind 4)
**12.** Keep existing .gitignore/.env rules intact
**13.** Turbopack default bundler
**14.** src/ dir + @/* alias
**15.** Node 22 via engines + .nvmrc

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Build + smoke test passes (npm run build, npm run dev serves the page)
**17. Failure test** — n/a / manual — a broken build is self-evident
**18. Manual verification** — Run dev server, confirm Serbian text renders at 375px
**19. Side-effect verification** — Does not overwrite .env, .gitignore secret rules, or other features files
**20. Evidence artifact** — Build output + screenshot of the running page
