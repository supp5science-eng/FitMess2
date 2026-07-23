import { describe, expect, it } from "vitest";

import {
  PACE_MAX_WEEKLY_KG,
  PACE_MIN_WEEKLY_KG,
  PACE_ORDER,
  PACE_WEEKLY_KG,
  formatTimeToGoal,
  monthsWord,
  paceToPosition,
  positionForTimeframe,
  positionForWeeklyKg,
  positionToPace,
  timeframeWeeksForPace,
  timeframeWeeksForWeeklyKg,
  weeklyKgForPosition,
  weeksWord,
} from "@/lib/onboarding/pace";

describe("timeframeWeeksForPace", () => {
  it("derives weeks from the delta at the pace's weekly rate", () => {
    // 6 kg at 0.5 kg/week (recommended) -> 12 weeks.
    expect(timeframeWeeksForPace(6, "recommended")).toBe(12);
    // 6 kg at 0.25 (slow) -> 24 weeks; at 0.75 (fast) -> 8 weeks.
    expect(timeframeWeeksForPace(6, "slow")).toBe(24);
    expect(timeframeWeeksForPace(6, "fast")).toBe(8);
  });

  it("faster pace never needs more weeks than a slower one", () => {
    const slow = timeframeWeeksForPace(10, "slow");
    const rec = timeframeWeeksForPace(10, "recommended");
    const fast = timeframeWeeksForPace(10, "fast");
    expect(slow).toBeGreaterThanOrEqual(rec);
    expect(rec).toBeGreaterThanOrEqual(fast);
  });

  it("clamps to at least 1 week for tiny/zero/invalid deltas", () => {
    expect(timeframeWeeksForPace(0, "recommended")).toBe(1);
    expect(timeframeWeeksForPace(-5, "recommended")).toBe(1);
    expect(timeframeWeeksForPace(Number.NaN, "recommended")).toBe(1);
    expect(timeframeWeeksForPace(0.1, "recommended")).toBe(1);
  });

  it("has slow < recommended < fast weekly rates in slider order", () => {
    expect(PACE_ORDER).toEqual(["slow", "recommended", "fast"]);
    expect(PACE_WEEKLY_KG.slow).toBeLessThan(PACE_WEEKLY_KG.recommended);
    expect(PACE_WEEKLY_KG.recommended).toBeLessThan(PACE_WEEKLY_KG.fast);
  });
});

describe("formatTimeToGoal", () => {
  it("always expresses the time in weeks", () => {
    expect(formatTimeToGoal(1)).toBe("1 nedelja");
    expect(formatTimeToGoal(3)).toBe("3 nedelje");
    expect(formatTimeToGoal(7)).toBe("7 nedelja");
    expect(formatTimeToGoal(13)).toBe("13 nedelja");
    expect(formatTimeToGoal(26)).toBe("26 nedelja");
    expect(formatTimeToGoal(52)).toBe("52 nedelje");
  });
});

describe("slider position <-> pace", () => {
  it("maps each pace to an evenly-spaced position", () => {
    expect(paceToPosition("slow")).toBe(0);
    expect(paceToPosition("recommended")).toBe(0.5);
    expect(paceToPosition("fast")).toBe(1);
  });

  it("snaps a continuous position to the nearest pace", () => {
    expect(positionToPace(0)).toBe("slow");
    expect(positionToPace(0.2)).toBe("slow");
    expect(positionToPace(0.4)).toBe("recommended");
    expect(positionToPace(0.6)).toBe("recommended");
    expect(positionToPace(0.8)).toBe("fast");
    expect(positionToPace(1)).toBe("fast");
  });

  it("clamps out-of-range positions", () => {
    expect(positionToPace(-1)).toBe("slow");
    expect(positionToPace(2)).toBe("fast");
  });
});

describe("continuous dial position <-> weekly rate", () => {
  it("maps the sweep endpoints to the slow/fast bounds, midpoint to recommended", () => {
    expect(weeklyKgForPosition(0)).toBe(PACE_MIN_WEEKLY_KG);
    expect(weeklyKgForPosition(1)).toBe(PACE_MAX_WEEKLY_KG);
    expect(weeklyKgForPosition(0.5)).toBeCloseTo(PACE_WEEKLY_KG.recommended, 10);
  });

  it("clamps out-of-range positions to the bounds", () => {
    expect(weeklyKgForPosition(-1)).toBe(PACE_MIN_WEEKLY_KG);
    expect(weeklyKgForPosition(2)).toBe(PACE_MAX_WEEKLY_KG);
  });

  it("positionForWeeklyKg is the inverse of weeklyKgForPosition", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(positionForWeeklyKg(weeklyKgForPosition(t))).toBeCloseTo(t, 10);
    }
  });

  it("derives whole weeks from a continuous weekly rate", () => {
    // 6 kg at 0.5 kg/week -> 12 weeks; at 0.25 -> 24; at 0.75 -> 8.
    expect(timeframeWeeksForWeeklyKg(6, 0.5)).toBe(12);
    expect(timeframeWeeksForWeeklyKg(6, 0.25)).toBe(24);
    expect(timeframeWeeksForWeeklyKg(6, 0.75)).toBe(8);
  });

  it("clamps the derived timeframe to at least 1 week for tiny/invalid input", () => {
    expect(timeframeWeeksForWeeklyKg(0, 0.5)).toBe(1);
    expect(timeframeWeeksForWeeklyKg(6, 0)).toBe(1);
    expect(timeframeWeeksForWeeklyKg(Number.NaN, 0.5)).toBe(1);
  });

  it("reconstructs the dial position from a stored timeframe + delta", () => {
    // 6 kg over 12 weeks == 0.5 kg/week == recommended midpoint.
    expect(positionForTimeframe(6, 12)).toBeCloseTo(0.5, 10);
    // 6 kg over 24 weeks == 0.25 kg/week == slow end.
    expect(positionForTimeframe(6, 24)).toBeCloseTo(0, 10);
    // Missing inputs -> null so the caller can fall back to the default.
    expect(positionForTimeframe(null, 12)).toBeNull();
    expect(positionForTimeframe(6, null)).toBeNull();
    expect(positionForTimeframe(0, 12)).toBeNull();
  });
});

describe("Serbian plural helpers", () => {
  it("weeksWord", () => {
    expect(weeksWord(1)).toBe("nedelja");
    expect(weeksWord(3)).toBe("nedelje");
    expect(weeksWord(12)).toBe("nedelja");
  });
  it("monthsWord", () => {
    expect(monthsWord(1)).toBe("mesec");
    expect(monthsWord(2)).toBe("meseca");
    expect(monthsWord(5)).toBe("meseci");
  });
});
