import { describe, expect, it } from "vitest";

import {
  buildHabitProgress,
  checksInWindow,
  currentStreak,
  indexChecks,
  recentDayKeys,
  shiftDayKey,
  todayProgress,
  HABIT_DOTS_DAYS,
} from "@/lib/habits/streak";

describe("shiftDayKey", () => {
  it("test_shifts_within_a_month", () => {
    expect(shiftDayKey("2026-07-15", -1)).toBe("2026-07-14");
    expect(shiftDayKey("2026-07-15", 3)).toBe("2026-07-18");
  });

  it("test_crosses_month_and_year_boundaries", () => {
    expect(shiftDayKey("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("test_handles_a_leap_day", () => {
    expect(shiftDayKey("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("recentDayKeys", () => {
  it("test_returns_oldest_first_ending_today", () => {
    expect(recentDayKeys("2026-07-15", 3)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
    ]);
  });
});

describe("currentStreak", () => {
  it("test_counts_consecutive_days_including_today", () => {
    const days = new Set(["2026-07-15", "2026-07-14", "2026-07-13"]);
    expect(currentStreak(days, "2026-07-15")).toBe(3);
  });

  it("test_an_unchecked_today_does_not_break_a_run_through_yesterday", () => {
    // Opening the app in the morning must not show a 12-day run as 0 -- the
    // day isn't over yet.
    const days = new Set(["2026-07-14", "2026-07-13", "2026-07-12"]);
    expect(currentStreak(days, "2026-07-15")).toBe(3);
  });

  it("test_a_missed_yesterday_does_break_the_streak", () => {
    const days = new Set(["2026-07-13", "2026-07-12"]);
    expect(currentStreak(days, "2026-07-15")).toBe(0);
  });

  it("test_only_today_checked_is_a_streak_of_one", () => {
    expect(currentStreak(new Set(["2026-07-15"]), "2026-07-15")).toBe(1);
  });

  it("test_no_history_is_zero", () => {
    expect(currentStreak(new Set(), "2026-07-15")).toBe(0);
  });

  it("test_a_gap_further_back_stops_the_count", () => {
    const days = new Set([
      "2026-07-15",
      "2026-07-14",
      // 13th missing
      "2026-07-12",
      "2026-07-11",
    ]);
    expect(currentStreak(days, "2026-07-15")).toBe(2);
  });
});

describe("checksInWindow", () => {
  it("test_counts_only_days_inside_the_window", () => {
    const days = new Set([
      "2026-07-15", // today -- inside both windows
      "2026-07-10", // 6 days back -- inside the 7-day window (09.-15.07.)
      "2026-07-05", // 11 days back -- outside 7, inside 30
      "2026-06-01", // outside both
    ]);
    expect(checksInWindow(days, "2026-07-15", 7)).toBe(2);
    expect(checksInWindow(days, "2026-07-15", 30)).toBe(3);
  });
});

describe("indexChecks", () => {
  it("test_groups_rows_per_habit", () => {
    const index = indexChecks([
      { habit_id: "povrce", day: "2026-07-15" },
      { habit_id: "povrce", day: "2026-07-14" },
      { habit_id: "voda", day: "2026-07-15" },
    ]);

    expect(index.get("povrce")?.size).toBe(2);
    expect(index.get("voda")?.has("2026-07-15")).toBe(true);
    expect(index.get("nepostojeca")).toBeUndefined();
  });
});

describe("buildHabitProgress", () => {
  const habits = [
    { id: "protein", textSr: "Protein u 2 obroka.", enabled: true },
    { id: "povrce", textSr: "Povrće svaki dan.", enabled: true },
    { id: "voda", textSr: "Čaša vode pre obroka.", enabled: false },
  ];

  const rows = [
    { habit_id: "protein", day: "2026-07-15" },
    { habit_id: "protein", day: "2026-07-14" },
    { habit_id: "povrce", day: "2026-07-13" },
  ];

  it("test_joins_definitions_with_history", () => {
    const progress = buildHabitProgress(habits, rows, "2026-07-15");

    expect(progress).toHaveLength(3);
    expect(progress[0]).toMatchObject({
      id: "protein",
      doneToday: true,
      streak: 2,
      doneInHistory: 2,
    });
    // Checked the day before yesterday only -> yesterday breaks the run.
    expect(progress[1]).toMatchObject({
      id: "povrce",
      doneToday: false,
      streak: 0,
      doneInHistory: 1,
    });
  });

  it("test_keeps_disabled_habits_so_the_settings_panel_can_list_them", () => {
    const progress = buildHabitProgress(habits, rows, "2026-07-15");
    expect(progress[2]).toMatchObject({ id: "voda", enabled: false });
  });

  it("test_recent_days_are_oldest_first_and_flag_the_checked_ones", () => {
    const progress = buildHabitProgress(habits, rows, "2026-07-15");
    const dots = progress[0].recentDays;

    expect(dots).toHaveLength(HABIT_DOTS_DAYS);
    expect(dots[dots.length - 1]).toEqual({ dayKey: "2026-07-15", done: true });
    expect(dots[dots.length - 2]).toEqual({ dayKey: "2026-07-14", done: true });
    expect(dots[0].done).toBe(false);
  });

  it("test_a_habit_with_no_history_is_all_zeros_not_undefined", () => {
    const progress = buildHabitProgress(
      [{ id: "nova", textSr: "Nova navika.", enabled: true }],
      [],
      "2026-07-15"
    );

    expect(progress[0]).toMatchObject({
      doneToday: false,
      streak: 0,
      doneInHistory: 0,
    });
    expect(progress[0].recentDays).toHaveLength(HABIT_DOTS_DAYS);
  });
});

describe("todayProgress", () => {
  it("test_counts_only_tracked_habits", () => {
    const progress = buildHabitProgress(
      [
        { id: "a", textSr: "A", enabled: true },
        { id: "b", textSr: "B", enabled: true },
        // Disabled habits must not inflate the denominator.
        { id: "c", textSr: "C", enabled: false },
      ],
      [
        { habit_id: "a", day: "2026-07-15" },
        { habit_id: "c", day: "2026-07-15" },
      ],
      "2026-07-15"
    );

    expect(todayProgress(progress)).toEqual({ done: 1, total: 2 });
  });
});
