# F041: Weekly dashboard screen

**Milestone:** M5 — Weekly Dashboard, Weight & Streak
**Estimated worker time:** 45 minutes
**Depends on:** F040, F027

## Assertion IDs covered
- AS-068 (weekly ring/bar), AS-069 (green/yellow/red indicator), AS-070 (daily average vs target), AS-071 (per-day totals)

## Draft scope
- Hero weekly ring (spent vs total); week is the visual unit — one bad day looks small
- Per-day mini bars Mon–Sun with totals; daily average line
- On-track thresholds: green ≤100%, yellow ≤105%, red >105% (confirm in clarification)

## Files (approximate)
src/app/(app)/nedelja/page.tsx, src/components/weekly/

## Notes for clarification
- MCP at run: none


---

## Clarified implementation (from clarifications/F041-clarification.md)

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
