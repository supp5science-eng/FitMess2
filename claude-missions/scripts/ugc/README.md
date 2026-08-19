# UGC film — plan reveal

Renders a 1080×1920 / 24fps / H.264 screen-recording film of the last beat of
onboarding: the name field being typed, the CTA being pressed, the plan being
calculated, and the daily kcal counting up and settling.

Output lives in [`marketing/ugc/`](../../../marketing/ugc).

## What it renders

The stage is [`src/app/upitnik/ugc`](../../src/app/upitnik/ugc) — the shipped
markup of `components/onboarding/name-screen.tsx` and `plan-reveal.tsx`, class
for class, so it renders through the real stylesheets, tokens and Inter. The
number comes from the real budget engine (`computeBudgetSummary`), not a
literal: a 24-year-old man, 183 cm, 85 kg, lightly active, losing toward 78 kg
at the recommended 0.5 kg/week — 1879 BMR → 2584 TDEE → **2034 kcal/day**.

Only the *timing* is re-implemented. The shipped components animate on the wall
clock (CSS keyframes, `setTimeout`, `requestAnimationFrame`), which a
frame-stepped capture cannot seek, so the stage switches those off and
recomputes each animated property from a virtual clock, reproducing the same
keyframes, durations and easing curves the stylesheets declare. The film's calc
phase (600 ms) and count-up (800 ms) are deliberately shorter than the shipped
defaults (2500 ms / 1300 ms) so the reveal is not the second half of the clip.

## Running it

```bash
npm run dev -- -p 3111                      # in one shell
node scripts/ugc/capture.mjs --theme dark    # in another
node scripts/ugc/capture.mjs --theme light --out marketing/ugc/light.mp4
```

Flags: `--out`, `--theme light|dark`, `--port`, `--ffmpeg`, `--keep-frames`.

Needs Playwright (Chromium) and an **ffmpeg built with libx264** — pass
`--ffmpeg PATH`, set `FFMPEG_PATH`, or have `@ffmpeg-installer/ffmpeg`
resolvable. The ffmpeg Playwright bundles is VP8-only and cannot encode H.264.

The capture is frame-stepped, not screen-recorded: the script sets the virtual
clock to `frame / 24` seconds, waits for the paint, and screenshots. The output
is identical every run regardless of how slow the renderer is — no dropped or
unevenly spaced frames.

## Why the route sits under `/upitnik`

That prefix is already public (`isPublicPath` in
`src/lib/auth/route-protection.ts`), so the capture needs no session and the
auth boundary needs no exception. The page 404s in production builds unless
`FITMESS_UGC_CAPTURE=1` is set.
