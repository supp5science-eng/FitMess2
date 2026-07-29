import { describe, expect, it } from "vitest";

import {
  TIER_MIN_DAYS,
  TIER_STYLES,
  tierForStreak,
  tierStyle,
  type ShareTier,
} from "@/lib/share/tier";

// The tier is the "iPhone effect" of the share cards (PRD §4): it must map a
// streak length to a look EXACTLY on the published boundaries, because the
// whole promise is that the look can only be earned, never skipped.

describe("tierForStreak", () => {
  it("test_maps_each_published_band_to_its_tier", () => {
    expect(tierForStreak(0)).toBe("standard");
    expect(tierForStreak(13)).toBe("standard");
    expect(tierForStreak(14)).toBe("silver");
    expect(tierForStreak(49)).toBe("silver");
    expect(tierForStreak(50)).toBe("gold");
    expect(tierForStreak(99)).toBe("gold");
    expect(tierForStreak(100)).toBe("onyx");
    expect(tierForStreak(365)).toBe("onyx");
  });

  it("test_boundaries_match_TIER_MIN_DAYS", () => {
    (Object.keys(TIER_MIN_DAYS) as ShareTier[]).forEach((tier) => {
      expect(tierForStreak(TIER_MIN_DAYS[tier])).toBe(tier);
      // One day below a threshold must NOT already be that tier (except the
      // floor tier, whose "one below" is negative and clamps to standard).
      if (TIER_MIN_DAYS[tier] > 0) {
        expect(tierForStreak(TIER_MIN_DAYS[tier] - 1)).not.toBe(tier);
      }
    });
  });

  it("test_floors_a_fractional_streak_to_the_lower_band", () => {
    // 13.9 days has not EARNED silver yet -- only a whole 14th logged day does.
    expect(tierForStreak(13.9)).toBe("standard");
    expect(tierForStreak(99.9)).toBe("gold");
  });

  it("test_clamps_junk_input_to_standard_instead_of_throwing", () => {
    // A card must always render; every non-finite/negative streak is "no
    // streak", which is Standard.
    expect(tierForStreak(-5)).toBe("standard");
    expect(tierForStreak(Number.NaN)).toBe("standard");
    expect(tierForStreak(Number.POSITIVE_INFINITY)).toBe("standard");
  });
});

describe("tierStyle", () => {
  it("test_only_onyx_carries_a_badge", () => {
    expect(tierStyle("standard").badge).toBeNull();
    expect(tierStyle("silver").badge).toBeNull();
    expect(tierStyle("gold").badge).toBeNull();
    expect(tierStyle("onyx").badge).toBe("ONYX");
  });

  it("test_only_onyx_is_the_dark_edition", () => {
    expect(tierStyle("onyx").dark).toBe(true);
    (["standard", "silver", "gold"] as ShareTier[]).forEach((tier) => {
      expect(tierStyle(tier).dark).toBe(false);
    });
  });

  it("test_every_tier_defines_a_full_concrete_palette_for_satori", () => {
    (Object.keys(TIER_STYLES) as ShareTier[]).forEach((tier) => {
      const style = tierStyle(tier);
      // satori cannot read CSS vars, so accents/frames must be literal colours.
      expect(style.accent).toMatch(/^#|^rgba?\(/);
      expect(style.frame).toMatch(/^#|^rgba?\(/);
      expect(style.photoOverlay).toMatch(/^#|^rgba?\(/);
    });
  });

  it("test_standard_hero_accent_is_pure_white", () => {
    // Standard is the "clean white palette" (PRD §4) -- the baseline everyone
    // starts from before any accent is earned.
    expect(tierStyle("standard").accent.toLowerCase()).toBe("#ffffff");
  });
});
