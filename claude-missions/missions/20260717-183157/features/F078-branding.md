# F078: Branding — rename to FitMess + logo, favicon, PWA icons

**Milestone:** M8 (branding/polish — runs in order near the end, per user)
**Estimated worker time:** 30 minutes
**Depends on:** F005 (shell) — additive, touches shared layout
**Origin:** User decision (2026-07-18): app name is **FitMess** (replaces the "Adaptive Cut" placeholder), with a provided logo.

## Assertion IDs covered
- (no new contract assertion) Supports AS-002 (Serbian branding), AS-127 (consistent visual identity), and AS-113/114 (PWA manifest identity, finalized in F070). This is a branding/identity pass, not a new contract requirement.

## Scope
- **Rename app-wide:** replace every user-visible "Adaptive Cut" (and any "Adaptive Cut Companion") with **FitMess**. Grep src/ for "Adaptive Cut" and update: root layout `<title>` / metadata, page titles, any header/nav brand text, auth pages, onboarding, home, and any Serbian copy that names the app. Keep the technical repo/project name as-is (that's just infrastructure).
- **Logo:** two source PNGs are staged at `missions/20260717-183157/assets/brand/`:
  - `fitmess-logo-white-bg.png` (dark grayscale Ж-mark on white/transparent — use for the LIGHT theme, which is the app's only theme)
  - `fitmess-logo-dark-bg.png` (inverse, for dark contexts / if needed)
  Copy the appropriate source(s) into `public/` (e.g. `public/logo.png`) and place the logo in the app header / top of the primary screens (tasteful, small — it's a clean minimal mark; pair with the "FitMess" wordmark in the app's font).
- **Favicon + icons:** generate from the logo — `favicon.ico` (or PNG favicon), `apple-touch-icon.png` (180×180), and PWA icons at 192×192 and 512×512 (and a maskable variant). The source is ~1024×1024, good for downscaling. Use `sharp` (add as a devDependency for a small generation script under `scripts/`) or an equivalent to produce the sizes; commit the generated icons in `public/`.
- **PWA manifest name:** set/prepare the manifest `name`="FitMess", `short_name`="FitMess" and wire the generated icons. NOTE: F070 (M8) builds the full manifest + service worker — if the manifest doesn't exist yet, create a minimal `public/manifest.json` with name + icons now and F070 will extend it; if it exists, update it. Also set `theme_color` to the app green (#16a34a) and `background_color` to the light background.
- Keep the single green accent (#16a34a) for UI; the logo itself stays its grayscale mark (do not recolor unless it reads poorly — if so, note it, don't force).

## Definition of done
- No user-visible "Adaptive Cut" remains (grep clean in src/); the app shows "FitMess" (title, header, auth, home).
- The logo renders in the app header at 375px without layout break; favicon + apple-touch-icon + 192/512 PWA icons exist in public/ and are valid images.
- `public/manifest.json` (or the existing one) has name "FitMess" + the icons.
- test/lint/typecheck/build all pass; a 375px screenshot of the home/auth screen showing the FitMess logo + name. Handoff at handoffs/F078-handoff.md, Status COMPLETE.

## Notes for the worker
- Serbian, ti form, single green accent, mobile-first 375px — unchanged.
- MCP tools NOT bound in workers; no DB needed for this feature.
- The logo is a minimal 3-stroke Ж-like mark in grayscale (light grey / dark grey / black). Present it cleanly; don't stretch or add heavy effects.
