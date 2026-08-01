import { describe, expect, it } from "vitest";

import {
  DEFAULT_WEIGH_IN_DAY,
  lastScheduledWeighIn,
  nextScheduledWeighIn,
  normalizeWeighInDay,
  weighInDueState,
} from "../weigh-in-day";

// 2026-08-02 is a Sunday; 2026-08-03 a Monday. All fixtures below hang off
// that week so the weekday arithmetic is checkable by eye.

describe("normalizeWeighInDay", () => {
  it("test_bad_data_falls_back_to_sunday_rather_than_throwing", () => {
    expect(normalizeWeighInDay(null)).toBe(DEFAULT_WEIGH_IN_DAY);
    expect(normalizeWeighInDay(undefined)).toBe(DEFAULT_WEIGH_IN_DAY);
    expect(normalizeWeighInDay(7)).toBe(DEFAULT_WEIGH_IN_DAY);
    expect(normalizeWeighInDay(-1)).toBe(DEFAULT_WEIGH_IN_DAY);
    expect(normalizeWeighInDay(2.5)).toBe(DEFAULT_WEIGH_IN_DAY);
  });

  it("test_a_valid_day_is_kept", () => {
    expect(normalizeWeighInDay(0)).toBe(0);
    expect(normalizeWeighInDay(6)).toBe(6);
  });
});

describe("scheduling", () => {
  it("test_the_scheduled_day_is_today_when_today_is_the_chosen_day", () => {
    // Sunday, schedule = Sunday.
    expect(lastScheduledWeighIn("2026-08-02", 6)).toBe("2026-08-02");
  });

  it("test_a_monday_looks_back_to_yesterdays_sunday", () => {
    expect(lastScheduledWeighIn("2026-08-03", 6)).toBe("2026-08-02");
  });

  it("test_the_look_back_crosses_a_month_boundary", () => {
    // Saturday 1 August -> the Monday of that week is 27 July.
    expect(lastScheduledWeighIn("2026-08-01", 0)).toBe("2026-07-27");
  });

  it("test_the_next_scheduled_day_is_a_week_away_on_the_day_itself", () => {
    expect(nextScheduledWeighIn("2026-08-02", 6)).toBe("2026-08-09");
    expect(nextScheduledWeighIn("2026-08-03", 6)).toBe("2026-08-09");
  });
});

describe("weighInDueState", () => {
  it("test_a_user_who_never_weighed_in_is_asked", () => {
    const state = weighInDueState({
      todayKey: "2026-08-03",
      weighInDay: 6,
      lastWeighInDay: null,
    });

    expect(state.due).toBe(true);
    expect(state.scheduledDay).toBe("2026-08-02");
    expect(state.daysWaiting).toBe(1);
  });

  it("test_weighing_in_on_the_day_settles_the_week", () => {
    const state = weighInDueState({
      todayKey: "2026-08-03",
      weighInDay: 6,
      lastWeighInDay: "2026-08-02",
    });

    expect(state.due).toBe(false);
    expect(state.scheduledDay).toBe("2026-08-09");
    expect(state.daysWaiting).toBe(0);
  });

  it("test_last_weeks_weigh_in_does_not_settle_this_week", () => {
    const state = weighInDueState({
      todayKey: "2026-08-03",
      weighInDay: 6,
      lastWeighInDay: "2026-07-26",
    });

    expect(state.due).toBe(true);
  });

  it("test_the_nag_keeps_counting_and_never_gives_up", () => {
    // Five days past a Sunday nobody weighed in on.
    const state = weighInDueState({
      todayKey: "2026-08-07",
      weighInDay: 6,
      lastWeighInDay: "2026-07-26",
    });

    expect(state.due).toBe(true);
    expect(state.daysWaiting).toBe(5);
  });

  it("test_weighing_in_early_still_counts_once_the_day_arrives", () => {
    // Weighed on Saturday, schedule is Sunday: Sunday must not ask again.
    const state = weighInDueState({
      todayKey: "2026-08-02",
      weighInDay: 6,
      lastWeighInDay: "2026-08-01",
    });

    expect(state.due).toBe(false);
  });

  it("test_a_mid_week_weigh_in_does_not_consume_the_upcoming_slot", () => {
    // Weighed on Wednesday; the Sunday slot has not arrived yet, and when it
    // does it will still be asked for.
    const notYet = weighInDueState({
      todayKey: "2026-07-29",
      weighInDay: 6,
      lastWeighInDay: "2026-07-29",
    });
    expect(notYet.due).toBe(false);

    const onTheDay = weighInDueState({
      todayKey: "2026-08-02",
      weighInDay: 6,
      lastWeighInDay: "2026-07-29",
    });
    expect(onTheDay.due).toBe(true);
  });

  it("test_a_monday_schedule_works_the_same_way", () => {
    const state = weighInDueState({
      todayKey: "2026-08-05",
      weighInDay: 0,
      lastWeighInDay: null,
    });

    expect(state.scheduledDay).toBe("2026-08-03");
    expect(state.due).toBe(true);
    expect(state.daysWaiting).toBe(2);
  });
});
