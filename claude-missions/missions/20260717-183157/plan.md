# Plan — Adaptive Cut Companion

_Draft features (enriched later by `/mission-tasks`). 62 features, 8 milestones, dependency order. Estimated worker time per feature: 15–45 min. Each feature has a draft spec in `features/F<NNN>-<slug>.md`._

## M1 — Foundation  [GREEN — scrutiny + UX PASS 2026-07-17]

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F001 | Next.js 16 scaffold + Tailwind 4 + shadcn/ui init | 30 | none | AS-001, AS-002 |
| F002 | Supabase clients (browser/server via @supabase/ssr) + env plumbing + `.env.example` | 30 | F001 | AS-003 |
| F003 | Tooling: Vitest, ESLint, type-check scripts, sample passing test | 30 | F001 | AS-004, AS-005, AS-006 |
| F004 | Vercel project, git auto-deploy, production env vars | 30 | F001 | AS-007 |
| F005 | Base app shell: sr-Latn locale, Inter font, light theme tokens, mobile-first centered column | 45 | F001 | AS-002, AS-125, AS-126, AS-127 |

## M2 — Auth & Onboarding  [GREEN — scrutiny + UX PASS 2026-07-18]

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F010 | DB schema: profiles + targets tables, RLS policies | 45 | F002 | AS-013, AS-031 |
| F011 | Email/password signup + email verification flow | 45 | F010 | AS-008, AS-009, AS-017 |
| F012 | Google OAuth sign-in | 30 | F011 | AS-010 |
| F013 | Route protection middleware + sign out | 30 | F011 | AS-011, AS-012 |
| F014 | Budget engine: Mifflin-St Jeor TDEE, deficit caps, macro targets (pure functions + unit tests) | 45 | F003 | AS-021–AS-026, AS-030 |
| F015 | Onboarding wizard steps (sex, age, height, weight, activity, goal) | 45 | F013 | AS-018, AS-019 |
| F016 | Onboarding summary screen + persist targets | 30 | F015, F014 | AS-020, AS-031 |
| F017 | Eating rules: generation at onboarding + settings editing | 30 | F016 | AS-028, AS-029 |
| F018 | GDPR data export (JSON download) | 30 | F010 | AS-014 |
| F019 | Account deletion (self-serve) | 30 | F010 | AS-015, AS-016 |

## M3 — Food Database & Manual Logging

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F020 | Foods schema (per-100g macros, common_units jsonb, unique nullable barcode) + RLS | 30 | F010 | AS-032, AS-057 |
| F021 | Seed script: ≥300 curated Serbian foods | 45 | F020 | AS-033, AS-034 |
| F022 | Open Food Facts one-time import script (Serbian entries, quality filter) | 45 | F020 | AS-035 |
| F023 | Food search API: Latin + Cyrillic normalization, trigram fuzzy | 45 | F021 | AS-036, AS-037, AS-038 |
| F024 | Search UI + recents/quick-add list | 45 | F023 | AS-039, AS-040 |
| F025 | Log entry creation: grams + common units, portion picker | 45 | F024 | AS-041, AS-042 |
| F026 | Edit/delete log entries | 30 | F025 | AS-044, AS-045 |
| F027 | Home screen: remaining ring, macro bars, today's meals | 45 | F025 | AS-043, AS-047, AS-048, AS-049, AS-050 |
| F028 | Belgrade-timezone day boundaries + "+" bottom sheet (max 2 taps) | 30 | F027 | AS-046, AS-051 |

## M4 — Barcode & Admin

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F030 | Barcode scanner component (client-side ZXing/BarcodeDetector, EAN-13) | 45 | F005 | AS-052, AS-058 |
| F031 | Scan → DB lookup → portion picker → log flow | 30 | F030, F025 | AS-053, AS-054 |
| F032 | Unknown barcode → manual product entry form (pre-vision path) | 30 | F031 | AS-055, AS-056, AS-057 |
| F033 | Admin role (is_admin) + server-enforced admin guard | 30 | F010 | AS-059, AS-067 |
| F034 | Admin review queue: list unverified, verify, remove | 45 | F033, F020 | AS-060, AS-062, AS-063 |
| F035 | Admin food editor + scan-barcode-to-create | 45 | F034, F030 | AS-061, AS-064 |
| F036 | Admin users & signups page | 30 | F033 | AS-065 |

## M5 — Weekly Dashboard, Weight & Streak

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F040 | Weekly budget computation: Monday weeks, first-week proration (pure functions + tests) | 30 | F014 | AS-027, AS-068 |
| F041 | Weekly dashboard screen: ring, per-day totals, daily average, on-track indicator | 45 | F040, F027 | AS-068, AS-069, AS-070, AS-071 |
| F042 | Weigh-in recording (kg, 1 decimal, same-day replace) | 30 | F010 | AS-072, AS-073 |
| F043 | Weight trend chart: 7-day rolling average + raw points (Recharts) | 45 | F042 | AS-074, AS-075 |
| F044 | Streak: completed weeks within budget+5% | 30 | F040 | AS-076, AS-077 |
| F045 | Weekly auto-recalc of TDEE/budgets from weight trend + Serbian notice | 45 | F043, F014 | AS-078, AS-079 |
| F046 | Daily-target adjustments table + display plumbing (redistribution-ready) | 30 | F040 | AS-080 |

## M6 — "Skrenuo sam" Agent

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F050 | AI infra: Gemini client (@google/genai, agent+vision), streaming API route, token-usage logging, server-side caps | 45 | F002 | AS-100, AS-130 |
| F051 | Chat UI: streaming Serbian chat with agent identity/avatar | 45 | F050, F005 | AS-081, AS-082 |
| F052 | Server-side context assembly (profile, targets, remaining, 7-day logs, trend, summaries) | 45 | F050, F046 | AS-093 |
| F053 | Deterministic redistribution engine (200 kcal/day cap, 2–3 days, timeline extension; pure + tests) | 45 | F040 | AS-086, AS-087, AS-088, AS-089 |
| F054 | Agent structured output schema, parsing, retry, log-proposal confirmation UI | 45 | F051, F052 | AS-083, AS-084, AS-092 |
| F055 | Apply confirmed redistribution + log; reflect in daily/weekly views | 45 | F054, F053, F046 | AS-085, AS-090, AS-091 |
| F056 | "Šta sad da pojedem?" quick action | 30 | F052 | AS-094 |
| F057 | Conversation summarization job (30-min inactivity) + transcript pruning | 45 | F054 | AS-096, AS-097 |
| F058 | Cap-reached UX, provider-error handling, tone guardrails | 30 | F054 | AS-095, AS-098, AS-099, AS-101 |

## M7 — Vision

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F060 | Gemini client + vision API route + photo cap (10/day) integration | 45 | F050 | AS-106 |
| F061 | Photo capture/upload component + private Storage bucket | 45 | F005, F002 | AS-111 |
| F062 | Label reading → pre-filled product form (confidence, retake, corrections) | 45 | F060, F061 | AS-102, AS-103, AS-104, AS-112 |
| F063 | First-time product entry from scan flow (label + barcode → shared DB) | 30 | F062, F032 | AS-105 |
| F064 | Meal photo estimation → adjustable "gruba procena" log | 45 | F060, F061, F025 | AS-107, AS-108 |
| F065 | Thumbnail pipeline: compress ~200px, delete original | 30 | F064 | AS-109 |
| F066 | Label photo retention linked to food for admin review | 15 | F062, F034 | AS-110 |

## M8 — Polish, PWA & Compliance

| ID | Feature | Est | Depends | Assertions |
|----|---------|-----|---------|------------|
| F070 | PWA: manifest + Serwist service worker + offline message | 45 | F005 | AS-113, AS-114, AS-115 |
| F071 | Web Push daily reminder: opt-in, scheduling (cron), disable | 45 | F070 | AS-116, AS-117, AS-118 |
| F072 | Sentry integration (client + server, no credentials in events) | 30 | F001 | AS-119 |
| F073 | PostHog EU: consent gate + core events | 45 | F005 | AS-120, AS-121, AS-123 |
| F074 | Serbian privacy policy page + footer links | 30 | F005 | AS-122 |
| F075 | Admin AI cost dashboard | 30 | F036, F050 | AS-066 |
| F076 | Accessibility + Serbian copy audit pass (all screens) | 45 | all UI | AS-124–AS-128 |
| F077 | README/docs + deploy checklist | 30 | all | AS-129, AS-003 |

## Coverage

All assertions AS-001–AS-130 are covered by at least one feature (verified below in the summary). Milestone boundaries M2, M3, M4, M5, M6, M7, M8 are validator checkpoints — each ends in a deployable, demoable state.


---

## Clarification status

_All features auto-clarified via accept-and-continue on 2026-07-17 (star defaults; type-profiled). Each has clarifications/F<NNN>-clarification.md and an enriched spec._

- F001 [CLARIFIED-AUTO] [COMPLETE]
- F002 [CLARIFIED-AUTO] [COMPLETE]
- F003 [CLARIFIED-AUTO] [COMPLETE]
- F004 [CLARIFIED-AUTO] [COMPLETE] (AS-007 DEFERRED: user Vercel link at deploy)
- F005 [CLARIFIED-AUTO] [COMPLETE]
- F010 [CLARIFIED-AUTO] [COMPLETE via F010a]
- F010a [CLARIFIED-AUTO] [COMPLETE]
- F011 [CLARIFIED-AUTO] [COMPLETE]
- F012 [CLARIFIED-AUTO] [COMPLETE] (AS-010 interactive Google consent -> manual-qa.md)
- F013 [CLARIFIED-AUTO] [COMPLETE]
- F014 [CLARIFIED-AUTO] [COMPLETE]
- F015 [CLARIFIED-AUTO] [COMPLETE]
- F016 [CLARIFIED-AUTO] [COMPLETE]
- F017 [CLARIFIED-AUTO] [COMPLETE]
- F018 [CLARIFIED-AUTO] [COMPLETE]
- F019 [CLARIFIED-AUTO] [COMPLETE via F019a]
- F019a [CLARIFIED-AUTO] [COMPLETE]
- F020 [CLARIFIED-AUTO] [COMPLETE]
- F021 [CLARIFIED-AUTO]
- F022 [CLARIFIED-AUTO]
- F023 [CLARIFIED-AUTO]
- F024 [CLARIFIED-AUTO]
- F025 [CLARIFIED-AUTO]
- F026 [CLARIFIED-AUTO]
- F027 [CLARIFIED-AUTO]
- F028 [CLARIFIED-AUTO]
- F030 [CLARIFIED-AUTO]
- F031 [CLARIFIED-AUTO]
- F032 [CLARIFIED-AUTO]
- F033 [CLARIFIED-AUTO]
- F034 [CLARIFIED-AUTO]
- F035 [CLARIFIED-AUTO]
- F036 [CLARIFIED-AUTO]
- F040 [CLARIFIED-AUTO]
- F041 [CLARIFIED-AUTO]
- F042 [CLARIFIED-AUTO]
- F043 [CLARIFIED-AUTO]
- F044 [CLARIFIED-AUTO]
- F045 [CLARIFIED-AUTO]
- F046 [CLARIFIED-AUTO]
- F050 [CLARIFIED-AUTO]
- F051 [CLARIFIED-AUTO]
- F052 [CLARIFIED-AUTO]
- F053 [CLARIFIED-AUTO]
- F054 [CLARIFIED-AUTO]
- F055 [CLARIFIED-AUTO]
- F056 [CLARIFIED-AUTO]
- F057 [CLARIFIED-AUTO]
- F058 [CLARIFIED-AUTO]
- F060 [CLARIFIED-AUTO]
- F061 [CLARIFIED-AUTO]
- F062 [CLARIFIED-AUTO]
- F063 [CLARIFIED-AUTO]
- F064 [CLARIFIED-AUTO]
- F065 [CLARIFIED-AUTO]
- F066 [CLARIFIED-AUTO]
- F070 [CLARIFIED-AUTO]
- F071 [CLARIFIED-AUTO]
- F072 [CLARIFIED-AUTO]
- F073 [CLARIFIED-AUTO]
- F074 [CLARIFIED-AUTO]
- F075 [CLARIFIED-AUTO]
- F076 [CLARIFIED-AUTO]
- F077 [CLARIFIED-AUTO]
