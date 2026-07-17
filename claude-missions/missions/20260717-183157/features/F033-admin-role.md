# F033: Admin role + server-enforced guard

**Milestone:** M4 — Barcode & Admin
**Estimated worker time:** 30 minutes
**Depends on:** F010

## Assertion IDs covered
- AS-059 (is_admin gates admin area), AS-067 (server-side enforcement on admin APIs)

## Draft scope
- is_admin flag on profiles (set manually in DB per discovery)
- requireAdmin() server helper used by every admin route/action; RLS policies for admin-only mutations
- /admin layout with denial page for non-admins

## Files (approximate)
src/lib/auth/admin.ts, src/app/admin/layout.tsx

## Notes for clarification
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F033-clarification.md)

_Auto-accepted star defaults (accept-and-continue); type profile: auth._

- Pattern: Next.js route handlers + server actions using @supabase/ssr (cookie sessions)
- Data shape: Supabase auth.users + app profiles table
- State location: HTTP-only cookies via @supabase/ssr; session refreshed in middleware
- API contract: Redirects for page flows; JSON {ok,error_sr} for actions
- Failure handling: Friendly Serbian error; never reveal whether an email exists (no enumeration)
- Empty state: n/a
- Validation: Email format + password policy; email-verification gate before app access
- Performance budget: <500ms p95 per auth action
- Access control: This feature IS the auth/access boundary; enforced server-side
- Touches: Middleware, profiles table, auth callback route

### Follow-up decisions
- Unverified email/password users blocked until confirmed; Google users pass (pre-verified)
- Redirect matrix: signed-out to /prijava, unverified to notice, not-onboarded to onboarding
- Sign-out clears session + redirects
- Auth errors mapped to generic Serbian copy
- Admin gate (requireAdmin) enforced on every admin route/action

## Definition of done

- **Primary success test:** Integration test of the auth flow (signup/login/redirect)
- **Failure test:** Failed-login test asserts safe non-enumerating Serbian message
- **Manual verification:** Manual sign-in, sign-out, and protected-route redirect at 375px
- **Side-effect verification:** Unverified/anonymous users cannot reach protected data
- **Evidence artifact:** Integration test output

Assertion IDs listed above are the validator checklist; the worker is not done until each definition-of-done item is satisfied with concrete output linked from the handoff.
