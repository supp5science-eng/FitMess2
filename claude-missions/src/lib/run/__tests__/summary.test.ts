import { describe, expect, it } from "vitest";

import { computeRunCalories } from "@/lib/run/calories";
import { computeRunSummary } from "@/lib/run/summary";
import type { RunRoutePoint } from "@/lib/types/db";

const M_PER_DEG = 111194.93;

/** A constant-speed straight run: `steps` legs of `metersPerStep` each,
 * one fix every `msPerStep` ms, heading due north from the equator. */
function straightRun(
  steps: number,
  metersPerStep: number,
  msPerStep: number
): RunRoutePoint[] {
  const dLat = metersPerStep / M_PER_DEG;
  const points: RunRoutePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push({ lat: i * dLat, lng: 0, t: i * msPerStep });
  }
  return points;
}

describe("F-runs: computeRunSummary", () => {
  it("summarises an empty / single-point trace to all zero", () => {
    const empty = computeRunSummary([]);
    expect(empty).toEqual({
      distanceM: 0,
      durationS: 0,
      paceSecPerKm: null,
      calories: 0,
      splits: [],
    });
    expect(computeRunSummary([{ lat: 0, lng: 0, t: 0 }])).toEqual(empty);
  });

  it("computes distance, active duration, pace, splits and calories together", () => {
    // 500 legs of 5 m every 1 s → 2500 m in 500 s (a steady 5 m/s = 3:20 /km).
    const summary = computeRunSummary(straightRun(500, 5, 1000), 70);

    expect(summary.distanceM).toBeCloseTo(2500, -1); // ±5 m
    expect(summary.durationS).toBe(500);
    expect(summary.paceSecPerKm).toBeCloseTo(200, 0);
    expect(summary.calories).toBe(computeRunCalories(summary.distanceM, 70));

    // two full km + a 500 m partial
    expect(summary.splits).toHaveLength(3);
    expect(summary.splits[0].distanceM).toBe(1000);
    expect(summary.splits[2].partial).toBe(true);
    expect(summary.splits[2].distanceM).toBeCloseTo(500, -1);
  });

  it("excludes a mid-run pause from the active duration", () => {
    const points: RunRoutePoint[] = [
      { lat: 0, lng: 0, t: 0 },
      { lat: 5 / M_PER_DEG, lng: 0, t: 1000 },
      // 60 s standing still (Pauza) — one big gap, no fixes logged
      { lat: 10 / M_PER_DEG, lng: 0, t: 61_000 },
      { lat: 15 / M_PER_DEG, lng: 0, t: 62_000 },
    ];
    const summary = computeRunSummary(points, 70);
    // three 5 m legs but the pause leg is dropped → ~10 m over 2 active s
    expect(summary.distanceM).toBeCloseTo(10, 0);
    expect(summary.durationS).toBe(2);
  });
});
