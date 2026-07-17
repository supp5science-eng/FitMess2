# Description

_Captured: 2026-07-17T16:31:57Z_

# PRD: Adaptive Cut Companion — Serbian Market Fitness App

## 1. Product Vision

A calorie/macro tracking app for the Serbian market whose core differentiator is an **adaptive AI agent** that helps users recover from diet slip-ups instead of punishing them. When a user eats off-plan (cake at work, family lunch, night out), the agent recalculates their weekly budget, redistributes calories across upcoming days, and reassures them they're still on track.

**Philosophy: the week is the unit of success, not the day.** One bad meal never ruins anything. The app is a "safe harbor" (utočište), not a policeman. This directly attacks the #1 reason people quit diets: all-or-nothing thinking after one deviation.

**Approach: calorie budget + rules + logging — NOT fixed meal plans.** Users get a daily calorie/protein budget and flexible eating rules. They eat whatever they want within the budget. No rigid menus that collapse on day 3.

## 2. Target User

- Serbian speakers, primarily men 16–30, on a fat-loss phase (cut)
- Beginners/intermediates overwhelmed by conflicting fitness advice
- People who have tried and quit MyFitnessPal-style tracking before
- Language: Serbian (sr-Latn) throughout the entire UI and agent responses

## 3. Key Differentiators (vs MyFitnessPal / Cal AI)

1. **Adaptive agent, not passive tracker** — reacts to overshoots with a concrete recovery plan instead of a red number
2. **Weekly budget as the primary frame** — daily view exists but weekly view is the hero; one bad day looks visually small
3. **Verified Serbian food database** — Serbian products (Imlek, Bambi, Štark, Lidl/Maxi items) and traditional dishes (sarma, gibanica, pasulj, karađorđeva) with accurate values
4. **Forward-looking suggestions** — "You have 630 kcal and 60g protein left today, here are 3 Serbian-cuisine options" (competitors only look backward)
5. **Fully native Serbian language experience**, locally appropriate pricing

## 4. Core Features (MVP — v1)

### 4.1 Onboarding & Budget Calculation
- Inputs: sex, age, height, weight, activity level (5 tiers), goal (target weight + timeframe, e.g., -6 kg in 12 weeks)
- Calculate TDEE (Mifflin-St Jeor × activity multiplier)
- Derive daily calorie target (deficit capped at safe bounds: max ~25% below TDEE, never below 1400 kcal men / 1200 kcal women)
- Macro targets: protein 1.8–2.2 g/kg bodyweight, fat minimum 0.6 g/kg, rest carbs
- Output: daily budget + weekly budget + 3–5 simple eating rules (e.g., "protein in at least 2 meals", "vegetables daily")
- Optional: show a *suggested* day structure (breakfast ~500, lunch ~700, snack ~300, dinner ~600) as guidance, never as obligation

### 4.2 Meal Logging (3 methods, priority order)
1. **Manual entry from database** — search Serbian foods, select portion (grams or common units: "parče", "kašika", "šolja"), instant deduction from budget
2. **Label photo (declaration reading)** — user photographs the nutrition label; Claude vision reads the table, extracts kcal/protein/carbs/fat per 100g, user confirms portion; the product gets saved into the shared database (crowdsourced growth)
3. **Meal photo estimation** — user photographs a plate; Claude vision estimates contents and portions; clearly labeled as "gruba procena" (rough estimate); user can adjust before saving

Every log updates the "Preostalo danas" (remaining today) display immediately.

### 4.3 "Skrenuo sam" Agent (HERO FEATURE)
Chat interface (Serbian) where the user reports off-plan eating via text or photo.

Agent flow:
1. Estimate calories/macros of the deviation
2. Log it and recalculate remaining daily + weekly budget
3. If day is still salvageable → suggest what to eat for the rest of the day
4. If day is overshot → redistribute the excess across the next 2–3 days (e.g., -120 kcal/day) and/or suggest small activity additions; cap daily reductions so future days stay realistic (never cut more than ~200 kcal/day from a future day)
5. Always respond with a supportive, zero-guilt tone: "Nedelja ti je i dalje u deficitu. Ništa nije propalo."
6. If the weekly budget is blown beyond redistribution limits → extend the timeline slightly and say so honestly, without drama

Agent tone rules: peer-to-peer, direct, calm, never moralizing, never uses shame language, speaks Serbian naturally (not translated-sounding).

### 4.4 "Šta sad da pojedem?" (What should I eat now?)
Button/quick action: given remaining kcal + protein for today, agent suggests 2–3 concrete meal options from Serbian cuisine / common store products, with rough recipes or product names.

### 4.5 Weekly Dashboard
- Primary screen after logging: weekly budget ring/bar (spent vs. total), daily average vs. target, on-track indicator (green/yellow/red at week level)
- Weight trend chart: user weighs in 2–3×/week, app shows 7-day rolling average trend (not raw daily noise)
- Simple streak: "X nedelja u deficitu" (weeks on track, not days — reinforces philosophy)

### 4.6 Auth & Data
- Login required (email + Google OAuth via Supabase Auth)
- Store: profile, targets, logs, weigh-ins, agent conversations, custom foods

## 5. Explicitly OUT of MVP (v2+)
- Training plan builder (sold separately as PDF initially)
- Barcode scanning (label photo covers the use case; add GTIN lookup later via Open Food Facts + own DB)
- Meal plan / menu generation
- Wearable integrations, social features, gamification beyond streak
- Push notifications beyond a single optional daily reminder
- iOS/Android native apps (PWA first)

## 6. Food Database Strategy
- Seed manually: top ~300–500 items — Serbian staples (meso, mlečni, pekara, voće/povrće), common branded products (Imlek, Bambi, Štark, Polimark, store brands from Lidl/Maxi/Idea), traditional cooked dishes with per-100g estimates
- Import matching Serbian entries from Open Food Facts API where quality is good
- Grow via crowdsourced label photos (4.2 method 2) — new products verified by AI reading + flagged for admin review
- Schema: `foods(id, name_sr, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, common_units jsonb, source, verified boolean)`

## 7. Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, PWA-ready (installable, mobile-first)
- **Backend/DB:** Supabase (Postgres, Auth, Row Level Security, Storage for photos)
- **Hosting:** Cloudflare Pages
- **AI:** Two providers by task:
  - **Anthropic API (Claude)** — the agent: chat, "skrenuo sam" flow, food suggestions, communication around redistribution
  - **Google Gemini 3.1 Flash** — all vision tasks: nutrition label reading and meal photo estimation (fast + cheap for high-volume image calls)
- **Charts:** Recharts or lightweight alternative
- All AI calls (both providers) go through Next.js API routes / server actions (never expose API keys client-side). Log token usage per user per provider for cost monitoring.

## 8. Agent Implementation Notes
- System prompt contains: user profile, targets, current daily/weekly remaining, last 7 days of logs, weight trend — assembled server-side per request
- Redistribution is deterministic code, not LLM math: the LLM decides *communication and food suggestions*; a pure function computes the redistribution numbers and passes them into the prompt. Never let the LLM do arithmetic for budgets.
- Structured outputs: agent returns JSON `{estimated_kcal, estimated_macros, message_sr, redistribution: [{date, adjustment_kcal}]}` parsed and applied server-side after user confirmation
- Vision (Gemini 3.1 Flash) label reading: return structured JSON of the nutrition table; confidence field; if low confidence → ask user to retake photo. Gemini output feeds into the same confirmation flow before anything is saved.

## 9. UI/UX Direction — Cal AI-inspired
- **Aesthetic:** clean, minimal, white/light background, generous whitespace, large rounded cards, soft shadows, one accent color (suggest: energetic green or orange), large friendly numbers as the visual focus
- **Home screen:** big circular progress ring for today's remaining calories (center: "Preostalo 1.240 kcal"), three small macro bars below (Proteini / UH / Masti), recent meals as card list with thumbnails, floating "+" button for logging
- **Log flow:** tap "+" → bottom sheet with 3 options (Pretraži / Slikaj deklaraciju / Slikaj obrok) — max 2 taps to start logging
- **Weekly screen:** hero weekly ring + weight trend chart
- **Agent:** chat UI, warm and personal, agent has a name/avatar (suggest a simple friendly identity, not a corporate bot)
- Typography: modern sans (Inter or similar), numbers extra large and bold
- Mobile-first (375px baseline), works as installed PWA fullscreen
- Everything in Serbian latin script; casual "ti" form throughout

## 10. Success Metrics (v1)
- Activation: % of signups who log ≥3 meals in first 48h
- Core hypothesis: % of users who use "skrenuo sam" agent and are still active 7 days later (vs. those who don't)
- Retention: week-4 retention of onboarded users
- Database: # of verified Serbian foods

## 11. Build Phases for Claude Code
1. **Phase 1:** Project scaffold, Supabase schema + RLS, auth, onboarding flow + TDEE/budget calculation
2. **Phase 2:** Food database schema + seed script (start with ~100 items), manual logging flow, home screen with ring + remaining budget
3. **Phase 3:** Weekly dashboard + weigh-in tracking + trend chart
4. **Phase 4:** Agent — chat UI, server-side prompt assembly, deterministic redistribution engine, "šta sad da pojedem" quick action
5. **Phase 5:** Vision — label photo reading + meal photo estimation, crowdsourced food additions
6. **Phase 6:** Polish, PWA install flow, cost monitoring, beta with first 10–20 users

Work phase by phase. Do not skip ahead. Each phase ends with a working, deployable state.

---

# Addendum 1 — Barcode & Product Database Flow (Phase 2 + Phase 5 revision)

_Captured: 2026-07-17T17:43:04Z (during discovery round 2)_

Add barcode scanning as a first-class logging method. Full product flow:

Product identity: Every packaged product in the foods table is identified by its barcode (EAN-13 GTIN). Add a barcode column (unique, nullable — core foods like eggs/meat have no barcode).

Barcode scanning (no AI): Use a client-side barcode decoding library (e.g. html5-qrcode or a ZXing-based lib) to read EAN-13 from the camera. This is deterministic decoding, zero API cost. Scanning flow: camera reads GTIN → lookup in our foods table → if found, instant log with portion picker.

First-time product entry (user path): If barcode lookup fails (product not in DB), the app prompts the user to photograph: (1) the nutrition label, (2) the barcode (or both in one shot if visible). Gemini vision extracts product name, brand, and per-100g values (kcal, protein, carbs, fat) into a pre-filled confirmation form. User reviews/corrects and saves. The product is stored with its GTIN, marked "neprovereno" (unverified), and is immediately available to all users — via barcode scan AND text search.

Admin path (manual seeding): I (admin) will scan barcodes of products to register their GTIN, then manually enter verified nutrition values via the admin UI. Build the admin food editor to support: scan barcode → create/edit product entry → mark as verified. This lets me pre-populate verified branded Serbian products efficiently.

Search behavior: Text search covers all products (name + brand, Latin and Cyrillic input). Previously scanned/logged products by that user appear as "recommended" at the top of search and in a quick-add recents list.

Result: the database becomes a self-growing Serbian barcode→nutrition database. First user of any product pays one vision API call; every subsequent scan is a free instant DB hit.

Move barcode scanning from "out of MVP" into Phase 2 (scanning + lookup) and Phase 5 (vision-based first-time entry). Core foods (eggs, meat, bread, produce) remain seeded from public nutrition data without barcodes.
