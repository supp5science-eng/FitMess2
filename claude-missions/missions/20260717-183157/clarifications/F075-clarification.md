# F075 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: ui_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): React (Server + Client) components with shadcn/ui + Tailwind 4, mobile-first
**2. Data shape** — star (chosen): Server-fetched props; minimal client state for interactivity
**3. State / storage** — star (chosen): Server as source of truth; small client state (form/optimistic) only
**4. API contract** — star (chosen): Rendered states: loading skeleton / populated / empty / error
**5. Failure handling** — star (chosen): Inline Serbian error message + retry affordance; never a blank/broken screen
**6. Empty / zero state** — star (chosen): Friendly Serbian empty state with a clear next action (ti form)
**7. Validation rules** — star (chosen): Client-side + server-side validation; inline Serbian field errors
**8. Performance budget** — star (chosen): <200ms interaction; renders at 375px with no horizontal scroll; centered column on desktop
**9. Auth / access** — star (chosen): Authenticated user; shows only own data
**10. Touches** — star (chosen): New page/components + reads the relevant lib/API

## Round B — 5 follow-up decisions (star defaults)

**11.** All copy sr-Latn, informal ti form, zero-shame tone
**12.** Single energetic-green accent from theme tokens; light theme only
**13.** Loading = skeleton; error = inline retry; empty = encouraging Serbian copy
**14.** Keyboard-reachable, labeled inputs, alt text (AS-128)
**15.** Big friendly numbers per Cal AI aesthetic where the spec calls for it

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Component test + manual verification of rendered states
**17. Failure test** — Error-state render test (forced failure shows Serbian retry)
**18. Manual verification** — 3-step script exercised at 375px (per feature spec)
**19. Side-effect verification** — No unintended navigation or global state mutation
**20. Evidence artifact** — Screenshot at 375px + test output
