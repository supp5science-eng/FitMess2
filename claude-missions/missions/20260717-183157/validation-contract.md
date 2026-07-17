# Validation Contract — Adaptive Cut Companion

_Created: 2026-07-17. Immutable once `APPROVED` exists. New requirements append new IDs; existing assertions are never edited or renumbered._

## Foundation

AS-001: The application builds and starts locally without errors.
AS-002: The root URL serves a page whose visible text is in Serbian (sr-Latn).
AS-003: `.env.example` lists every required environment variable with placeholder values and no real secrets.
AS-004: The test suite runs and passes with the documented command.
AS-005: The linter passes with zero errors with the documented command.
AS-006: The type-check passes with zero errors with the documented command.
AS-007: A push to the main branch triggers an automatic production deployment that serves the app over HTTPS.

## Auth & Accounts

AS-008: A visitor can create an account with email and password.
AS-009: An email/password user cannot use the app before verifying their email; unverified users see a Serbian verification prompt.
AS-010: A user can sign in with Google OAuth.
AS-011: A signed-out visitor requesting any in-app page is redirected to the login screen.
AS-012: A signed-in user can sign out; afterwards protected pages redirect to login.
AS-013: A user cannot read or write another user's profile, logs, weigh-ins, or conversations; such attempts are denied at the database/API level.
AS-014: A user can download a JSON export containing all of their stored personal data.
AS-015: A user can delete their account from within the app; their personal data rows are removed.
AS-016: After account deletion, the deleted credentials no longer authenticate.
AS-017: A failed login shows a Serbian error message that does not reveal whether the email exists.

## Onboarding & Budget Calculation

AS-018: A newly verified user is routed through onboarding before reaching the home screen.
AS-019: Onboarding collects sex, age, height, weight, activity level (5 tiers), target weight, and timeframe.
AS-020: Onboarding ends with an editable summary screen; edits there change the saved values.
AS-021: BMR is computed with the Mifflin-St Jeor formula and matches known reference values in unit tests.
AS-022: TDEE equals BMR multiplied by the activity-level multiplier.
AS-023: The daily calorie target is never below 1400 kcal for men or 1200 kcal for women.
AS-024: The daily deficit is capped at 25% below TDEE.
AS-025: Protein target is within 1.8–2.2 g/kg bodyweight; fat is at least 0.6 g/kg; carbs are the remainder of calories.
AS-026: The weekly budget for a full week equals the daily target × 7.
AS-027: A user who signs up mid-week gets a first-week budget prorated as daily target × remaining days (including signup day).
AS-028: Onboarding produces 3–5 eating rules in Serbian.
AS-029: A user can toggle and edit their eating rules in settings.
AS-030: A goal that would exceed safe bounds is automatically adjusted to the caps, with a Serbian explanation shown.
AS-031: A returning user who completed onboarding lands on the home screen, not onboarding.

## Food Database

AS-032: A food record stores Serbian name, brand, per-100g kcal/protein/carbs/fat, common units, source, verified flag, and an optional unique barcode.
AS-033: The seed script loads at least 300 foods including Serbian staples and branded products.
AS-034: Traditional dishes (at minimum sarma, gibanica, pasulj) are seeded and findable by their Serbian names.
AS-035: The Open Food Facts import stores only entries with complete macro data and marks their source as OFF.
AS-036: Searching a food by its Latin-script name returns the matching food.
AS-037: Searching with Cyrillic input returns foods stored with Latin names.
AS-038: A search with a minor typo (one wrong/missing character) still returns the intended food.
AS-039: Unverified foods are marked "neprovereno" in search results.
AS-040: Foods the user previously logged appear at the top of search results and in a quick-add recents list.

## Meal Logging

AS-041: A user can log a food by gram amount; kcal and macros are computed from per-100g values.
AS-042: A user can log a food by a common unit (e.g. parče, kašika, šolja) where defined; conversion uses the unit's gram weight.
AS-043: Saving a log updates the "Preostalo danas" display immediately without a full page reload.
AS-044: A user can edit a logged entry's portion; daily totals recalculate.
AS-045: A user can delete a logged entry; daily totals recalculate.
AS-046: Log entries are assigned to calendar days in the Europe/Belgrade timezone.
AS-047: The home screen shows a circular ring with today's remaining calories in the center.
AS-048: The home screen shows three bars for protein, carbs, and fat with consumed vs target.
AS-049: The home screen lists today's logged meals.
AS-050: When the daily budget is exceeded, the home screen shows the overshoot amount with neutral Serbian copy and the app remains fully functional.
AS-051: From the home screen, starting any of the three logging methods takes at most 2 taps.

## Barcode Scanning

AS-052: The camera scanner decodes EAN-13 barcodes entirely client-side, with no AI or external API call.
AS-053: Scanning a barcode that exists in the database shows that food with a portion picker.
AS-054: Confirming a portion after a scan creates a log entry.
AS-055: Scanning a barcode not in the database offers a first-time product entry flow.
AS-056: A product created with a barcode is immediately findable by all users via scan and text search, marked "neprovereno".
AS-057: Creating a second product with an already-used barcode is rejected.
AS-058: If camera permission is denied, a Serbian message explains it and offers manual search instead.

## Admin

AS-059: A user whose profile has the admin flag can open the admin area; all other users are denied.
AS-060: The admin area lists unverified foods as a review queue.
AS-061: An admin can edit a food's name, brand, and nutrition values.
AS-062: An admin can mark a food verified; the "neprovereno" marker disappears for it.
AS-063: An admin can remove a food; it no longer appears in search or barcode lookup.
AS-064: The admin food editor supports scanning a barcode to create or open the product with that GTIN.
AS-065: The admin area shows a user list with signup dates and counts.
AS-066: The admin area shows AI token usage and estimated cost per provider.
AS-067: Admin API endpoints reject non-admin callers server-side, regardless of UI.

## Weekly Dashboard, Weight & Streak

AS-068: The weekly screen shows the current Monday-start week's consumed vs total budget.
AS-069: A week-level on-track indicator shows green/yellow/red based on weekly consumption vs budget.
AS-070: The weekly screen shows the daily average consumed vs the daily target.
AS-071: Each day of the current week is shown with its own total.
AS-072: A user can record a weigh-in in kilograms with one decimal place.
AS-073: Recording a second weigh-in on the same day replaces the earlier one.
AS-074: The weight chart shows a 7-day rolling average trend line.
AS-075: The weight chart also shows the raw weigh-in points distinctly from the trend line.
AS-076: The streak counts consecutive completed weeks whose total is at or below the weekly budget plus 5% tolerance.
AS-077: The current, incomplete week does not yet count toward the streak.
AS-078: Once per week, TDEE and budgets are recalculated automatically from the 7-day weight trend.
AS-079: After an automatic recalculation, the user sees a Serbian notice with the new budget.
AS-080: Daily targets shown in the UI include any active redistribution adjustments.

## "Skrenuo sam" Agent

AS-081: The chat interface accepts Serbian text messages and displays agent replies in Serbian.
AS-082: Agent replies stream into the chat token-by-token.
AS-083: When a user reports off-plan eating in chat, the agent estimates its kcal and macros and proposes a log entry.
AS-084: An agent-proposed log entry is saved only after explicit user confirmation.
AS-085: A confirmed agent-proposed entry appears in today's log and updates remaining budget.
AS-086: Redistribution numbers are computed by a deterministic server-side function whose outputs are unit-tested; the LLM never produces the arithmetic.
AS-087: No future day's target is reduced by more than 200 kcal through redistribution.
AS-088: An overshoot is redistributed across the next 2–3 days.
AS-089: When an overshoot exceeds what redistribution caps allow, the agent proposes a timeline extension instead, stated plainly.
AS-090: Redistribution is applied only after user confirmation.
AS-091: An applied redistribution changes the affected days' targets in the daily and weekly views.
AS-092: Agent output is parsed from a structured JSON schema; a malformed response triggers a retry and, on repeated failure, a Serbian error message without saving anything.
AS-093: The server-assembled agent context contains the user's current remaining daily and weekly budget matching the database state.
AS-094: The "Šta sad da pojedem?" action returns 2–3 concrete meal suggestions that fit within remaining kcal and protein for today.
AS-095: The agent's reply to an overshoot report contains reassurance and next steps, and no blame or shame language.
AS-096: Conversations idle for 30 minutes are summarized by a background job and the full transcript is deleted.
AS-097: Stored conversation summaries are included in the context of subsequent agent sessions.
AS-098: The 31st agent message in a user's day is blocked with a Serbian message stating when the cap resets.
AS-099: Manual logging continues to work while the AI cap is exhausted.
AS-100: Every AI call records token usage attributed to the user and provider.
AS-101: An AI provider error surfaces a friendly Serbian message with a retry option, and no partial data is saved.

## Vision (Labels & Meal Photos)

AS-102: Photographing a nutrition label extracts product name, brand, and per-100g kcal/protein/carbs/fat into a pre-filled form.
AS-103: A low-confidence label extraction asks the user to retake the photo.
AS-104: The user can correct any extracted value before saving.
AS-105: A label-created product with a captured barcode is stored with that GTIN and available to all users, marked "neprovereno".
AS-106: The 11th photo analysis in a user's day is blocked with a Serbian message stating when the cap resets.
AS-107: A meal photo produces estimated contents, kcal, and macros, labeled "gruba procena".
AS-108: A meal photo estimate can be adjusted before being saved as a log entry.
AS-109: After processing a meal photo, only a compressed thumbnail (~200px) is kept; the original is deleted.
AS-110: Label photos are retained in storage and linked to the food record for admin review.
AS-111: A user cannot access another user's stored photos.
AS-112: An unreadable photo produces a Serbian error with a retake option, and nothing is saved.

## PWA, Notifications, Observability & Compliance

AS-113: The app satisfies PWA installability (valid manifest and registered service worker).
AS-114: The installed PWA opens in standalone/fullscreen mode.
AS-115: When offline, the app shows a friendly Serbian offline message instead of broken UI.
AS-116: The browser push permission prompt appears only after the user explicitly enables the reminder in settings.
AS-117: A user with the reminder enabled receives a daily Web Push notification at their chosen time.
AS-118: Disabling the reminder stops further push notifications.
AS-119: Client and server errors are reported to Sentry, and reports contain no credentials.
AS-120: Analytics events are captured for signup, onboarding completion, meal logged, agent used, and photo logged.
AS-121: Analytics data is sent to the PostHog EU endpoint only.
AS-122: A Serbian privacy policy page is reachable from within the app.
AS-123: Analytics tracking starts only after user consent.
AS-124: All UI copy is Serbian latin script using the informal "ti" form.
AS-125: Core screens render at 375px width without horizontal scrolling.
AS-126: On desktop widths, the app renders as a centered mobile-width column.
AS-127: The UI uses a light theme with one consistent accent color.
AS-128: Form inputs have labels, images have alt text, and interactive elements are keyboard-reachable on core screens.
AS-129: The README documents setup, environment variables, and the run/test/lint/type-check commands.
AS-130: AI endpoints enforce per-user daily caps server-side; requests beyond the cap are rejected regardless of client behavior.
