import { describe, expect, it } from "vitest";

import {
  WORDMARK_STOPS_DARK,
  WORDMARK_STOPS_LIGHT,
  wordmarkLetterColors,
} from "../wordmark";

// The "Mess" accent, as data — used by the two renderers that can't run CSS:
// the PDF report and the Open Graph card. Before this, the PDF printed a flat
// teal while every screen shimmered.

describe("wordmarkLetterColors", () => {
  it("test_gives_every_letter_its_own_colour", () => {
    const colors = wordmarkLetterColors(4, "light");

    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("test_walks_the_gradient_in_order_teal_to_green", () => {
    const [m, e, s1, s2] = wordmarkLetterColors(4, "light");

    // Sampled at letter midpoints: near the first stop, through the gold and
    // blue in the middle, ending near the last.
    expect(m).toBe("#169c95"); // teal
    expect(e).toBe("#a5893b"); // toward the gold
    expect(s1).toBe("#2a7fb2"); // toward the blue
    expect(s2).toBe("#219459"); // green
  });

  it("test_the_dark_stops_are_lighter_than_the_light_ones", () => {
    // Light surfaces (white paper, the desktop gate) need deeper tones; the
    // dark app shell needs brighter ones. Swapping them would make one of the
    // two unreadable.
    const luminance = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);

    const light = WORDMARK_STOPS_LIGHT.reduce((s, c) => s + luminance(c), 0);
    const dark = WORDMARK_STOPS_DARK.reduce((s, c) => s + luminance(c), 0);

    expect(dark).toBeGreaterThan(light);
  });

  it("test_degenerate_lengths_do_not_throw", () => {
    expect(wordmarkLetterColors(0)).toEqual([]);
    expect(wordmarkLetterColors(1)).toEqual([WORDMARK_STOPS_LIGHT[0]]);
  });
});
