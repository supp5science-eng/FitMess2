import { describe, expect, it } from "vitest";

import { computeWeekSummary } from "@/lib/week/summary";

// F040/F041: pure weekly summary arithmetic. Anchored to the Belgrade week of
// 2026-07-13 (Mon) .. 2026-07-19 (Sun); "now" is fixed to Wednesday
// 2026-07-15 12:00 local (10:00Z, CEST) so elapsedDays = 3.
const NOW = new Date("2026-07-15T10:00:00.000Z");

describe("computeWeekSummary -- AS-068..AS-071", () => {
  it("buckets logs into Mon..Sun and derives spent / remaining / average", () => {
    const summary = computeWeekSummary(
      [
        { logged_at: "2026-07-13T09:00:00.000Z", kcal: 2000 }, // Mon
        { logged_at: "2026-07-14T09:00:00.000Z", kcal: 2500 }, // Tue
        { logged_at: "2026-07-15T08:00:00.000Z", kcal: 1000 }, // Wed (today)
      ],
      2000,
      NOW
    );

    expect(summary.days).toHaveLength(7);
    expect(summary.days.map((d) => d.kcal)).toEqual([
      2000, 2500, 1000, 0, 0, 0, 0,
    ]);
    expect(summary.weeklyBudget).toBe(14000);
    expect(summary.spentKcal).toBe(5500);
    expect(summary.remainingKcal).toBe(8500);
    expect(summary.overshootKcal).toBe(0);
    expect(summary.isOver).toBe(false);
    expect(summary.elapsedDays).toBe(3);
    expect(summary.loggedDaysCount).toBe(3);
    expect(summary.dailyAverage).toBe(1833); // round(5500 / 3)
    expect(summary.status).toBe("green");
  });

  it("marks today and future days correctly", () => {
    const summary = computeWeekSummary([], 2000, NOW);
    const wed = summary.days[2]!;
    const thu = summary.days[3]!;
    expect(wed.isToday).toBe(true);
    expect(wed.isFuture).toBe(false);
    expect(thu.isToday).toBe(false);
    expect(thu.isFuture).toBe(true);
    expect(summary.days[0]!.isFuture).toBe(false); // Monday, past
  });

  it("assigns a late-evening UTC log to the correct next Belgrade day", () => {
    // 2026-07-13T22:30Z = 2026-07-14 00:30 local -> Tuesday, not Monday.
    const summary = computeWeekSummary(
      [{ logged_at: "2026-07-13T22:30:00.000Z", kcal: 800 }],
      2000,
      NOW
    );
    expect(summary.days[0]!.kcal).toBe(0); // Mon
    expect(summary.days[1]!.kcal).toBe(800); // Tue
  });

  it("yellow when the daily average is slightly over target (<=105%)", () => {
    const summary = computeWeekSummary(
      [
        { logged_at: "2026-07-13T09:00:00.000Z", kcal: 2100 },
        { logged_at: "2026-07-14T09:00:00.000Z", kcal: 2100 },
        { logged_at: "2026-07-15T09:00:00.000Z", kcal: 2100 },
      ],
      2000,
      NOW
    );
    expect(summary.dailyAverage).toBe(2100); // 105% exactly
    expect(summary.status).toBe("yellow");
  });

  it("red when the daily average is well over target (>105%)", () => {
    const summary = computeWeekSummary(
      [
        { logged_at: "2026-07-13T09:00:00.000Z", kcal: 3000 },
        { logged_at: "2026-07-14T09:00:00.000Z", kcal: 3000 },
        { logged_at: "2026-07-15T09:00:00.000Z", kcal: 3000 },
      ],
      2000,
      NOW
    );
    expect(summary.status).toBe("red");
  });

  it("computes overshoot once the weekly budget is exceeded", () => {
    const logs = Array.from({ length: 3 }, (_, i) => ({
      logged_at: `2026-07-1${3 + i}T09:00:00.000Z`,
      kcal: 5000,
    }));
    const summary = computeWeekSummary(logs, 2000, NOW); // budget 14000, spent 15000
    expect(summary.isOver).toBe(true);
    expect(summary.remainingKcal).toBe(0);
    expect(summary.overshootKcal).toBe(1000);
  });

  it("empty week: green, zero average, no logged days (the empty state)", () => {
    const summary = computeWeekSummary([], 2000, NOW);
    expect(summary.spentKcal).toBe(0);
    expect(summary.loggedDaysCount).toBe(0);
    expect(summary.dailyAverage).toBe(0);
    expect(summary.status).toBe("green");
  });

  it("no target (<=0): zero budget, never throws, stays green", () => {
    const summary = computeWeekSummary(
      [{ logged_at: "2026-07-13T09:00:00.000Z", kcal: 500 }],
      0,
      NOW
    );
    expect(summary.weeklyBudget).toBe(0);
    expect(summary.status).toBe("green");
    expect(summary.spentKcal).toBe(500);
  });
});
