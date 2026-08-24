import { describe, expect, it } from "vitest";

import {
  WORDMARK_STOPS_ON_INK,
  WORDMARK_STOPS_ON_PAPER,
  wordmarkLetterColors,
} from "../wordmark";

// The "Mess" accent, as data — used by the renderers that can't run CSS: the
// PDF report and the generated share cards. Before this, the PDF printed a
// flat colour while every screen shimmered.

describe("wordmarkLetterColors", () => {
  it("test_gives_every_letter_its_own_colour", () => {
    const colors = wordmarkLetterColors(4, "paper");

    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("test_walks_the_overprint_in_order_ultramarine_to_ochre_and_back", () => {
    const [m, e, s1, s2] = wordmarkLetterColors(4, "paper");

    // Sampled at letter midpoints: out of the ultramarine, through the violet
    // and the single ochre pass, then back into deep ink.
    expect(m).toBe("#3730dc"); // ultramarine
    expect(e).toBe("#7255ae"); // toward the violet
    expect(s1).toBe("#a66e35"); // the ochre pass
    expect(s2).toBe("#2c2abd"); // back into the ink
  });

  it("test_the_on_ink_stops_are_lighter_than_the_on_paper_ones", () => {
    // Cream surfaces need deep inks; the few reversed surfaces that run the
    // lockup over a solid ultramarine field need lifted ones. Swapping them
    // would make one of the two unreadable.
    const luminance = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);

    const onPaper = WORDMARK_STOPS_ON_PAPER.reduce(
      (sum, c) => sum + luminance(c),
      0
    );
    const onInk = WORDMARK_STOPS_ON_INK.reduce((sum, c) => sum + luminance(c), 0);

    expect(onInk).toBeGreaterThan(onPaper);
  });

  it("test_degenerate_lengths_do_not_throw", () => {
    expect(wordmarkLetterColors(0)).toEqual([]);
    expect(wordmarkLetterColors(1)).toEqual([WORDMARK_STOPS_ON_PAPER[0]]);
  });
});
