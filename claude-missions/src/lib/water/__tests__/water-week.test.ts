import { describe, expect, it } from "vitest";

import {
  computeWaterWeek,
  formatWaterSr,
  waterGoalMl,
  type WaterDayInput,
} from "@/lib/water/water-week";

// Deterministic "now": Wednesday 2026-07-22, 14:00 Europe/Belgrade.
// The 7-day window is 2026-07-16 .. 2026-07-22.
const NOW = new Date("2026-07-22T12:00:00Z");

describe("waterGoalMl", () => {
  it("derives ~35 ml/kg, rounded to 100 and clamped to 2.0–4.0 L", () => {
    expect(waterGoalMl(90)).toBe(3200); // 90 × 35 = 3150 -> 3200
    expect(waterGoalMl(60)).toBe(2100);
    expect(waterGoalMl(40)).toBe(2000); // 1400 -> clamped up
    expect(waterGoalMl(200)).toBe(4000); // 7000 -> clamped down
    expect(waterGoalMl(null)).toBe(2500); // fallback
  });
});

describe("formatWaterSr", () => {
  it("formats ml under 1 L as mL and above as L with a comma decimal", () => {
    expect(formatWaterSr(250)).toBe("250 mL");
    expect(formatWaterSr(1500)).toBe("1,5 L");
    expect(formatWaterSr(2000)).toBe("2 L");
    expect(formatWaterSr(3200)).toBe("3,2 L");
  });
});

describe("computeWaterWeek", () => {
  const goal = 3200;
  const rows: WaterDayInput[] = [
    { day: "2026-07-22", ml: 1500 }, // today, under goal
    { day: "2026-07-21", ml: 3500 }, // yesterday, over goal
  ];

  it("summarizes today vs goal", () => {
    const week = computeWaterWeek(rows, NOW, goal);

    expect(week.days).toHaveLength(7);
    expect(week.todayMl).toBe(1500);
    expect(week.goalMl).toBe(3200);
    expect(week.remainingMl).toBe(1700);
    expect(week.reachedToday).toBe(false);
    expect(Math.round(week.pct * 100)).toBe(47); // 1500 / 3200
  });

  it("averages only over days with intake and scales to include the goal line", () => {
    const week = computeWaterWeek(rows, NOW, goal);

    expect(week.loggedDaysCount).toBe(2);
    expect(week.weekAvgMl).toBe(2500); // (1500 + 3500) / 2
    expect(week.maxMl).toBe(3500); // max(goal, tallest day)
  });

  it("marks the last day as today and flags days that met the goal", () => {
    const week = computeWaterWeek(rows, NOW, goal);
    const today = week.days[6]!;
    const yesterday = week.days[5]!;

    expect(today.isToday).toBe(true);
    expect(today.reached).toBe(false);
    expect(yesterday.dayKey).toBe("2026-07-21");
    expect(yesterday.reached).toBe(true);
  });

  it("empty rows => zero today, zero logged days, empty-but-safe scale", () => {
    const week = computeWaterWeek([], NOW, goal);

    expect(week.todayMl).toBe(0);
    expect(week.loggedDaysCount).toBe(0);
    expect(week.weekAvgMl).toBe(0);
    expect(week.maxMl).toBe(goal); // goal keeps the scale non-zero
  });
});
