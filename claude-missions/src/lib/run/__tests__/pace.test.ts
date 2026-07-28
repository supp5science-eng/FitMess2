import { describe, expect, it } from "vitest";

import { type RunSegment } from "@/lib/run/distance";
import {
  computeSplitsFromSegments,
  formatDuration,
  formatPace,
  paceSecPerKm,
} from "@/lib/run/pace";

const seg = (distanceM: number, tStartMs: number, tEndMs: number): RunSegment => ({
  distanceM,
  tStartMs,
  tEndMs,
});

describe("F-runs: paceSecPerKm", () => {
  it("divides duration by distance in km", () => {
    expect(paceSecPerKm(1000, 300)).toBe(300);
    expect(paceSecPerKm(2000, 600)).toBe(300);
    expect(paceSecPerKm(5000, 1500)).toBe(300);
  });

  it("returns null when there is nothing to divide", () => {
    expect(paceSecPerKm(0, 300)).toBeNull();
    expect(paceSecPerKm(1000, 0)).toBeNull();
  });
});

describe("F-runs: formatDuration", () => {
  it("formats M:SS and H:MM:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("clamps negative / NaN to 0:00", () => {
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
  });
});

describe("F-runs: formatPace", () => {
  it("formats sec/km as M:SS", () => {
    expect(formatPace(337)).toBe("5:37");
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(65)).toBe("1:05");
  });

  it("renders an em dash for no pace", () => {
    expect(formatPace(null)).toBe("—");
    expect(formatPace(0)).toBe("—");
    expect(formatPace(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("F-runs: computeSplitsFromSegments", () => {
  it("is empty for no segments", () => {
    expect(computeSplitsFromSegments([])).toEqual([]);
  });

  it("breaks a 2.5 km run into two full km + a partial", () => {
    const splits = computeSplitsFromSegments([
      seg(1000, 0, 300_000),
      seg(1000, 300_000, 640_000),
      seg(500, 640_000, 800_000),
    ]);

    expect(splits).toEqual([
      { km: 1, distanceM: 1000, seconds: 300, paceSecPerKm: 300, partial: false },
      { km: 2, distanceM: 1000, seconds: 340, paceSecPerKm: 340, partial: false },
      { km: 3, distanceM: 500, seconds: 160, paceSecPerKm: 320, partial: true },
    ]);
  });

  it("interpolates a km boundary that falls inside a segment", () => {
    // one 1.5 km leg over 300 s → km1 boundary at 2/3 of the leg (200 s).
    const splits = computeSplitsFromSegments([seg(1500, 0, 300_000)]);

    expect(splits).toEqual([
      { km: 1, distanceM: 1000, seconds: 200, paceSecPerKm: 200, partial: false },
      { km: 2, distanceM: 500, seconds: 100, paceSecPerKm: 200, partial: true },
    ]);
  });

  it("has no partial split for an exact-kilometre run", () => {
    const splits = computeSplitsFromSegments([seg(2000, 0, 600_000)]);
    expect(splits).toHaveLength(2);
    expect(splits.every((s) => !s.partial)).toBe(true);
  });
});
