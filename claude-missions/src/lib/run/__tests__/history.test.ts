import { describe, expect, it } from "vitest";

import { summarizeRuns } from "@/lib/run/history";

const run = (day: string, distance_m: number, calories: number) => ({
  day,
  distance_m,
  calories,
});

describe("F-runs: summarizeRuns", () => {
  it("totals count, distance and calories over every run", () => {
    expect(
      summarizeRuns([
        run("2026-07-27", 5000, 360),
        run("2026-07-28", 3000, 210),
      ])
    ).toEqual({ runCount: 2, distanceM: 8000, calories: 570 });
  });

  it("is all-zero for no runs", () => {
    expect(summarizeRuns([])).toEqual({
      runCount: 0,
      distanceM: 0,
      calories: 0,
    });
  });

  it("counts only runs whose day is in the given week keys", () => {
    const runs = [
      run("2026-07-20", 4000, 280), // last week
      run("2026-07-27", 5000, 360),
      run("2026-07-28", 3000, 210),
    ];
    const week = ["2026-07-27", "2026-07-28", "2026-07-29"];
    expect(summarizeRuns(runs, week)).toEqual({
      runCount: 2,
      distanceM: 8000,
      calories: 570,
    });
  });
});
