/**
 * The streak's warm accent -- amber -> orange, light to dark. Deliberately its
 * own colour, distinct from the app's teal (calories), violet (koraci) and sky
 * (voda) feature accents, so "niz" reads as its own thing: fire.
 *
 * The stops are THEME-AWARE CSS custom properties (`--streak-*` in
 * `globals.css`), the same per-theme approach the calorie ring's
 * `--gauge-grad-*` tokens use: the dark theme's bright amber washes out on the
 * light theme's white, so light deepens the whole ramp. Fed into the shared
 * `ProgressRing`, which renders the stops via `style` so `var()` resolves.
 */
export const FLAME_GRADIENT: [string, string, string] = [
  "var(--streak-1)",
  "var(--streak-2)",
  "var(--streak-3)",
];
