# Handoff: F005 — Base app shell — sr-Latn, Inter, light theme, mobile-first

## Status
COMPLETE

## Assertions covered
AS-002: PASS — root page (`src/app/page.tsx`, unchanged) still renders the Serbian heading "Adaptive Cut" and Serbian body copy; nav labels (Danas/Nedelja/Agent/Profil) are also sr-Latn. Covered by `test_AS_002_root_page_serves_serbian_text` (`src/app/page.test.tsx`, pre-existing) and `test_AS_002_bottom_nav_renders_four_serbian_tab_labels` / `test_AS_002_bottom_nav_links_point_to_the_expected_serbian_routes` (`src/components/shell/bottom-nav.test.tsx`, new). Also verified visually in both screenshots below.
AS-125: PASS — `AppShell` column is `max-w-[430px]` + `overflow-x-hidden` + `w-full`; `globals.css` base layer also forces `overflow-x-hidden` on `html`/`body` as a safety net. Covered by `test_AS_125_app_shell_column_is_capped_at_mobile_width_and_hides_horizontal_overflow` and `test_AS_125_base_layer_forces_overflow_x_hidden_on_html_and_body_as_a_global_safety_net`. Confirmed visually: `handoffs/evidence/F005/root-page-375px.png` (375x812 viewport, no horizontal scrollbar, content fully within frame).
AS-126: PASS — outer wrapper is `w-full` with a light `bg-muted` background; inner column is `mx-auto` and stays clamped to `max-w-[430px]` regardless of viewport width. Covered by `test_AS_126_app_shell_outer_wrapper_spans_full_width_and_centers_the_inner_column`. Confirmed visually: `handoffs/evidence/F005/root-page-desktop.png` (1440x900 viewport, white column centered on light-gray background with visible margins left/right).
AS-127: PASS — single green accent hex `#16a34a` (Tailwind green-600) drives `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`; `--accent`/`--accent-foreground` are lighter/darker tints of the same hue (no second brand color); `--background` stays near-white (`oklch(1 0 0)`); `.dark` block is present but inert (layout never applies a `dark` class, no theme toggle/next-themes wired). Covered by `test_AS_127_root_theme_defines_the_energetic_green_accent_as_primary`, `test_AS_127_same_accent_hue_is_reused_for_ring_and_sidebar_primary_not_a_second_color`, `test_AS_127_root_background_is_near_white_confirming_light_theme`, `test_AS_127_layout_never_applies_the_dark_class_leaving_dark_mode_scaffold_inert` (`src/app/theme.test.ts`), plus `test_AS_127_bottom_nav_marks_the_active_tab_with_the_single_accent_color_and_aria_current` (`src/components/shell/bottom-nav.test.tsx`).

## Files changed
src/app/layout.tsx
src/app/globals.css
src/app/theme.test.ts (new)
src/components/shell/app-shell.tsx (new)
src/components/shell/bottom-nav.tsx (new)
src/components/shell/app-shell.test.tsx (new)
src/components/shell/bottom-nav.test.tsx (new)
missions/20260717-183157/handoffs/evidence/F005/root-page-375px.png (new, evidence)
missions/20260717-183157/handoffs/evidence/F005/root-page-desktop.png (new, evidence)

## Commands run
`npm run test` (0) — 7 test files, 28 tests passed
`npm run lint` (0)
`npm run typecheck` (0)
`npm run build` (0) — `next build` production build succeeded, `/` prerendered as static content
`npm run start` + manual curl/puppeteer-core verification against the real production server (see Notes)

## Decisions made
- Picked `#16a34a` (Tailwind green-600) as the single energetic-green accent — vivid enough to read as "energetic" while keeping ~3.3:1 contrast against white (acceptable for large/bold UI text and icons per WCAG's 3:1 UI-component threshold; full AA 4.5:1 body-text contrast is not required here since the color is used for buttons/active states, not paragraph text). All accent touchpoints (`--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`) reuse this exact hex; `--accent`/`--accent-foreground` are a light tint (`#ecfdf5`) / darker shade (`#15803d`) of the same hue rather than an unrelated second color, per "ONE energetic-green accent... so all shadcn components inherit it."
- Bumped `--radius` from `0.625rem` to `1.25rem` to match the "large rounded cards" Cal AI-style aesthetic called out in discovery/clarification; all derived radii (`--radius-lg`, `-2xl`, etc.) scale from this one variable so future card components automatically get the bigger rounding.
- Replaced the F001-scaffolded Geist Sans/Geist Mono fonts with Inter (`next/font/google`), loaded once in `layout.tsx` and wired through the existing `--font-sans` CSS variable that `globals.css`/Tailwind already consumed — no downstream component needed to change. Dropped the unused `--font-mono`/Geist Mono reference entirely since nothing in the app used it.
- Gave the shell two background layers: a light-gray (`bg-muted`) full-width outer wrapper and a white (`bg-background`) inner column capped at `max-w-[430px]`. This is what makes AS-126's "centered column on a light background" visually legible on desktop (mobile-app-in-browser pattern, same idea as Cal AI's own web view) while staying literally light-themed (no gray/dark surface swap).
- `AppShell` (server component) owns layout/centering; `BottomNav` (client component, needs `usePathname`) owns navigation + active-tab highlighting. Split follows the existing convention (`src/lib/supabase/client.ts` vs `server.ts`) of keeping client-only hooks isolated to the smallest possible component.
- Nav routes (`/danas`, `/nedelja`, `/agent`, `/profil`) intentionally 404 for now per spec — later features (M2+) fill them in. Verified via curl that hitting `/danas` still renders inside the shared `AppShell`/root layout (the Next.js default not-found boundary composes with the root layout), so the nav frame stays visible even on a 404.
- Left the `.dark` CSS block in `globals.css` completely untouched (inert scaffold) rather than deleting it, per clarified scope ("leave any inert .dark scaffold unused"); `layout.tsx` never adds a `dark` class and no theme-toggle/next-themes package was introduced.
- Kept `Home` (`src/app/page.tsx`) and its existing test unchanged — it already satisfied AS-002 and slots correctly into the new shell's `flex flex-1 flex-col` content area (made `AppShell`'s content wrapper a flex container specifically so the page's own `flex-1` centering still works).

## Out-of-scope work needed
- `/danas`, `/nedelja`, `/agent`, `/profil` route implementations — explicitly deferred to later features per spec; the nav links to them today and they 404, which is the clarified expected behavior for F005.
- AS-128 (keyboard-reachable, labeled inputs, alt text) is referenced in the clarification's Round B follow-ups but was **not** in this feature's assigned assertion list; I applied reasonable accessibility defaults anyway (semantic `<nav aria-label>`, real `<a>` elements via `next/link`, `aria-current="page"` on the active tab, visible `focus-visible` ring), but did not write a dedicated AS-128 test — that assertion should be covered by whichever feature owns it.
- No dedicated a11y contrast test was written for the `#16a34a`-on-white combination; if a future feature assigns a strict WCAG-AA-for-normal-text assertion to the accent color, revisit the exact hue (e.g. darken to `#15803d` for normal-weight body text).

## Blockers
(none — Status is COMPLETE)

## Autonomous decisions
AUTONOMOUS_DECISION: Chose `#16a34a` (Tailwind green-600) as the exact accent hex — clarification round only settled "energetic-green" in the abstract (Round B decision 12), not a specific value, and this feature spec asked me to "pick a specific, pleasant energetic-green accent." Went with green-600 over the more saturated green-500 for better default text/icon contrast against the white shell.
AUTONOMOUS_DECISION: Increased `--radius` to `1.25rem` (from the F001-scaffolded `0.625rem`) to actively express "large rounded cards" from the Cal AI aesthetic referenced in discovery, since no later feature spec claims ownership of the base radius token.
AUTONOMOUS_DECISION: Gave the desktop/outside-column area a `bg-muted` (light gray) background distinct from the column's `bg-background` (white) so "centered column on a light background" (AS-126) is visually verifiable at a glance, rather than an all-white page where a centered column would be indistinguishable from full width.

## Notes for the next worker
- Evidence screenshots were captured with `puppeteer-core` driving the machine's installed Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) via `page.setViewport({width:375,height:812})` / `{width:1440,height:900}` against a real `next build && next start` production server on `localhost:3000`, per F001's documented gotcha that the bare `msedge --headless --screenshot` CLI flag mis-renders small viewports. The puppeteer-core script and its `node_modules` live only in the session scratchpad, not the repo (consistent with F001's approach).
- One extra debugging note for whoever builds `/danas` etc. next: Next.js's *default* not-found page (no custom `not-found.tsx` exists yet) injects its own inline `<style>` with a `@media (prefers-color-scheme: dark)` block and a `height:100vh` wrapper div. In headless Chromium that media query can flip to dark, and the `100vh` wrapper stacks on top of the shell's own `min-h-dvh`, pushing the bottom nav completely below the fold in a screenshot. This is stock Next.js 404 behavior, not something F005 introduced — but it means a real `not-found.tsx` (styled consistently with the shell, sr-Latn copy) would be a good addition whenever a feature needs one; I did not add one since no assertion requires it yet.
- `AppShell`'s content wrapper is `flex flex-1 flex-col` specifically so pages using `flex flex-1 flex-col items-center justify-center` (like the current `Home`) still vertically center correctly; keep that convention for new pages added under the shell.
- No MCP used — this feature has no external-service dependency (confirmed via `mcp-registry.md`, which lists Supabase as the only MCP and doesn't apply here).
