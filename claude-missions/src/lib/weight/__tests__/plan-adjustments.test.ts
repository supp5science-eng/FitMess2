import { describe, expect, it } from "vitest";

import { DECLINE_SILENCE_DAYS, isSilenced } from "../plan-adjustments";

// A card that reappears every Sunday after being dismissed is a card people
// learn to tap past without reading -- and then the week it matters, they tap
// past that too. Declining buys two weeks of silence; accepting buys none,
// because a freshly changed plan is exactly the thing worth measuring next.

describe("isSilenced", () => {
  const TODAY = "2026-08-01";

  it("test_a_user_who_has_never_answered_is_not_silenced", () => {
    expect(isSilenced(null, TODAY)).toBe(false);
  });

  it("test_a_recent_decline_keeps_the_card_quiet", () => {
    expect(isSilenced({ day: "2026-07-26", accepted: false }, TODAY)).toBe(true);
  });

  it("test_the_silence_expires_after_two_weeks", () => {
    const justInside = "2026-07-19"; // 13 days ago
    const justOutside = "2026-07-18"; // 14 days ago

    expect(isSilenced({ day: justInside, accepted: false }, TODAY)).toBe(true);
    expect(isSilenced({ day: justOutside, accepted: false }, TODAY)).toBe(false);
    expect(DECLINE_SILENCE_DAYS).toBe(14);
  });

  it("test_accepting_a_change_silences_nothing", () => {
    // The new plan deserves to be measured too, and next week's weigh-in is
    // how we find out whether the correction was the right size.
    expect(isSilenced({ day: "2026-07-31", accepted: true }, TODAY)).toBe(false);
  });

  it("test_the_window_is_configurable_for_callers_that_need_it", () => {
    // A one-day window covers today and nothing else.
    expect(isSilenced({ day: TODAY, accepted: false }, TODAY, 1)).toBe(true);
    expect(isSilenced({ day: "2026-07-31", accepted: false }, TODAY, 1)).toBe(
      false
    );
  });

  it("test_it_crosses_a_month_boundary_correctly", () => {
    // 2026-08-01 minus 14 days is 2026-07-18, not "2026-08-(-13)".
    expect(isSilenced({ day: "2026-07-20", accepted: false }, TODAY)).toBe(true);
  });
});
