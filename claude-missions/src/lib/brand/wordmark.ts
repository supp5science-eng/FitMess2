/**
 * The "Mess" accent of the FitMess lockup, as data.
 *
 * On screen this is a CSS gradient (`--wordmark-grad` + `.fm-wordmark-accent`
 * in `src/app/globals.css`) sampled from the pear logo's iridescent shell --
 * teal → gold → blue → green. Two renderers can't use CSS at all:
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

/** Light surfaces (white paper, the desktop gate): deeper, saturated tones. */
export const WORDMARK_STOPS_LIGHT = [
  "#0e9c82",
  "#1b9ca0",
  "#b9862c",
  "#2c7cbe",
  "#18915f",
  "#2f9a50",
] as const;

/** Dark surfaces (the app shell, the share card): brighter shell tones. */
export const WORDMARK_STOPS_DARK = [
  "#26ddb6",
  "#35d3cc",
  "#ecc766",
  "#57a8ee",
  "#40d98c",
  "#63dd76",
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
  theme: "light" | "dark" = "light"
): string[] {
  const stops = theme === "dark" ? WORDMARK_STOPS_DARK : WORDMARK_STOPS_LIGHT;
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
