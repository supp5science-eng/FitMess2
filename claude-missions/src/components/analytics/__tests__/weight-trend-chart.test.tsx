import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { WeightTrendChart } from "@/components/analytics/weight-trend-chart";
import { computeWeightTrend } from "@/lib/weight/trend";

const NOW = new Date("2026-07-15T10:00:00.000Z");

function renderTrend(
  weighIns: { day: string; weight_kg: number }[],
  goal: number | null
) {
  const trend = computeWeightTrend(weighIns, goal, NOW);
  return render(
    <WeightTrendChart trend={trend} firstDayLabel="1. jul" lastDayLabel="danas" />
  );
}

describe("WeightTrendChart -- AS-074/AS-075", () => {
  it("draws the rolling-average line through every point when there are >= 2", () => {
    const { getByTestId } = renderTrend(
      [
        { day: "2026-07-08", weight_kg: 84 },
        { day: "2026-07-11", weight_kg: 83 },
        { day: "2026-07-14", weight_kg: 82 },
      ],
      null
    );
    const line = getByTestId("weight-trend-avg-line");
    // 3 points -> 3 "x,y" pairs.
    expect(line.getAttribute("points")?.trim().split(" ")).toHaveLength(3);
    expect(line.getAttribute("stroke")).toBe("var(--primary)");
  });

  it("renders the goal reference line when a goal weight is set", () => {
    const { getByTestId } = renderTrend(
      [
        { day: "2026-07-08", weight_kg: 82 },
        { day: "2026-07-14", weight_kg: 81 },
      ],
      79
    );
    expect(getByTestId("weight-trend-goal-line")).toBeTruthy();
  });

  it("draws no goal line when there is no goal weight", () => {
    const { queryByTestId } = renderTrend(
      [
        { day: "2026-07-08", weight_kg: 82 },
        { day: "2026-07-14", weight_kg: 81 },
      ],
      null
    );
    expect(queryByTestId("weight-trend-goal-line")).toBeNull();
  });

  it("draws no average line for a single weigh-in (just the raw point)", () => {
    const { queryByTestId } = renderTrend(
      [{ day: "2026-07-14", weight_kg: 82 }],
      null
    );
    expect(queryByTestId("weight-trend-avg-line")).toBeNull();
  });
});
