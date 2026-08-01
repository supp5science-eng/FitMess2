import { describe, expect, it } from "vitest";

import {
  FULL_EATEN_SHARE,
  MIN_EATEN_SHARE,
  clampEatenShare,
  eatenShareForGrams,
  eatenShareLabelKey,
  gramsForEatenShare,
} from "@/lib/log/eaten-share";

// "Nisam pojeo sve": the share of the photographed plate that was eaten. The
// tests below cover the two ways this can silently corrupt a day -- a share
// that shrinks the meal when nobody asked, and the two controls (slider and
// gram field) disagreeing about the same portion.

describe("clampEatenShare", () => {
  it("treats an unusable value as the whole plate, never as a smaller meal", () => {
    // The dangerous default: reading NaN as 0% would delete calories the user
    // actually ate, and they'd have no way to see it happened.
    expect(clampEatenShare(Number.NaN)).toBe(FULL_EATEN_SHARE);
    expect(clampEatenShare(Number.POSITIVE_INFINITY)).toBe(FULL_EATEN_SHARE);
  });

  it("holds the range", () => {
    expect(clampEatenShare(0)).toBe(MIN_EATEN_SHARE);
    expect(clampEatenShare(140)).toBe(FULL_EATEN_SHARE);
    expect(clampEatenShare(37.4)).toBe(37);
  });
});

describe("gramsForEatenShare", () => {
  it("changes nothing at 100%", () => {
    expect(gramsForEatenShare(420, FULL_EATEN_SHARE)).toBe(420);
  });

  it("takes the share of the served plate", () => {
    expect(gramsForEatenShare(400, 30)).toBe(120);
    expect(gramsForEatenShare(400, 50)).toBe(200);
  });

  it("survives a plate with no weight yet", () => {
    expect(gramsForEatenShare(0, 50)).toBe(0);
    expect(gramsForEatenShare(Number.NaN, 50)).toBe(0);
  });
});

describe("eatenShareForGrams", () => {
  it("is the inverse of the slider, so the two controls agree", () => {
    const served = 400;
    for (const share of [25, 50, 75, 100]) {
      const grams = gramsForEatenShare(served, share);
      expect(eatenShareForGrams(served, grams)).toBe(share);
    }
  });

  it("reads a typed-down figure as a smaller share", () => {
    expect(eatenShareForGrams(400, 200)).toBe(50);
  });

  it("caps at the whole plate when the typed figure is bigger", () => {
    // The caller re-bases the served amount in this case -- nobody eats 130%
    // of a plate; the estimate was simply low.
    expect(eatenShareForGrams(400, 520)).toBe(FULL_EATEN_SHARE);
  });

  it("falls back to the whole plate when there is nothing to divide by", () => {
    expect(eatenShareForGrams(0, 120)).toBe(FULL_EATEN_SHARE);
  });
});

describe("eatenShareLabelKey", () => {
  it("says 'all of it' only for an actually empty plate", () => {
    expect(eatenShareLabelKey(100)).toBe("dodaj.eaten.all");
    expect(eatenShareLabelKey(95)).toBe("dodaj.eaten.almostAll");
  });

  it("gives every step words a person would use", () => {
    expect(eatenShareLabelKey(75)).toBe("dodaj.eaten.mostOfIt");
    expect(eatenShareLabelKey(50)).toBe("dodaj.eaten.half");
    expect(eatenShareLabelKey(30)).toBe("dodaj.eaten.aThird");
    expect(eatenShareLabelKey(10)).toBe("dodaj.eaten.aBit");
  });
});
