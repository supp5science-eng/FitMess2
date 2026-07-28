import { describe, expect, it } from "vitest";

import {
  computeDistanceM,
  haversineMeters,
  MIN_SEGMENT_METERS,
  sumActiveSeconds,
  sumDistanceM,
  toRunSegments,
} from "@/lib/run/distance";
import type { RunRoutePoint } from "@/lib/types/db";

/** Metres per degree of latitude on the 6 371 km sphere the lib uses. */
const M_PER_DEG = 111194.93;
const pt = (lat: number, lng: number, t: number): RunRoutePoint => ({
  lat,
  lng,
  t,
});
/** A point `meters` north of the equator origin, `t` ms into the run. */
const north = (meters: number, t: number): RunRoutePoint =>
  pt(meters / M_PER_DEG, 0, t);

describe("F-runs: haversineMeters", () => {
  it("returns ~111.2 km for one degree of latitude", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      M_PER_DEG,
      0
    );
  });

  it("is zero for identical points", () => {
    expect(haversineMeters({ lat: 44.8, lng: 20.5 }, { lat: 44.8, lng: 20.5 })).toBe(
      0
    );
  });

  it("is symmetric", () => {
    const a = { lat: 44.8, lng: 20.4 };
    const b = { lat: 44.81, lng: 20.42 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe("F-runs: toRunSegments noise filtering", () => {
  it("keeps a normal running step (~5 m/s)", () => {
    const segs = toRunSegments([north(0, 0), north(5, 1000)]);
    expect(segs).toHaveLength(1);
    expect(segs[0].distanceM).toBeCloseTo(5, 1);
  });

  it("drops sub-1.5 m stationary jitter", () => {
    expect(MIN_SEGMENT_METERS).toBe(1.5);
    // ~1.1 m apart — GPS drift while standing still.
    const segs = toRunSegments([north(0, 0), north(1.1, 1000)]);
    expect(segs).toHaveLength(0);
  });

  it("drops a lost-fix teleport (implausible speed)", () => {
    // ~1.1 km covered in one second → not human.
    const segs = toRunSegments([north(0, 0), north(1100, 1000)]);
    expect(segs).toHaveLength(0);
  });

  it("drops a pause/resume gap (> 20 s between fixes)", () => {
    const segs = toRunSegments([north(0, 0), north(5, 30_000)]);
    expect(segs).toHaveLength(0);
  });

  it("drops out-of-order / duplicate timestamps", () => {
    expect(toRunSegments([north(0, 1000), north(5, 1000)])).toHaveLength(0);
    expect(toRunSegments([north(0, 2000), north(5, 1000)])).toHaveLength(0);
  });

  it("does not count a paused gap toward distance or active time", () => {
    // move, pause 30 s, move again — the middle (pause) leg is excluded.
    const points = [
      north(0, 0),
      north(5, 1000),
      north(10, 31_000), // 30 s pause gap → dropped
      north(15, 32_000),
    ];
    const segs = toRunSegments(points);
    expect(segs).toHaveLength(2);
    expect(sumDistanceM(segs)).toBeCloseTo(10, 0);
    expect(sumActiveSeconds(segs)).toBe(2); // two 1 s moving legs, pause excluded
  });
});

describe("F-runs: computeDistanceM", () => {
  it("sums a straight run and ignores an empty/one-point trace", () => {
    expect(computeDistanceM([])).toBe(0);
    expect(computeDistanceM([north(0, 0)])).toBe(0);
    expect(
      computeDistanceM([north(0, 0), north(5, 1000), north(10, 2000)])
    ).toBeCloseTo(10, 0);
  });
});
