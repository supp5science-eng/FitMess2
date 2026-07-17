# M1 Foundation — UX Behavioural Validation

Milestone: M1 | Mission: 20260717-183157
Validator: UX (running-app, read-only on project code)
Date: 2026-07-17
Method: `next dev -p 3100` (background, `.env` auto-loaded); `curl` for HTTP/status;
`puppeteer-core` + Microsoft Edge (CDP, explicit `page.setViewport`) for rendered-DOM
extraction, viewport measurement, and screenshots. Playwright MCP not registered for this
mission, per environment note.

Evidence dir: `missions/20260717-183157/handoffs/evidence/M1-ux/`

## Results

| Assertion | Verdict | Evidence | Reproduction |
|-----------|---------|----------|--------------|
| AS-001 | PASS | AS-001-headers.txt (HTTP/1.1 200 OK); measurements.json | `next dev -p 3100`; `curl -I http://localhost:3100/` -> 200 |
| AS-002 | PASS | root.html; measurements.json; AS-126-root-desktop.png | Load `/`; read rendered DOM `body.innerText` |
| AS-125 | PASS | measurements.json; AS-125-root-375px.png | Viewport 375x812; measure `documentElement.scrollWidth` vs `clientWidth` |
| AS-126 | PASS | AS-126-root-desktop.png; measurements.json | Viewport 1280x900; measure inner column rect |
| AS-127 | PASS | AS-127-bottomnav-active-danas.png; measurements.json | Load `/danas` at 375px; read nav link computed colors + `aria-current` |
| AS-007 | OUT-OF-SCOPE (DEFERRED) | n/a | Vercel live-deploy link deferred to deploy time; not tested here |

## Measured details

**AS-001 — app starts and serves HTTP 200 at /.**
`next dev` came up in ~1s with no errors (`✓ Ready`, `GET / 200`). `curl` returned
`HTTP/1.1 200 OK`, `Content-Type: text/html; charset=utf-8`.

**AS-002 — genuine Latin-script Serbian text in the rendered DOM.**
`<html lang="sr">`. Rendered `body.innerText`:
"Adaptive Cut / Aplikacija za praćenje ishrane i adaptivno mršavljenje. Uskoro stižu
prijava, unos obroka i nedeljni pregled. / Danas / Nedelja / Agent / Profil".
Contains genuine sr-Latn diacritics (praćenje, stižu, mršavljenje) — Latin script, not
Cyrillic, present in the live DOM (not merely source).

**AS-125 — no horizontal scroll at 375px.**
At viewport 375x812: `documentElement.scrollWidth = 375`, `clientWidth = 375`
=> scrollWidth <= clientWidth, no horizontal overflow. Confirmed visually in
AS-125-root-375px.png.

**AS-126 — centered mobile-width column on light background at desktop width.**
At viewport 1280x900: inner content column width = 430px (matches `max-w-[430px]`),
left margin = 425px, right margin = 425px (symmetric => centered). Column background is
white (lab 100 0 0) sitting on a lighter-gray full-width surround (`bg-muted`). Page
`scrollWidth = clientWidth = 1280` (no horizontal scroll at desktop either). See
AS-126-root-desktop.png.

**AS-127 — light theme, single green accent, bottom nav with accent on active tab.**
Theme is light (page background lightness ~96-100; no `dark` class applied by the layout).
Single accent color measured as `rgb(22,163,74)` = `#16a34a` (Tailwind green-600).
Bottom nav renders the four Serbian tabs Danas / Nedelja / Agent / Profil. On `/danas`
the Danas link has `aria-current="page"` and computed color `rgb(22,163,74)` (the accent),
while the other three tabs are neutral gray. Visual confirmation in
AS-127-bottomnav-active-danas.png (Danas label green, others gray).

## Notes / observations (not failures)

- The four nav routes (`/danas`, `/nedelja`, `/agent`, `/profil`) currently return HTTP 404
  by design for M1 (later features implement them). The AS-127 active-tab check was still
  valid because the shared AppShell/BottomNav composes with Next's not-found boundary, so the
  active-tab styling is present and measurable. Next.js's *default* 404 page uses a `100vh`
  wrapper that pushes the nav below the fold in a full-viewport screenshot, so the active-tab
  accent was captured by (a) direct DOM computed-color measurement and (b) an element-level
  screenshot of the nav (AS-127-bottomnav-active-danas.png) rather than a full-page shot.
- A Next.js dev-mode indicator ("N" badge, bottom-left) appears in screenshots; it is a dev
  overlay only and not part of the app UI.
- No project code was modified. puppeteer-core was installed only in the session scratchpad,
  not in the repo.

## Suggested fixes
None required for M1 behavioural assertions. Optional (already flagged by F005 handoff, not an
M1 gap): adding a styled sr-Latn `not-found.tsx` would make future full-page screenshots of
not-yet-built routes render the shell correctly, but no M1 assertion requires it.
