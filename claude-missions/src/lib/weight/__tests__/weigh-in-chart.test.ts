import { describe, expect, it } from "vitest";

import { computeWeighInChart } from "../weigh-in-chart";

// The Analitika chart draws BOTH the raw weigh-ins and the fitted line, and the
// fit is imported from the same module that decides whether to change a plan --
// a chart that disagreed with the card underneath it would make both useless.

describe("computeWeighInChart", () => {
  const weekly = [
    { day: "2026-07-06", weightKg: 90 },
    { day: "2026-07-13", weightKg: 89.5 },
    { day: "2026-07-20", weightKg: 89 },
  ];

  it("test_one_dot_is_not_a_trend_and_draws_nothing", () => {
    expect(computeWeighInChart([{ day: "2026-07-20", weightKg: 90 }])).toBeNull();
    expect(computeWeighInChart([])).toBeNull();
  });

  it("test_it_reports_the_fitted_weekly_rate_and_total_change", () => {
    const chart = computeWeighInChart(weekly)!;

    expect(chart.trendKgPerWeek).toBeCloseTo(-0.5, 2);
    expect(chart.changeKg).toBeCloseTo(-1, 2);
    expect(chart.currentKg).toBe(89);
    expect(chart.spanDays).toBe(14);
  });

  it("test_x_positions_follow_the_calendar_not_the_index", () => {
    // A weigh-in missed for a fortnight must LOOK like a fortnight's gap.
    const chart = computeWeighInChart([
      { day: "2026-07-06", weightKg: 90 },
      { day: "2026-07-13", weightKg: 89.5 },
      { day: "2026-08-03", weightKg: 88 },
    ])!;

    expect(chart.points.map((point) => point.x)).toEqual([0, 0.25, 1]);
  });

  it("test_the_dots_keep_the_real_readings_while_the_line_smooths_them", () => {
    const chart = computeWeighInChart([
      { day: "2026-07-06", weightKg: 90 },
      { day: "2026-07-13", weightKg: 91 }, // a salty Monday
      { day: "2026-07-20", weightKg: 89 },
    ])!;

    // The dot is untouched…
    expect(chart.points[1]!.weightKg).toBe(91);
    // …and the fit does not follow it up there.
    expect(chart.points[1]!.fittedKg).toBeLessThan(91);
  });

  it("test_bounds_leave_air_even_when_the_weight_never_moves", () => {
    const chart = computeWeighInChart([
      { day: "2026-07-06", weightKg: 80 },
      { day: "2026-07-13", weightKg: 80 },
    ])!;

    expect(chart.minKg).toBeLessThan(80);
    expect(chart.maxKg).toBeGreaterThan(80);
  });

  it("test_a_same_day_duplicate_cannot_appear_twice", () => {
    const chart = computeWeighInChart([
      { day: "2026-07-06", weightKg: 90 },
      { day: "2026-07-06", weightKg: 91 },
      { day: "2026-07-20", weightKg: 89 },
    ])!;

    expect(chart.points).toHaveLength(2);
  });

  it("test_unsorted_input_is_ordered_before_it_is_drawn", () => {
    const chart = computeWeighInChart([...weekly].reverse())!;

    expect(chart.points.map((point) => point.dayKey)).toEqual([
      "2026-07-06",
      "2026-07-13",
      "2026-07-20",
    ]);
  });

  it("test_labels_are_serbian_short_dates", () => {
    const chart = computeWeighInChart(weekly)!;

    expect(chart.points[0]!.label).toBe("6. jul");
    expect(chart.points[2]!.label).toBe("20. jul");
  });
});
