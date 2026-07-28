import { describe, expect, it } from "vitest";

import {
  bearingDegrees,
  distanceToGoalM,
  formatDistanceShort,
} from "@/lib/run/geo";

describe("F-runs: bearingDegrees", () => {
  const origin = { lat: 44.8176, lng: 20.4633 };

  it("points north for a move due north", () => {
    expect(bearingDegrees(origin, { lat: 44.83, lng: 20.4633 })).toBeCloseTo(
      0,
      1
    );
  });

  it("points east (~90°) for a move due east", () => {
    expect(bearingDegrees(origin, { lat: 44.8176, lng: 20.48 })).toBeCloseTo(
      90,
      0
    );
  });

  it("points south (~180°) for a move due south", () => {
    expect(bearingDegrees(origin, { lat: 44.8, lng: 20.4633 })).toBeCloseTo(
      180,
      1
    );
  });

  it("points west (~270°) for a move due west", () => {
    expect(bearingDegrees(origin, { lat: 44.8176, lng: 20.44 })).toBeCloseTo(
      270,
      0
    );
  });

  it("is always normalised to [0, 360)", () => {
    const b = bearingDegrees(origin, { lat: 44.81, lng: 20.44 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it("defaults to north (0) for two identical points", () => {
    expect(bearingDegrees(origin, { ...origin })).toBe(0);
  });
});

describe("F-runs: distanceToGoalM", () => {
  it("is zero when already at the goal", () => {
    const p = { lat: 44.8176, lng: 20.4633 };
    expect(distanceToGoalM(p, { ...p })).toBe(0);
  });

  it("matches the ~111.2 km-per-degree sphere for one degree north", () => {
    expect(
      distanceToGoalM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    ).toBeCloseTo(111194.93, 0);
  });
});

describe("F-runs: formatDistanceShort", () => {
  it("shows whole metres under a kilometre", () => {
    expect(formatDistanceShort(0)).toBe("0 m");
    expect(formatDistanceShort(12.7)).toBe("13 m");
    expect(formatDistanceShort(850)).toBe("850 m");
    expect(formatDistanceShort(999)).toBe("999 m");
  });

  it("shows one decimal km from 1 to under 10 km", () => {
    expect(formatDistanceShort(1000)).toBe("1.0 km");
    expect(formatDistanceShort(1240)).toBe("1.2 km");
    expect(formatDistanceShort(9990)).toBe("10.0 km");
  });

  it("shows whole km at 10 km and beyond", () => {
    expect(formatDistanceShort(12300)).toBe("12 km");
    expect(formatDistanceShort(42195)).toBe("42 km");
  });

  it("clamps negative or NaN to 0 m", () => {
    expect(formatDistanceShort(-5)).toBe("0 m");
    expect(formatDistanceShort(Number.NaN)).toBe("0 m");
  });
});
