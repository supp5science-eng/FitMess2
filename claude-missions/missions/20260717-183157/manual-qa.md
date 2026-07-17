# Manual QA — items that need a one-time human action

These assertions are **code-complete and verified as far as automation allows**, but their
final confirmation requires a human doing something a headless worker cannot (interactive
browser consent, dashboard OAuth). They are NOT failures and NOT loop-guard deferrals — they
are a short checklist for the human before/at public launch.

| Assertion | Feature | What's done (automated) | The one human step |
|-----------|---------|-------------------------|--------------------|
| AS-007 | F004 | Build proven Vercel-deployable & secret-independent; `docs/deploy.md` runbook written | Import the GitHub repo into Vercel, set env vars from `.env.example`, confirm push-to-main auto-deploys over HTTPS |
| AS-010 | F012 | Google button on /prijava + /registracija; correct `signInWithOAuth`; provider enabled live; `isEmailVerified` gate + profiles-row creation verified with a simulated Google identity | Click through the real Google consent screen once with a Google account and confirm you land signed-in |

_Everything else in the mission is verified end-to-end by automated tests + the milestone validators._
