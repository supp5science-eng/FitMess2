import { describe, expect, it } from "vitest";

import { getTodayRange } from "@/lib/home/today-range";

describe("F027: getTodayRange -- the swappable 'today' boundary helper", () => {
  it("returns midnight-to-midnight (24h) local-day boundaries for a given instant", () => {
    const now = new Date(2026, 6, 17, 14, 30, 0); // 17 Jul 2026, 14:30 local
    const { startIso, endIsoExclusive } = getTodayRange(now);

    const start = new Date(startIso);
    const end = new Date(endIsoExclusive);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(17);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("defaults to the current instant when called with no argument", () => {
    const { startIso, endIsoExclusive } = getTodayRange();
    expect(new Date(startIso).getTime()).toBeLessThan(
      new Date(endIsoExclusive).getTime()
    );
  });

  it("a moment just before midnight and a moment just after midnight resolve to different day ranges", () => {
    const lateNight = new Date(2026, 6, 17, 23, 59, 59);
    const earlyMorning = new Date(2026, 6, 18, 0, 0, 1);

    const rangeA = getTodayRange(lateNight);
    const rangeB = getTodayRange(earlyMorning);

    expect(rangeA.startIso).not.toBe(rangeB.startIso);
  });
});
