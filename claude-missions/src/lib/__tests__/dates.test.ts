import { describe, expect, it } from "vitest";

import {
  endOfBelgradeDayExclusive,
  getBelgradeDayRange,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";

// F028 / AS-046: "Log entries are assigned to calendar days in the
// Europe/Belgrade timezone." These tests are deliberately written against
// FIXED UTC instants (via `new Date("...Z")`) and assert against UTC-based
// expectations (`toISOString()`, `Date.UTC`), never against the test
// runner's own host-local timezone -- so they pass identically on any CI
// machine regardless of what timezone it runs in.

describe("AS-046: toBelgradeCalendarDay assigns a UTC instant to the correct Belgrade calendar day", () => {
  it("test_AS_046_a_late_evening_UTC_instant_in_winter_belongs_to_the_next_Belgrade_day", () => {
    // Winter -> Belgrade is UTC+1 (CET). 2026-01-15T23:30:00Z + 1h = 2026-01-16 00:30 local.
    const instant = new Date("2026-01-15T23:30:00.000Z");
    expect(toBelgradeCalendarDay(instant)).toBe("2026-01-16");
  });

  it("test_AS_046_an_instant_just_before_that_still_belongs_to_the_prior_Belgrade_day", () => {
    // 2026-01-15T22:30:00Z + 1h = 2026-01-15 23:30 local -- still the 15th.
    const instant = new Date("2026-01-15T22:30:00.000Z");
    expect(toBelgradeCalendarDay(instant)).toBe("2026-01-15");
  });

  it("test_AS_046_a_late_evening_UTC_instant_in_summer_DST_belongs_to_the_next_Belgrade_day", () => {
    // Summer -> Belgrade is UTC+2 (CEST). 2026-07-17T22:30:00Z + 2h = 2026-07-18 00:30 local.
    const instant = new Date("2026-07-17T22:30:00.000Z");
    expect(toBelgradeCalendarDay(instant)).toBe("2026-07-18");
  });

  it("test_AS_046_an_instant_just_before_midnight_in_summer_DST_still_belongs_to_the_prior_Belgrade_day", () => {
    // 2026-07-17T21:30:00Z + 2h = 2026-07-17 23:30 local -- still the 17th.
    const instant = new Date("2026-07-17T21:30:00.000Z");
    expect(toBelgradeCalendarDay(instant)).toBe("2026-07-17");
  });

  it("test_AS_046_exactly_midnight_UTC_in_the_middle_of_the_day_resolves_to_the_expected_local_day", () => {
    // 2026-07-17T00:00:00Z + 2h(CEST) = 2026-07-17 02:00 local.
    expect(toBelgradeCalendarDay(new Date("2026-07-17T00:00:00.000Z"))).toBe(
      "2026-07-17"
    );
  });
});

describe("AS-046: startOfBelgradeDay / endOfBelgradeDayExclusive produce correct UTC boundaries", () => {
  it("test_AS_046_winter_day_boundaries_are_offset_by_1_hour_from_UTC_midnight_CET", () => {
    // 2026-01-16 00:00:00 local (CET, UTC+1) == 2026-01-15T23:00:00Z.
    const start = startOfBelgradeDay(new Date("2026-01-16T10:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-01-15T23:00:00.000Z");

    const end = endOfBelgradeDayExclusive(new Date("2026-01-16T10:00:00.000Z"));
    expect(end.toISOString()).toBe("2026-01-16T23:00:00.000Z");
  });

  it("test_AS_046_summer_DST_day_boundaries_are_offset_by_2_hours_from_UTC_midnight_CEST", () => {
    // 2026-07-17 00:00:00 local (CEST, UTC+2) == 2026-07-16T22:00:00Z.
    const start = startOfBelgradeDay(new Date("2026-07-17T10:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-16T22:00:00.000Z");

    const end = endOfBelgradeDayExclusive(new Date("2026-07-17T10:00:00.000Z"));
    expect(end.toISOString()).toBe("2026-07-17T22:00:00.000Z");
  });

  it("test_AS_046_a_normal_non_transition_day_spans_exactly_24_hours", () => {
    const start = startOfBelgradeDay(new Date("2026-07-17T10:00:00.000Z"));
    const end = endOfBelgradeDayExclusive(new Date("2026-07-17T10:00:00.000Z"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("AS-046: DST-transition-period cases are handled correctly", () => {
  it("test_AS_046_the_spring_forward_transition_day_2026_03_29_is_exactly_23_hours_long", () => {
    // EU spring-forward: last Sunday of March (2026-03-29), clocks jump
    // 02:00 CET -> 03:00 CEST at 01:00 UTC. That calendar day therefore has
    // one fewer wall-clock hour than usual.
    const someInstantOnThatDay = new Date("2026-03-29T12:00:00.000Z");
    const start = startOfBelgradeDay(someInstantOnThatDay);
    const end = endOfBelgradeDayExclusive(someInstantOnThatDay);

    expect(toBelgradeCalendarDay(someInstantOnThatDay)).toBe("2026-03-29");
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    // Midnight local on the 29th (still CET, UTC+1) == 2026-03-28T23:00:00Z.
    expect(start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // Midnight local on the 30th (now CEST, UTC+2) == 2026-03-29T22:00:00Z.
    expect(end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("test_AS_046_the_fall_back_transition_day_2026_10_25_is_exactly_25_hours_long", () => {
    // EU fall-back: last Sunday of October (2026-10-25), clocks jump back
    // 03:00 CEST -> 02:00 CET at 01:00 UTC. That calendar day has one extra
    // wall-clock hour.
    const someInstantOnThatDay = new Date("2026-10-25T12:00:00.000Z");
    const start = startOfBelgradeDay(someInstantOnThatDay);
    const end = endOfBelgradeDayExclusive(someInstantOnThatDay);

    expect(toBelgradeCalendarDay(someInstantOnThatDay)).toBe("2026-10-25");
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    // Midnight local on the 25th (still CEST, UTC+2) == 2026-10-24T22:00:00Z.
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    // Midnight local on the 26th (now CET, UTC+1) == 2026-10-25T23:00:00Z.
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("test_AS_046_a_log_near_midnight_just_before_the_spring_forward_transition_lands_on_the_correct_day", () => {
    // 2026-03-28T22:30:00Z + 1h(CET, still in effect for the 28th) = 2026-03-28 23:30 local.
    expect(toBelgradeCalendarDay(new Date("2026-03-28T22:30:00.000Z"))).toBe(
      "2026-03-28"
    );
    // 2026-03-28T23:30:00Z + 1h = 2026-03-29 00:30 local -- the transition day itself.
    expect(toBelgradeCalendarDay(new Date("2026-03-28T23:30:00.000Z"))).toBe(
      "2026-03-29"
    );
  });

  it("test_AS_046_a_log_near_midnight_just_after_the_fall_back_transition_lands_on_the_correct_day", () => {
    // 2026-10-25T21:30:00Z + 2h(CEST, still in effect that whole calendar day per Belgrade wall clock) = 2026-10-25 23:30 local.
    expect(toBelgradeCalendarDay(new Date("2026-10-25T21:30:00.000Z"))).toBe(
      "2026-10-25"
    );
    // 2026-10-25T23:30:00Z + 1h(CET, transition already happened at 01:00 UTC) = 2026-10-26 00:30 local.
    expect(toBelgradeCalendarDay(new Date("2026-10-25T23:30:00.000Z"))).toBe(
      "2026-10-26"
    );
  });
});

describe("AS-046: getBelgradeDayRange combines both boundaries for a query-ready shape", () => {
  it("test_AS_046_returns_iso_strings_matching_startOfBelgradeDay_and_endOfBelgradeDayExclusive", () => {
    const now = new Date("2026-07-17T22:30:00.000Z");
    const range = getBelgradeDayRange(now);

    expect(range.startIso).toBe(startOfBelgradeDay(now).toISOString());
    expect(range.endIsoExclusive).toBe(
      endOfBelgradeDayExclusive(now).toISOString()
    );
    expect(new Date(range.startIso).getTime()).toBeLessThan(
      new Date(range.endIsoExclusive).getTime()
    );
  });

  it("test_AS_046_defaults_to_the_current_instant_when_called_with_no_argument", () => {
    const range = getBelgradeDayRange();
    expect(new Date(range.startIso).getTime()).toBeLessThan(
      new Date(range.endIsoExclusive).getTime()
    );
  });
});
