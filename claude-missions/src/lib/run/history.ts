/**
 * Trčanje: pure aggregation for the `/trcanje` home — the "this week" tallies
 * over a list of runs. Money-math rule: the home screen shows these numbers, so
 * they're computed and tested here, not summed inline in the component.
 */

/** The subset of a `runs` row these tallies need. */
export interface RunTotalsInput {
  /** Belgrade calendar day, `"YYYY-MM-DD"`. */
  day: string;
  distance_m: number;
  calories: number;
}

export interface RunTotals {
  runCount: number;
  distanceM: number;
  calories: number;
}

/**
 * Sum distance, calories, and count over `runs`. When `dayKeys` is given, only
 * runs whose `day` is in that set are counted (e.g. the current Belgrade week);
 * omit it to total every run passed in. Never throws on an empty list.
 */
export function summarizeRuns(
  runs: readonly RunTotalsInput[],
  dayKeys?: readonly string[]
): RunTotals {
  const allowed = dayKeys ? new Set(dayKeys) : null;
  return runs.reduce<RunTotals>(
    (totals, run) => {
      if (allowed && !allowed.has(run.day)) return totals;
      return {
        runCount: totals.runCount + 1,
        distanceM: totals.distanceM + run.distance_m,
        calories: totals.calories + run.calories,
      };
    },
    { runCount: 0, distanceM: 0, calories: 0 }
  );
}
