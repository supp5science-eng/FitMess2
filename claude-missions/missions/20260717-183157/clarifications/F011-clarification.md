# F011 Clarification

_Generated: 2026-07-17T19:53:04Z_  _Mode: accept-and-continue (star defaults auto-applied; no user interaction)_
_Feature type profile: auth_

## Round A — 10 task questions (all star defaults)

**1. Implementation pattern** — star (chosen): Next.js route handlers + server actions using @supabase/ssr (cookie sessions)
**2. Data shape** — star (chosen): Supabase auth.users + app profiles table
**3. State / storage** — star (chosen): HTTP-only cookies via @supabase/ssr; session refreshed in middleware
**4. API contract** — star (chosen): Redirects for page flows; JSON {ok,error_sr} for actions
**5. Failure handling** — star (chosen): Friendly Serbian error; never reveal whether an email exists (no enumeration)
**6. Empty / zero state** — star (chosen): n/a
**7. Validation rules** — star (chosen): Email format + password policy; email-verification gate before app access
**8. Performance budget** — star (chosen): <500ms p95 per auth action
**9. Auth / access** — star (chosen): This feature IS the auth/access boundary; enforced server-side
**10. Touches** — star (chosen): Middleware, profiles table, auth callback route

## Round B — 5 follow-up decisions (star defaults)

**11.** Unverified email/password users blocked until confirmed; Google users pass (pre-verified)
**12.** Redirect matrix: signed-out to /prijava, unverified to notice, not-onboarded to onboarding
**13.** Sign-out clears session + redirects
**14.** Auth errors mapped to generic Serbian copy
**15.** Admin gate (requireAdmin) enforced on every admin route/action

## Round B — 5 definition-of-done (star defaults)

**16. Primary success test** — Integration test of the auth flow (signup/login/redirect)
**17. Failure test** — Failed-login test asserts safe non-enumerating Serbian message
**18. Manual verification** — Manual sign-in, sign-out, and protected-route redirect at 375px
**19. Side-effect verification** — Unverified/anonymous users cannot reach protected data
**20. Evidence artifact** — Integration test output
