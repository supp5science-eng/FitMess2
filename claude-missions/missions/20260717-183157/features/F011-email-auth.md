# F011: Email/password signup + verification

**Milestone:** M2 — Auth & Onboarding
**Estimated worker time:** 45 minutes
**Depends on:** F010

## Assertion IDs covered
- AS-008 (signup), AS-009 (verification required before use), AS-017 (safe Serbian error messages)

## Draft scope
- Signup/login pages in Serbian; Supabase Auth email+password
- Email confirmation required before app access; resend option
- Serbian auth error mapping without user-enumeration leaks

## Files (approximate)
src/app/(auth)/prijava/page.tsx, src/app/(auth)/registracija/page.tsx, src/app/auth/callback/route.ts

## Notes for clarification
- Supabase built-in email has low rate limits — acceptable for beta per discovery answer 17a; monitor
- MCP at run: Supabase MCP


---

## Clarified implementation (from clarifications/F011-clarification.md)

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
