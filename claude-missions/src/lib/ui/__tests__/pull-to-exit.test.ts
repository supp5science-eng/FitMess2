import { describe, expect, it } from "vitest";

import {
  PULL_EXIT_DISTANCE_PX,
  isPullArmed,
  pullProgress,
} from "@/lib/ui/pull-to-exit";

// The gesture that gets you out of the Jarvis screen. It is the ONLY way out
// in an installed PWA -- no browser chrome, no bottom navigation -- so the two
// failure modes are opposite and both bad: firing on a stray flick, and not
// firing on a real pull.

describe("pullProgress", () => {
  it("test_pull_runs_zero_to_one_across_the_travel", () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(PULL_EXIT_DISTANCE_PX / 2)).toBe(0.5);
    expect(pullProgress(PULL_EXIT_DISTANCE_PX)).toBe(1);
  });

  it("test_pull_past_the_threshold_stays_at_one", () => {
    // Overshoot must not push the fill past opaque or the travel past its cap.
    expect(pullProgress(PULL_EXIT_DISTANCE_PX * 3)).toBe(1);
  });

  it("test_pulling_down_is_no_pull_not_negative_pull", () => {
    // Dragging the other way must not bank progress to be undone, and must
    // not drive the fill below its resting state.
    expect(pullProgress(-40)).toBe(0);
    expect(pullProgress(-1)).toBe(0);
  });

  it("test_pull_survives_a_nonsense_reading", () => {
    // A pointer event with no usable coordinate should read as "not pulling",
    // never as NaN written into a CSS variable.
    expect(pullProgress(Number.NaN)).toBe(0);
    expect(pullProgress(Number.POSITIVE_INFINITY)).toBe(0);
    expect(pullProgress(32, 0)).toBe(0);
    expect(pullProgress(32, Number.NaN)).toBe(0);
  });

  it("test_pull_honours_a_custom_distance", () => {
    expect(pullProgress(25, 100)).toBe(0.25);
  });
});

describe("isPullArmed", () => {
  it("test_armed_exactly_when_the_fill_is_full", () => {
    // The colour IS the threshold -- a half-red button must not leave.
    expect(isPullArmed(0)).toBe(false);
    expect(isPullArmed(0.99)).toBe(false);
    expect(isPullArmed(1)).toBe(true);
  });

  it("test_a_complete_pull_arms", () => {
    expect(isPullArmed(pullProgress(PULL_EXIT_DISTANCE_PX))).toBe(true);
    expect(isPullArmed(pullProgress(PULL_EXIT_DISTANCE_PX - 1))).toBe(false);
  });
});
