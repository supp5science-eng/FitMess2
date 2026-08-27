/**
 * FitMess "Gravira" — the printing plate, ported to React Native.
 *
 * The web app (`claude-missions/src/app/globals.css`) is the source of truth
 * for these values and the reasoning behind them. This file is a TRANSCRIPTION,
 * not a redesign: same two inks, same warm second pass, same radii. When a
 * token changes there it changes here — the two must not drift, because the
 * store app and the site are the same product.
 *
 * ONE theme. The light/dark pair was retired on the web on 2026-08-24 and
 * nothing here reintroduces it: `paper` is always white, `ink` is always
 * ultramarine. If you are tempted to add a second palette, add a token to this
 * one instead.
 *
 * Two things the web can express that RN cannot, and how they are handled:
 *   - `color-mix(in srgb, ink 20%, transparent)` has no RN equivalent, so
 *     every mixed token below is pre-resolved to `rgba()` against the ink.
 *   - gradients are not a colour value in RN; the ramps live as arrays and are
 *     handed to `expo-linear-gradient` at the call site.
 */

/** The two inks the whole plate is printed with. */
const INK = "#1c1b8f";
const INK_BRIGHT = "#2f2ce6";

/** The ink at a given alpha — RN's stand-in for `color-mix`. */
const ink = (alpha: number) => `rgba(28, 27, 143, ${alpha})`;

export const colors = {
  /** The page ground and the raised card. Both white: a card is told apart by
   *  its hairline and its letterpress lift, the way a printed sheet is. */
  paper: "#ffffff",
  paperRaised: "#ffffff",

  ink: INK,
  inkBright: INK_BRIGHT,

  /** Semantic surfaces. */
  background: "#ffffff",
  foreground: INK,
  card: "#ffffff",
  cardForeground: INK,

  /** The loudest thing on any screen. */
  primary: INK_BRIGHT,
  primaryForeground: "#ffffff",

  secondary: "#f1f2f9",
  secondaryForeground: INK,
  muted: "#f4f5fa",
  mutedForeground: "#5654b4",
  accent: "#edeff8",
  accentForeground: INK,

  /** Brick, never a screen red — this palette has no pure red in it. Going
   *  OVER a target is NOT an error and uses `chart[4]` instead. */
  destructive: "#b03a20",

  /** Rules and hairlines are ink at low alpha, never grey. */
  border: ink(0.2),
  input: ink(0.3),
  ring: INK_BRIGHT,

  /** The calorie ring. */
  gauge: INK_BRIGHT,
  gaugeTrack: ink(0.11),

  /** Niz (streak) — the one deliberately warm accent, a second ochre pass. */
  streakAccent: "#b5651a",
  streakSoft: "rgba(217, 150, 58, 0.15)",
  streakLine: "rgba(181, 101, 26, 0.55)",

  /** Protein / fat / carbs must be told apart at a glance, but stay earthy. */
  macroProtein: "#2c7a58",
  macroFat: "#c05028",
  macroCarbs: "#9a7112",

  /** Water, steps and the four micronutrients. Fibre reuses protein's sage and
   *  saturated fat reuses carbs' ochre — same nutrient family, same ink. */
  markWater: "#1a6d92",
  markSteps: "#5f43a0",
  markFiber: "#2c7a58",
  markSugar: "#a83a72",
  markSodium: "#2c6e8f",
  markSatfat: "#9a7112",

  brand: INK_BRIGHT,
} as const;

/** A single ink ramp: dense to faint. `chart[4]` is the warm over-target mark. */
export const chart = ["#2f2ce6", "#5654b4", "#8583c2", "#a6a3c4", "#b5761f"] as const;

/** Gradients, as stops for `expo-linear-gradient`. */
export const gradients = {
  /** Bright at the start of the arc, deep at the end. */
  gauge: ["#6b69ff", "#2f2ce6", "#15139c"],
  /** "Mess" in the lockup: ultramarine drifting through indigo into a single
   *  ochre pass and back. Never applied to the word inside a sentence. */
  wordmark: ["#2f2ce6", "#4b3fd8", "#b5761f", "#3a37d1", "#15139c"],
  wordmarkLocations: [0, 0.24, 0.48, 0.74, 1],
} as const;

/** A printed card has a corner, not a bubble. Base is the web's 0.75rem. */
export const radius = {
  sm: 7,
  md: 10,
  lg: 12,
  xl: 17,
  xl2: 22,
  xl3: 26,
  xl4: 31,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xl2: 32,
  xl3: 48,
} as const;

/**
 * The letterpress lift — a HARD offset, not a soft drop shadow. The web draws
 * it with `box-shadow: 0 2px 0`; RN needs a zero-radius shadow on iOS and
 * elevation on Android to land in the same place.
 */
export const lift = {
  shadowColor: INK,
  shadowOpacity: 0.18,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 0,
  elevation: 2,
} as const;
