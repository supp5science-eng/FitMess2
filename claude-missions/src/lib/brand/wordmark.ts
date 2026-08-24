/**
 * The "Mess" accent of the FitMess lockup, as data.
 *
 * On screen this is a CSS gradient (`--wordmark-grad` + `.fm-wordmark-accent`
 * in `src/app/globals.css`): the "Gravira" overprint -- ultramarine drifting
 * through indigo into a single ochre pass and back into deep ink. Two
 * renderers can't use CSS at all:
 *
 *  - the PDF report (`@react-pdf/renderer` has no gradient text, only a solid
 *    `color` per `<Text>`), and
 *  - the Open Graph share card (`next/og`).
 *
 * Rather than let each of those invent its own approximation (which is how the
 * PDF ended up flat teal while every screen shimmered), they paint the word
 * one letter at a time from these stops. Keep the values in sync with
 * `--wordmark-grad` in `globals.css` -- that file is the visual reference,
 * this one is the same palette in a form JS can read.
 */

/**
 * Printed ON PAPER -- the cream surfaces (the app, the PDF report, the share
 * cards). Deep, saturated inks, because they have to hold their own against a
 * light ground.
 */
export const WORDMARK_STOPS_ON_PAPER = [
  "#2f2ce6",
  "#3b32d6",
  "#7a5aa8",
  "#b5761f",
  "#3a37d1",
  "#15139c",
] as const;

/**
 * Printed ON INK -- the few surfaces that reverse the plate and run cream
 * type over a solid ultramarine field. Same walk through the gradient, lifted
 * so it reads against the ink instead of disappearing into it.
 */
export const WORDMARK_STOPS_ON_INK = [
  "#8f8dff",
  "#a79eff",
  "#c9a86a",
  "#e8c98a",
  "#9d9bff",
  "#7d7bf5",
] as const;

/**
 * Colours for the individual letters of a word, spread evenly across the
 * gradient -- the closest a per-character renderer gets to the CSS shimmer.
 *
 * Letters are sampled at their MIDPOINTS (so a 4-letter word reads
 * 12.5/37.5/62.5/87.5% of the way along) rather than at 0..100%, which would
 * waste both end stops on the outer letters and flatten everything between.
 */
export function wordmarkLetterColors(
  length: number,
  surface: "paper" | "ink" = "paper"
): string[] {
  const stops =
    surface === "ink" ? WORDMARK_STOPS_ON_INK : WORDMARK_STOPS_ON_PAPER;
  if (length <= 0) return [];
  if (length === 1) return [stops[0]];

  return Array.from({ length }, (_, index) => {
    const position = (index + 0.5) / length;
    return sampleStops(stops, position);
  });
}

/** Linear interpolation between evenly-spaced hex stops at `position` (0..1). */
function sampleStops(stops: readonly string[], position: number): string {
  const clamped = Math.min(1, Math.max(0, position));
  const scaled = clamped * (stops.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(stops.length - 1, lower + 1);
  return mixHex(stops[lower]!, stops[upper]!, scaled - lower);
}

function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  const channel = (index: number) =>
    Math.round(from[index]! + (to[index]! - from[index]!) * t);
  return (
    "#" +
    [channel(0), channel(1), channel(2)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
