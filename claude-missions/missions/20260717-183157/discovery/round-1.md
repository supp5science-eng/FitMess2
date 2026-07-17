# Discovery Round 1

_Captured: 2026-07-17T16:45:00Z_
_Adaptations from defaults: PRD already fixed auth (email + Google OAuth via Supabase), primary data store (Supabase Postgres), interface (Next.js PWA, mobile-first), AI providers (Anthropic + Gemini vision), i18n (sr-Latn), and file storage (Supabase Storage). Those default questions were replaced with project-specific open questions: signup/roles/verification detail, photo retention, agent history, week definition, crowdsourced-food visibility, offline behavior, onboarding style, OFF import timing, hosting commitment (Cloudflare adapter friction), Supabase env strategy, AI cost control, script support, and seed DB size._

## A. Users & Access

**1. Signup model at launch?**
- (a) Open self-signup for anyone                     ← chosen
- (b) Invite-only closed beta (10–20 users)
- (c) Waitlist, admitted in batches
- (d) Open signup but feature-flagged beta

**2. Expected user count at v1?**
- (a) <50 (beta circle)
- (b) 50–1,000                                        ← chosen
- (c) 1,000–10,000
- (d) >10,000

**3. Role model?**
- (a) Single role; admin tasks done directly in Supabase
- (b) User + admin role in-app (admin UI for food review)  ← chosen
- (c) User + admin + moderator for food verification
- (d) No admin functions in v1 at all

**4. Email verification for email/password signups?**
- (a) Required before using the app                   ← chosen
- (b) Not required — frictionless entry
- (c) Required only before saving data
- (d) Skip passwords — magic link + Google only

**5. Account deletion & data export?**
- (a) Full GDPR-style: self-serve export + delete     ← chosen
- (b) Self-serve delete only, no export
- (c) Delete by emailing support (manual)
- (d) Not in MVP

## B. Data

**6. Uploaded photos (labels/meals) — retention?**
- (a) Delete right after AI processing
- (b) Keep 30 days, then auto-delete
- (c) Keep forever (meal thumbnails in history)
- (d) Keep label photos, delete meal photos           ← chosen

**7. Agent conversation history?**
- (a) Store full history forever, scrollable
- (b) Store last 30 days only
- (c) Ephemeral per session; store only resulting logs
- (d) Store summaries + resulting logs, not transcripts  ← chosen

**8. Weekly budget week definition?**
- (a) Calendar week, Monday start                     ← chosen
- (b) Rolling 7-day window
- (c) Starts on user's signup weekday
- (d) User picks their week start day

**9. Crowdsourced foods (from label photos) — visibility?**
- (a) Private to submitter until admin verifies
- (b) Immediately public, marked "neprovereno"
- (c) Immediately public after AI confidence check, admin can pull  ← chosen
- (d) Private to submitter always; verified copies go public

**10. PWA offline behavior?**
- (a) Online-only; friendly offline message           ← chosen
- (b) Read-only offline (view budget/history)
- (c) Offline manual logging with sync on reconnect
- (d) Full offline including queued photo uploads

## C. Interface

**11. Component approach?**
- (a) Tailwind + shadcn/ui components                 ← chosen
- (b) Pure custom Tailwind components
- (c) Another kit (MUI/Mantine)
- (d) I'll provide Figma/designs

**12. Color theme?**
- (a) Light only (per Cal AI aesthetic)               ← chosen
- (b) Light + dark, follows system
- (c) Light + dark with manual toggle
- (d) Dark default

**13. Accessibility target?**
- (a) Basic (semantic HTML, contrast, labels)         ← chosen
- (b) WCAG AA
- (c) Not a priority for beta
- (d) WCAG AAA

**14. Desktop experience?**
- (a) Mobile layout centered in a column              ← chosen
- (b) Proper responsive desktop layouts
- (c) Desktop later; mobile-only for now
- (d) Desktop shows "open on phone" + QR

**15. Onboarding flow style?**
- (a) Multi-step wizard, one question per screen
- (b) Single scrollable form
- (c) Conversational — the agent asks in chat
- (d) Wizard + editable summary screen at end         ← chosen

## D. Integrations

**16. Payments in v1?**
- (a) None — free beta, payments v2                   ← chosen
- (b) Stripe subscriptions from day one
- (c) Lemon Squeezy / Paddle (merchant-of-record)
- (d) Manual (bank transfer / activation codes)

**17. Transactional email beyond Supabase auth emails?**
- (a) None needed in v1                               ← chosen
- (b) Resend
- (c) Postmark / SES
- (d) Supabase SMTP with custom provider

**18. Product analytics?**
- (a) None in v1
- (b) PostHog (free tier, self-serve funnels)         ← chosen
- (c) Plausible / simple pageviews
- (d) Custom events table in Supabase

**19. Open Food Facts import timing?**
- (a) MVP: one-time seed-script import of Serbian entries  ← chosen
- (b) MVP: live API lookup on failed search
- (c) v2 entirely — manual seed only for MVP
- (d) MVP seed import + v2 live lookup

**20. Error monitoring?**
- (a) Sentry (free tier)                              ← chosen
- (b) Cloudflare + Supabase logs only
- (c) None for beta
- (d) Other (Axiom/Logtail)

## E. Deployment & Ops

**21. Hosting commitment?** *(Next.js on Cloudflare Pages needs an adapter and has some Node API limits)*
- (a) Strict Cloudflare Pages/Workers, adapt as needed
- (b) Prefer Cloudflare, fall back to Vercel if friction
- (c) Vercel is fine from the start                   ← chosen
- (d) Whatever you verify works best for this stack

**22. CI/CD?**
- (a) Cloudflare/host git integration (auto-deploy on push)  ← chosen
- (b) GitHub Actions (tests gate deploy)
- (c) Manual deploys during beta
- (d) GitHub Actions + preview deploys per PR

**23. Environments?**
- (a) Production only during beta
- (b) Production + preview deploys                    ← chosen
- (c) Production + staging + preview
- (d) Local dev + production

**24. Supabase environment strategy?**
- (a) One Supabase project for everything             ← chosen
- (b) Two projects: dev + production
- (c) Local Supabase (CLI/Docker) + production project
- (d) Supabase branching (paid feature)

**25. Domain at launch?**
- (a) Custom domain already owned/ready
- (b) Will buy one — suggest options
- (c) Free subdomain (*.pages.dev) fine for beta
- (d) Custom domain later; subdomain now              ← chosen

## F. Quality & Constraints

**26. Testing depth?**
- (a) Unit tests for critical math (TDEE, budget, redistribution) only
- (b) Critical math + API route tests                 ← chosen
- (c) Above + Playwright e2e for core flows
- (d) Minimal — manual testing during beta

**27. AI cost control per user?**
- (a) Daily caps per user (N agent msgs, N photos)    ← chosen
- (b) Token logging + monitoring only, no hard caps
- (c) Hard monthly budget; degrade gracefully when hit
- (d) No limits during closed beta

**28. Script support?**
- (a) sr-Latn only, everywhere
- (b) Latin UI, search understands Cyrillic input     ← chosen
- (c) Latin + Cyrillic UI toggle
- (d) Auto-detect from device

**29. Privacy/compliance posture?** *(Serbia's ZZPL is GDPR-like; health-ish data)*
- (a) GDPR-style basics: consent, privacy policy, export/delete  ← chosen
- (b) Minimal: privacy policy page only
- (c) Full GDPR readiness incl. DPA, data residency in EU
- (d) Defer until after beta

**30. Seed food database size at launch?**
- (a) ~100 items, grow via crowdsourcing
- (b) ~300 items curated                              ← chosen
- (c) 500+ items incl. OFF import
- (d) Start minimal (~50), focus on staples
