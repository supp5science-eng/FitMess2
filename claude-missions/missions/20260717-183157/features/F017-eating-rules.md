# F017: Eating rules — generation + editing

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 30 minutes
**Depends on:** F016

## Assertion IDs covered
- AS-028 (3–5 Serbian rules generated), AS-029 (toggle/edit in settings)

## Draft scope
- Rule template catalog in Serbian (protein u bar 2 obroka, povrće svaki dan, ...); pick 3–5 by profile
- Rules stored with profile; settings UI with toggle + edit
- Optional suggested day structure shown as guidance, never obligation

## Files (approximate)
src/lib/budget/rules.ts, src/app/(app)/profil/pravila/page.tsx

## Notes for clarification
- Exact rule catalog to confirm
- MCP at run: none


---

## Clarified implementation (from clarifications/F017-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: ui._

- Pattern: React (Server + Client) components with shadcn/ui + Tailwind 4, mobile-first
- Data shape: Server-fetched props; minimal client state for interactivity
- State location: Server as source of truth; small client state (form/optimistic) only
- API contract: Rendered states: loading skeleton / populated / empty / error
- Failure handling: Inline Serbian error message + retry affordance; never a blank/broken screen
- Empty state: Friendly Serbian empty state with a clear next action (ti form)
- Validation: Client-side + server-side validation; inline Serbian field errors
- Performance budget: <200ms interaction; renders at 375px with no horizontal scroll; centered column on desktop
- Access control: Authenticated user; shows only own data
- Touches: New page/components + reads the relevant lib/API

### Follow-up decisions
- All copy sr-Latn, informal ti form, zero-shame tone
- Single energetic-green accent from theme tokens; light theme only
- Loading = skeleton; error = inline retry; empty = encouraging Serbian copy
- Keyboard-reachable, labeled inputs, alt text (AS-128)
- Big friendly numbers per Cal AI aesthetic where the spec calls for it

## Definition of done

- **Primary success test:** Component test + manual verification of rendered states
- **Failure test:** Error-state render test (forced failure shows Serbian retry)
- **Manual verification:** 3-step script exercised at 375px (per feature spec)
- **Side-effect verification:** No unintended navigation or global state mutation
- **Evidence artifact:** Screenshot at 375px + test output

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
