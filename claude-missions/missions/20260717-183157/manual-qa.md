# Manual QA — items that need a one-time human action

These assertions are **code-complete and verified as far as automation allows**, but their
final confirmation requires a human doing something a headless worker cannot (interactive
browser consent, dashboard OAuth). They are NOT failures and NOT loop-guard deferrals — they
are a short checklist for the human before/at public launch.

| Assertion | Feature | What's done (automated) | The one human step |
|-----------|---------|-------------------------|--------------------|
| AS-007 | F004 | Build proven Vercel-deployable & secret-independent; `docs/deploy.md` runbook written | Import the GitHub repo into Vercel, set env vars from `.env.example`, confirm push-to-main auto-deploys over HTTPS |
| AS-010 | F012 | Google button on /prijava + /registracija; correct `signInWithOAuth`; provider enabled live; `isEmailVerified` gate + profiles-row creation verified with a simulated Google identity | Click through the real Google consent screen once with a Google account and confirm you land signed-in |
| AS-008 | F011 | Signup form works, invokes real `signUp`, correct Serbian throttle handling; F011 automated tests exercise the creation path | Sign up once with a real email (works at low volume) to see the end-to-end confirmation flow |

_Everything else in the mission is verified end-to-end by automated tests + the milestone validators._

## ⚠️ Launch consideration (not a mission item — a product decision before real beta)

**Supabase built-in email is capped at 2 confirmation emails/hour** (`rate_limit_email_sent = 2`,
not raisable without custom SMTP). This means **only ~2 users can sign up per hour** on the current
setup. Discovery (Q17a) chose "no custom email provider" for v1, which is why we're on built-in
email. **Before a real beta with 10–20 users, add a free transactional-email provider** (e.g. Resend
free tier) and point Supabase Auth's custom SMTP at it — then the signup cap disappears. This is a
~30-min setup when you're ready; flagged here so it doesn't surprise you at launch. (This is also why
the M2 UX validator marked AS-008 INCONCLUSIVE — the test session hit the 2/hour email cap, not an app
bug.)
