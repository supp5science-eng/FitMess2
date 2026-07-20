import { describe, expect, it } from "vitest";

import { computeWeightTrend, formatTrendDayLabel } from "@/lib/weight/trend";

// F042/F043: pure weight-trend arithmetic. "now" is fixed to Wednesday
// 2026-07-15 12:00 Belgrade (10:00Z, CEST) for the "danas" label cases.
const NOW = new Date("2026-07-15T10:00:00.000Z");

describe("computeWeightTrend -- AS-074/AS-075", () => {
  it("returns an empty, non-throwing trend for no weigh-ins", () => {
    const trend = computeWeightTrend([], 75, NOW);
    expect(trend.points).toEqual([]);
    expect(trend.latestWeightKg).toBeNull();
    expect(trend.latestAvgKg).toBeNull();
    expect(trend.deltaToGoalKg).toBeNull();
    expect(trend.firstDay).toBeNull();
    expect(trend.lastDay).toBeNull();
    // Domain still brackets the goal so the chart can draw a goal line.
    expect(trend.minKg).toBeLessThan(75);
    expect(trend.maxKg).toBeGreaterThan(75);
  });

  it("a single weigh-in is its own rolling average and sits at x=0.5", () => {
    const trend = computeWeightTrend(
      [{ day: "2026-07-10", weight_kg: 82.4 }],
      null,
      NOW
    );
    expect(trend.points).toHaveLength(1);
    const p = trend.points[0]!;
    expect(p.weightKg).toBe(82.4);
    expect(p.rollingAvgKg).toBe(82.4);
    expect(p.x).toBe(0.5);
    expect(trend.latestWeightKg).toBe(82.4);
    expect(trend.latestAvgKg).toBe(82.4);
  });

  it("rolling average only averages weigh-ins inside the 7-day window", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-01", weight_kg: 90 }, // outside the window of 07-10
        { day: "2026-07-08", weight_kg: 84 }, // inside (2 days back)
        { day: "2026-07-10", weight_kg: 82 }, // the day itself
      ],
      null,
      NOW
    );
    const last = trend.points[2]!;
    // Window [07-04, 07-10] includes 07-08 and 07-10 only -> mean(84, 82) = 83.
    expect(last.rollingAvgKg).toBe(83);
    // 07-08's window [07-02, 07-08] includes 07-08 only (07-01 is 7 days back).
    expect(trend.points[1]!.rollingAvgKg).toBe(84);
  });

  it("positions points day-proportionally across gaps (x in 0..1)", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-01", weight_kg: 80 },
        { day: "2026-07-05", weight_kg: 80 }, // 4 of 10 days -> x = 0.4
        { day: "2026-07-11", weight_kg: 80 },
      ],
      null,
      NOW
    );
    expect(trend.points[0]!.x).toBe(0);
    expect(trend.points[1]!.x).toBeCloseTo(0.4, 5);
    expect(trend.points[2]!.x).toBe(1);
  });

  it("computes the goal delta with the right sign for a cut", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-08", weight_kg: 84 },
        { day: "2026-07-10", weight_kg: 82 },
      ],
      78,
      NOW
    );
    // latest avg = mean(84, 82) = 83; 83 - 78 = 5 kg still to lose.
    expect(trend.latestAvgKg).toBe(83);
    expect(trend.deltaToGoalKg).toBe(5);
  });

  it("goal delta is negative once the average is below the goal (a bulk)", () => {
    const trend = computeWeightTrend(
      [{ day: "2026-07-10", weight_kg: 70 }],
      72,
      NOW
    );
    expect(trend.deltaToGoalKg).toBe(-2);
  });

  it("the y-domain includes the goal line even when it's outside the data", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-08", weight_kg: 82 },
        { day: "2026-07-10", weight_kg: 82.4 },
      ],
      75,
      NOW
    );
    expect(trend.minKg).toBeLessThanOrEqual(75);
    expect(trend.maxKg).toBeGreaterThanOrEqual(82.4);
  });

  it("enforces a minimum y-span for a near-flat series", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-09", weight_kg: 82.0 },
        { day: "2026-07-10", weight_kg: 82.1 },
      ],
      null,
      NOW
    );
    expect(trend.maxKg - trend.minKg).toBeGreaterThanOrEqual(2);
  });

  it("rounds raw and average weights to one decimal", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-09", weight_kg: 82.25 },
        { day: "2026-07-10", weight_kg: 82.34 },
      ],
      null,
      NOW
    );
    expect(trend.points[0]!.weightKg).toBe(82.3);
    // mean(82.25, 82.34) = 82.295 -> 82.3
    expect(trend.points[1]!.rollingAvgKg).toBe(82.3);
  });

  it("keeps only the last value when a day appears more than once", () => {
    const trend = computeWeightTrend(
      [
        { day: "2026-07-10", weight_kg: 83 },
        { day: "2026-07-10", weight_kg: 82 },
      ],
      null,
      NOW
    );
    expect(trend.points).toHaveLength(1);
    expect(trend.points[0]!.weightKg).toBe(82);
  });
});

describe("formatTrendDayLabel", () => {
  it("labels today's Belgrade day as 'danas'", () => {
    expect(formatTrendDayLabel("2026-07-15", NOW)).toBe("danas");
  });

  it("labels other days as a short Serbian date", () => {
    const label = formatTrendDayLabel("2026-07-10", NOW);
    expect(label).toContain("10");
    expect(label).not.toBe("danas");
  });
});
