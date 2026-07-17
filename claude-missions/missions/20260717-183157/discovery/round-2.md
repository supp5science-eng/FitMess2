# Discovery Round 2

_Captured: 2026-07-17T17:43:04Z_
_Note: alongside these answers the user submitted a PRD addendum (barcode & product database flow — barcode scanning moves into MVP Phase 2/5). Recorded verbatim as "Addendum 1" in `description.md`. The plan phase must incorporate it._

## Admin & Moderation

**1. What does the in-app admin UI include (user + admin role chosen)?**
- (a) Food verification queue only
- (b) Queue + basic user list/stats
- (c) Queue + users + AI cost dashboard              ← chosen
- (d) Queue + users + costs + agent-usage analytics

**2. How is the admin designated?**
- (a) Email allowlist in an env variable
- (b) `is_admin` flag set manually in the database   ← chosen
- (c) First registered user becomes admin
- (d) Separate admin login page with own credentials

## AI Limits & Behavior

**3. Daily AI caps — concrete numbers per user?**
- (a) 30 agent messages + 10 photo analyses          ← chosen
- (b) 50 agent messages + 20 photo analyses
- (c) 15 agent messages + 5 photo analyses (strict beta)
- (d) You pick sensible defaults, configurable via env

**4. UX when a user hits their daily AI cap?**
- (a) AI blocked with friendly Serbian message + reset time; manual logging unaffected  ← chosen
- (b) One warning at 80%, then hard stop
- (c) Degrade: agent switches to shorter/cheaper responses
- (d) Cap is silent — requests just queue until midnight

**5. Agent chat response delivery?**
- (a) Token-by-token streaming into the chat         ← chosen
- (b) Typing indicator, then full message at once
- (c) Streaming + instant optimistic budget updates
- (d) Whichever is simpler to build reliably

**6. Conversation summaries — when is a "session" summarized?**
- (a) After 30 min of inactivity, background job     ← chosen
- (b) Summarize on each agent reply, rolling overwrite
- (c) Nightly job summarizes the day's chats
- (d) No summaries after all — keep only resulting food logs + redistribution events

## Budget Mechanics

**7. User signs up mid-week (weeks are Mon-start) — first week's budget?**
- (a) Prorated: daily target × remaining days        ← chosen
- (b) Tracking starts next Monday; free-play until then
- (c) First week rolls 7 days from signup, then aligns to Monday
- (d) Full weekly budget regardless of signup day

**8. If a user finishes a day under budget, do leftover calories roll forward?**
- (a) No rollover — each day resets, week is the safety net
- (b) Rollover within the same week only, capped (~200 kcal/day)
- (c) Full rollover within the week, uncapped
- (d) Rollover only as agent suggestion, not automatic  ← chosen

**9. TDEE/budget recalculation as weight drops?**
- (a) Auto-recalc weekly from the 7-day weight trend  ← chosen
- (b) Recalc on every weigh-in
- (c) Manual "preračunaj" button + gentle prompt every ~4 weeks
- (d) Fixed until user edits profile

**10. Streak "X nedelja u deficitu" — a week counts if…?**
- (a) Weekly total ≤ weekly budget, strictly
- (b) Weekly total ≤ budget + 5% tolerance           ← chosen
- (c) Weekly total below TDEE (any deficit at all counts)
- (d) Logged ≥5 days that week, regardless of total

**11. The 3–5 eating rules from onboarding — editable?**
- (a) Fixed — generated once at onboarding
- (b) User can toggle/edit them in settings          ← chosen
- (c) Agent proposes adjustments over time, user confirms
- (d) Drop the rules feature from MVP

## Contradictions to Resolve

**12. Meal photos deleted vs. PRD thumbnails on home screen — resolve?**
- (a) No photos kept — food-category icons as thumbnails
- (b) Keep a small compressed thumbnail (~200px), delete original  ← chosen
- (c) Keep meal photos after all (like label photos)
- (d) Thumbnails only in today's list, purged nightly

**13. Daily reminder mechanism (online-only PWA, no email provider)?**
- (a) Web Push notifications (works for installed PWAs, incl. iOS)  ← chosen
- (b) Drop reminders from MVP entirely
- (c) In-app nudge banner only (shows when app opens)
- (d) Add web push in v2; in-app nudge for now

## Ops & Cost

**14. Vercel plan (Hobby prohibits commercial use; free beta)?**
- (a) Hobby (free) — fine while beta is free/non-commercial  ← chosen
- (b) Pro ($20/mo) from day one
- (c) Hobby now, upgrade to Pro before any monetization
- (d) You verify current terms and recommend

**15. PostHog region (ties to GDPR-basics posture)?**
- (a) PostHog Cloud EU                               ← chosen
- (b) PostHog Cloud US
- (c) EU cloud now, evaluate self-host later
- (d) No preference — you pick
