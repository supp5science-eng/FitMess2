# FitMess — Launch Video

A motion-graphics launch/explainer video for **FitMess**, built in
[Remotion](https://remotion.dev) so every frame is code you can edit.
On-brand with the app: dark surface, teal (`#17d1a8`), warm gold over-target
accent, and the app's own hand-drawn charts (calorie ring, macro bars, weight
trend). Tone is **zero-shame**, Serbian-first — the same as the product.

> "Praćenje kalorija bez griže savesti. Nedelja je jedinica uspeha, ne pojedini dan."

## Quick start

```bash
cd launch-video
npm install
npm run studio      # opens Remotion Studio at http://localhost:3000
```

In the Studio you get a live timeline, per-scene scrubbing, and props editing —
tweak anything and it hot-reloads.

## Render to MP4

```bash
npm run render            # 1080×1920 (9:16) → out/fitmess-launch-9x16.mp4   ← primary
npm run render:landscape  # 1920×1080 (16:9) → out/fitmess-launch-16x9.mp4
```

Override quality/format on the CLI, e.g.:

```bash
npx remotion render FitMessLaunchVertical out/hi.mp4 --crf=16 --codec=h264
npx remotion render FitMessLaunchVertical out/frames.png --sequence   # PNG frames
```

## Compositions

| ID | Size | For |
|---|---|---|
| `FitMessLaunchVertical` | 1080×1920 (9:16) | **primary** — Reels / TikTok / Stories |
| `FitMessLaunch` | 1920×1080 (16:9) | YouTube, website hero, decks |

Both are **34.7 s** (1040 frames @ 30 fps) and reuse the same scenes; each scene
reads `useVideoConfig()` and re-flows for the aspect ratio (in the Studio, just
switch composition in the left sidebar to see 9:16 vs 16:9).

## Scene order

Defined in [`src/LaunchVideo.tsx`](./src/LaunchVideo.tsx) — edit the `SCENES`
array to reorder or re-time. The total length follows automatically.

1. **Hook** — "Jedan loš dan nije kraj sveta." (zero-shame cold open)
2. **LogoReveal** — the three-stroke mark draws itself on
3. **Problem** — how other trackers shame you (angry red — *portrayed*, then shattered)
4. **Promise** — the reframe: calm signal, a plan you can keep
5. **FeatureDanas** — `/danas` calorie ring + macro bars in the phone
6. **FeatureAnalitika** — `/analitika` weekly bars + weight trend
7. **FeatureDodaj** — `/dodaj` type → tap → logged in seconds
8. **FeatureGrid** — breadth montage (plan, weight, privacy, Serbian, Agent…)
9. **Tagline** — "Praćenje kalorija bez griže savesti."
10. **Outro** — logo, `fitmess.app`, phone-only CTA

## Where to edit

```
src/
├── index.ts              # registerRoot
├── Root.tsx              # the two <Composition>s (sizes / fps / duration)
├── LaunchVideo.tsx       # scene order + per-scene durations  ← re-time here
├── theme.ts              # brand colors  ← swap palette here
├── fonts.ts              # Inter (Google Fonts, bundled)
├── animate.ts            # shared fade / rise helpers
├── components/           # reusable: Background, KineticText, Logo,
│                         #   CalorieRing, MacroBars, WeightTrend, PhoneFrame
└── scenes/               # one file per scene above
```

Common tweaks:

- **Change a headline** → edit the `text` prop of `<KineticText>` in that scene.
  Wrap a word in `*asterisks*` to give it the teal highlight.
- **Retime a scene** → change its `duration` in `src/LaunchVideo.tsx`.
- **Rebrand colors** → edit `src/theme.ts` (everything reads from there).
- **Change the numbers** in the ring / bars / trend → props on `<CalorieRing>`,
  `<MacroBars>`, `<WeightTrend>`, `<WeeklyBars>`.

## Music

No audio track is bundled (nothing licensed to ship). To add one, drop a file in
`public/` and add `<Audio src={staticFile("track.mp3")} />` inside
`LaunchVideo`. The scene cuts are spaced for a ~120 BPM bed if you want to sync.

## Notes

- Fonts load via `@remotion/google-fonts` and `waitUntilDone()` blocks render
  until Inter is ready, so text never falls back to a system font.
- The "shaming" red UI in the Problem scene is a deliberate portrayal of *other*
  apps — FitMess itself never uses punitive red (it uses the warm gold accent).
