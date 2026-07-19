import { describe, expect, it } from "vitest";

import {
  belgradeWeekDayKeys,
  belgradeWeekStartDay,
  belgradeWeekdayIndex,
  getBelgradeWeekRange,
} from "@/lib/dates";

// F040/F041: Monday-anchored Belgrade week helpers. Fixed UTC instants +
// UTC-based expectations, timezone-frame-independent (same discipline as
// dates.test.ts). 2026-07-13 is a Monday; the week 13..19 is used as anchor.

describe("belgradeWeekdayIndex -- Monday = 0 ... Sunday = 6", () => {
  it("Monday 2026-07-13 is 0", () => {
    expect(belgradeWeekdayIndex(new Date("2026-07-13T10:00:00.000Z"))).toBe(0);
  });
  it("Wednesday 2026-07-15 is 2", () => {
    expect(belgradeWeekdayIndex(new Date("2026-07-15T10:00:00.000Z"))).toBe(2);
  });
  it("Sunday 2026-07-19 is 6", () => {
    expect(belgradeWeekdayIndex(new Date("2026-07-19T10:00:00.000Z"))).toBe(6);
  });
  it("a late-evening UTC instant that rolls into the next Belgrade day counts as that next day's weekday", () => {
    // Summer UTC+2: 2026-07-19T22:30Z = 2026-07-20 00:30 local (Monday) -> 0.
    expect(belgradeWeekdayIndex(new Date("2026-07-19T22:30:00.000Z"))).toBe(0);
  });
});

describe("belgradeWeekStartDay -- Monday of the week", () => {
  it("mid-week resolves back to Monday", () => {
    expect(belgradeWeekStartDay(new Date("2026-07-15T10:00:00.000Z"))).toBe(
      "2026-07-13"
    );
  });
  it("Sunday still belongs to the same Monday-started week", () => {
    expect(belgradeWeekStartDay(new Date("2026-07-19T10:00:00.000Z"))).toBe(
      "2026-07-13"
    );
  });
  it("Monday resolves to itself", () => {
    expect(belgradeWeekStartDay(new Date("2026-07-13T00:30:00.000Z"))).toBe(
      "2026-07-13"
    );
  });
  it("crosses a month boundary when Monday is in the previous month", () => {
    // 2026-08-01 is a Saturday; its week's Monday is 2026-07-27.
    expect(belgradeWeekStartDay(new Date("2026-08-01T10:00:00.000Z"))).toBe(
      "2026-07-27"
    );
  });
});

describe("belgradeWeekDayKeys -- 7 keys Mon..Sun", () => {
  it("returns the full Mon..Sun run", () => {
    expect(belgradeWeekDayKeys(new Date("2026-07-15T10:00:00.000Z"))).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
    ]);
  });
});

describe("getBelgradeWeekRange -- Monday 00:00 .. next Monday 00:00 (exclusive)", () => {
  it("spans the summer (CEST, UTC+2) week", () => {
    const range = getBelgradeWeekRange(new Date("2026-07-15T10:00:00.000Z"));
    // Monday 2026-07-13 00:00 local = 2026-07-12T22:00Z; next Monday 2026-07-20.
    expect(range.startIso).toBe("2026-07-12T22:00:00.000Z");
    expect(range.endIsoExclusive).toBe("2026-07-19T22:00:00.000Z");
  });
});
