import { describe, expect, it } from "vitest";

import {
  computeStepsWeek,
  formatSteps,
  type StepsDayInput,
} from "@/lib/steps/steps-week";

// Deterministic "now": Wednesday 2026-07-22, 14:00 Europe/Belgrade.
// The 7-day window is 2026-07-16 (Thu) .. 2026-07-22 (Wed).
const NOW = new Date("2026-07-22T12:00:00Z");

const rows: StepsDayInput[] = [
  { day: "2026-07-22", steps: 6000 }, // today, under goal
  { day: "2026-07-21", steps: 12000 }, // yesterday, over goal
  { day: "2026-07-20", steps: 8000 }, // Monday, under goal
];

describe("formatSteps", () => {
  it("keeps the digits and groups thousands", () => {
    expect(formatSteps(500)).toBe("500");
    expect(formatSteps(12000).replace(/\D/g, "")).toBe("12000");
  });
});

describe("computeStepsWeek", () => {
  it("summarizes today vs the 10k goal", () => {
    const week = computeStepsWeek(rows, NOW);

    expect(week.days).toHaveLength(7);
    expect(week.goalSteps).toBe(10000);
    expect(week.todaySteps).toBe(6000);

    const today = week.days[6]!;
    expect(today.isToday).toBe(true);
    expect(today.longLabel).toBe("Danas");
    expect(today.reached).toBe(false);
    expect(today.pct).toBeCloseTo(0.6, 5);
  });

  it("labels yesterday and named weekdays, and flags goal days", () => {
    const week = computeStepsWeek(rows, NOW);

    expect(week.days[5]!.longLabel).toBe("Juče");
    expect(week.days[5]!.reached).toBe(true); // 12000 >= 10000

    const monday = week.days.find((d) => d.dayKey === "2026-07-20")!;
    expect(monday.longLabel).toBe("Ponedeljak");
  });

  it("averages over logged days and counts goal days + scale", () => {
    const week = computeStepsWeek(rows, NOW);

    expect(week.loggedDaysCount).toBe(3);
    expect(week.weekAvgSteps).toBe(8667); // (6000+12000+8000)/3
    expect(week.goalDaysCount).toBe(1); // only the 12000 day
    expect(week.maxSteps).toBe(12000); // max(goal, tallest day)
  });

  it("empty rows => zeros and a safe (goal-height) scale", () => {
    const week = computeStepsWeek([], NOW);

    expect(week.todaySteps).toBe(0);
    expect(week.loggedDaysCount).toBe(0);
    expect(week.weekAvgSteps).toBe(0);
    expect(week.goalDaysCount).toBe(0);
    expect(week.maxSteps).toBe(10000);
  });
});
