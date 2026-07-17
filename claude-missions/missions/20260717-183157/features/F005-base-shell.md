# F005: Base app shell — sr-Latn, Inter, light theme, mobile-first

**Milestone:** M1 — Foundation
**Estimated worker time:** 45 minutes
**Depends on:** F001

## Assertion IDs covered
- AS-002 (Serbian text), AS-125 (375px no horizontal scroll), AS-126 (desktop centered column), AS-127 (light theme, one accent)

## Draft scope
- html lang="sr-Latn", Inter via next/font, Tailwind theme tokens (accent: energetic green — confirm in clarification)
- Mobile-first shell (375px baseline), centered max-width column on desktop
- Bottom navigation skeleton: Danas / Nedelja / Agent / Profil

## Files (approximate)
src/app/layout.tsx, src/app/globals.css, src/components/shell/

## Notes for clarification
- Accent color (green vs orange); agent name/avatar identity
- MCP at run: none


---

## Clarified implementation (from clarifications/F005-clarification.md)

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
