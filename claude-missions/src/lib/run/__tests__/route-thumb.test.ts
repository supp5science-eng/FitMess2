import { describe, expect, it } from "vitest";

import { routeThumbPoints } from "@/lib/run/route-thumb";

const p = (lat: number, lng: number) => ({ lat, lng, t: 0 });

describe("F-runs: routeThumbPoints", () => {
  it("returns null for fewer than two usable points", () => {
    expect(routeThumbPoints([])).toBeNull();
    expect(routeThumbPoints([p(1, 1)])).toBeNull();
  });

  it("projects the bounding box into the padded viewBox (north = up)", () => {
    // Diagonal SW→NE over a 64×40 box, pad 4 → (4,36) to (60,4).
    expect(routeThumbPoints([p(0, 0), p(1, 1)])).toBe("4.0,36.0 60.0,4.0");
  });

  it("does not divide by zero for a straight vertical route", () => {
    // Same lng (zero span) must not produce NaN.
    const out = routeThumbPoints([p(0, 5), p(1, 5)]);
    expect(out).not.toBeNull();
    expect(out).not.toMatch(/NaN/);
  });
});
