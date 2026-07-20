# FitMess — Motion

Motion graphics for FitMess (launch teasers, feature showcases, landing-page
video), built with **[Remotion](https://remotion.dev)** — video authored as
React components and rendered to real `.mp4`. Uses the app's actual brand
tokens (`src/theme.ts`, copied from the dark theme in `globals.css`), so every
video reads as the same product world as the app.

## What's here

| Composition id       | Aspect | Use                                  |
|----------------------|--------|--------------------------------------|
| `LaunchTeaser`       | 9:16   | Reels / TikTok / Stories (hero)      |
| `LaunchTeaser16x9`   | 16:9   | YouTube / landing-page hero embed    |
| `LaunchTeaser1x1`    | 1:1    | Instagram feed post                  |

One `LaunchTeaser` component drives all three — sizing is relative to the frame
height, so the same scenes re-lay-out per aspect ratio.

## Develop

```bash
cd motion
npm install
npm run dev          # opens Remotion Studio — live preview, scrub, tweak
```

## Render

```bash
npm run render       # -> out/fitmess-launch-9x16.mp4
npm run render:all   # all three aspect ratios
```

### Rendering in a sandbox / CI (no bundled Chromium download)

Remotion normally downloads its own Chromium. Where that's blocked, point it at
an existing **old-headless-capable** binary (Chrome-for-Testing's full binary
rejects old headless mode; use the `headless_shell`):

```bash
npm run render -- --browser-executable=/path/to/headless_shell
```

`remotion.config.ts` sets `setChromiumIgnoreCertificateErrors(true)` so Google
Fonts load through a TLS-terminating egress proxy. Drop that line for local dev.

## Structure

```
src/
├── index.ts              # registerRoot
├── Root.tsx              # the three compositions
├── theme.ts              # brand tokens (mirror of the app's dark theme)
├── fonts.ts              # Inter + Archivo Black (matches the app)
├── LaunchTeaser.tsx      # scene timeline
└── components/
    ├── GridBackground.tsx  # drifting tech grid + teal glow
    ├── Wordmark.tsx        # FitMess lockup (teal dot on the i)
    ├── CalorieRing.tsx     # the /danas calorie gauge, animated
    └── MacroBars.tsx       # protein / fat / carbs bars
```

## Roadmap ideas

- **Feature showcase** — 2–3 features (ring, weekly analitika, weight trend) in
  sequence; reuse `CalorieRing` / add a `WeightTrend` scene.
- **Explainer ("kako radi")** — longer, step-by-step walkthrough for the
  landing page (16:9). Same components, more narrative pacing.
