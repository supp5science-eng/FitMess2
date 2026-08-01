import { describe, expect, it } from "vitest";

import { computeWorkoutWeek } from "@/lib/workout/workout-week";

// Belgrade is UTC+2 in August, so a noon-UTC instant is safely mid-day locally.
const SATURDAY = new Date("2026-08-01T12:00:00.000Z");

describe("computeWorkoutWeek", () => {
  it("always returns seven days ending on the viewed one", () => {
    const week = computeWorkoutWeek([], SATURDAY);

    expect(week.days).toHaveLength(7);
    expect(week.days[6]!.dayKey).toBe("2026-08-01");
    expect(week.days[0]!.dayKey).toBe("2026-07-26");
    expect(week.days[6]!.isToday).toBe(true);
  });

  it("sums several sessions logged on the same day", () => {
    // The table is one row per session, so a double-session day arrives as two
    // rows -- reading only the first would quietly under-report it.
    const week = computeWorkoutWeek(
      [
        { day: "2026-08-01", kcal: 371, minutes: 60 },
        { day: "2026-08-01", kcal: 150, minutes: 25 },
      ],
      SATURDAY
    );

    expect(week.todayKcal).toBe(521);
    expect(week.todayMinutes).toBe(85);
  });

  it("scales the bars against the week's own busiest day, not a goal", () => {
    const week = computeWorkoutWeek(
      [
        { day: "2026-07-28", kcal: 200, minutes: 30 },
        { day: "2026-07-30", kcal: 400, minutes: 60 },
        { day: "2026-08-01", kcal: 100, minutes: 20 },
      ],
      SATURDAY
    );

    const byKey = new Map(week.days.map((day) => [day.dayKey, day]));
    expect(week.maxKcal).toBe(400);
    expect(byKey.get("2026-07-30")!.pct).toBe(1);
    expect(byKey.get("2026-07-28")!.pct).toBeCloseTo(0.5, 5);
    expect(byKey.get("2026-08-01")!.pct).toBeCloseTo(0.25, 5);
  });

  it("keeps its shape on a rest week instead of vanishing", () => {
    const week = computeWorkoutWeek([], SATURDAY);

    expect(week.maxKcal).toBe(0);
    expect(week.activeDaysCount).toBe(0);
    expect(week.days.every((day) => day.pct === 0)).toBe(true);
    // A week off is a fact about the week, not an error state -- the card still
    // draws seven empty bars.
    expect(week.days).toHaveLength(7);
  });

  it("ignores days outside the window", () => {
    const week = computeWorkoutWeek(
      [
        { day: "2026-07-20", kcal: 900, minutes: 120 },
        { day: "2026-08-01", kcal: 100, minutes: 20 },
      ],
      SATURDAY
    );

    // The old day must not set the scale for a week it isn't part of.
    expect(week.maxKcal).toBe(100);
    expect(week.activeDaysCount).toBe(1);
  });

  it("counts the days that had any training", () => {
    const week = computeWorkoutWeek(
      [
        { day: "2026-07-27", kcal: 300, minutes: 45 },
        { day: "2026-07-29", kcal: 200, minutes: 30 },
        { day: "2026-07-29", kcal: 100, minutes: 15 },
      ],
      SATURDAY
    );

    expect(week.activeDaysCount).toBe(2);
  });
});
