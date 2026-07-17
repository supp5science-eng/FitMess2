# F016: Onboarding summary + persist targets

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 30 minutes
**Depends on:** F015, F014

## Assertion IDs covered
- AS-020 (editable summary), AS-031 (returning user skips onboarding)

## Draft scope
- Summary screen: computed daily/weekly budget + macros; every input editable inline, recompute on edit
- Save profile + targets; set onboarded_at; redirect to home
- Show Serbian explanation when goal was capped (AS-030 UI side)

## Files (approximate)
src/app/(app)/onboarding/pregled/page.tsx, server action

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F016-clarification.md)

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
