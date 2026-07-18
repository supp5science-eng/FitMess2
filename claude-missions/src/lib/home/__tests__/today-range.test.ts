import { describe, expect, it } from "vitest";

import { getBelgradeDayRange } from "@/lib/dates";
import { getTodayRange } from "@/lib/home/today-range";

// F028 / AS-046: `getTodayRange` now delegates entirely to the shared
// Europe/Belgrade-aware `src/lib/dates.ts` (`getBelgradeDayRange`) -- these
// tests supersede F027's original (deliberately non-Belgrade,
// server-local-Date) assertions per that feature's own handoff note ("F028
// should replace or supersede those specific assertions ... when it lands
// the real timezone logic"). Written against FIXED UTC instants, never the
// test runner's own host-local timezone.

describe("F028 / AS-046: getTodayRange delegates to getBelgradeDayRange", () => {
  it("test_AS_046_getTodayRange_returns_exactly_what_getBelgradeDayRange_returns_for_the_same_instant", () => {
    const now = new Date("2026-07-17T14:30:00.000Z");
    expect(getTodayRange(now)).toEqual(getBelgradeDayRange(now));
  });

  it("test_AS_046_returns_midnight_to_midnight_Belgrade_local_day_boundaries", () => {
    // 2026-07-17 14:30 UTC == 2026-07-17 16:30 CEST (Belgrade summer, UTC+2).
    const now = new Date("2026-07-17T14:30:00.000Z");
    const { startIso, endIsoExclusive } = getTodayRange(now);

    // Midnight local (CEST, UTC+2) on 2026-07-17 == 2026-07-16T22:00:00Z.
    expect(startIso).toBe("2026-07-16T22:00:00.000Z");
    expect(endIsoExclusive).toBe("2026-07-17T22:00:00.000Z");
  });

  it("test_AS_046_defaults_to_the_current_instant_when_called_with_no_argument", () => {
    const { startIso, endIsoExclusive } = getTodayRange();
    expect(new Date(startIso).getTime()).toBeLessThan(
      new Date(endIsoExclusive).getTime()
    );
  });

  it("test_AS_046_a_moment_just_before_Belgrade_midnight_and_just_after_resolve_to_different_day_ranges", () => {
    // 2026-07-17T21:59:00Z + 2h(CEST) = 2026-07-17 23:59 local.
    const lateNight = new Date("2026-07-17T21:59:00.000Z");
    // 2026-07-17T22:01:00Z + 2h(CEST) = 2026-07-18 00:01 local.
    const earlyMorning = new Date("2026-07-17T22:01:00.000Z");

    const rangeA = getTodayRange(lateNight);
    const rangeB = getTodayRange(earlyMorning);

    expect(rangeA.startIso).not.toBe(rangeB.startIso);
  });
});
