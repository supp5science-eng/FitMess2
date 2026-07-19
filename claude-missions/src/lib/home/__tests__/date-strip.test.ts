import { describe, expect, it } from "vitest";

import { buildDateStrip } from "@/lib/home/date-strip";

// Fixed "now": 2026-07-19 (a Sunday -- the very day in the reference design).
const NOW = new Date("2026-07-19T12:00:00.000Z");

describe("buildDateStrip", () => {
  it("builds an inclusive [startKey, endKey] range of day keys", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
      startKey: "2026-07-17",
      endKey: "2026-07-22",
    });
    expect(days.map((d) => d.key)).toEqual([
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
    ]);
  });

  it("spans month boundaries and 30 future days without gaps", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
      startKey: "2026-07-19",
      endKey: "2026-08-18", // today + 30
    });
    expect(days).toHaveLength(31);
    expect(days[0]!.key).toBe("2026-07-19");
    expect(days.at(-1)!.key).toBe("2026-08-18");
    // consecutive, no missing days across the July -> August boundary
    expect(days.some((d) => d.key === "2026-07-31")).toBe(true);
    expect(days.some((d) => d.key === "2026-08-01")).toBe(true);
  });

  it("labels days with Serbian short weekdays (Mon=Pon..Sun=Ned)", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
      startKey: "2026-07-14",
      endKey: "2026-07-20",
    });
    expect(days.map((d) => d.dayLabel)).toEqual([
      "Uto", // 14 Tue
      "Sre", // 15 Wed
      "Čet", // 16 Thu
      "Pet", // 17 Fri
      "Sub", // 18 Sat
      "Ned", // 19 Sun (today)
      "Pon", // 20 Mon (future)
    ]);
  });

  it("marks today and future days", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
      startKey: "2026-07-18",
      endKey: "2026-07-21",
    });
    expect(days.find((d) => d.key === "2026-07-19")!.isToday).toBe(true);
    expect(days.find((d) => d.key === "2026-07-18")!.isFuture).toBe(false);
    expect(days.find((d) => d.key === "2026-07-20")!.isFuture).toBe(true);
    expect(days.find((d) => d.key === "2026-07-21")!.isFuture).toBe(true);
  });

  it("flags days with a logged meal (and never a future day)", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(["2026-07-17", "2026-07-18", "2026-07-20"]),
      startKey: "2026-07-16",
      endKey: "2026-07-21",
    });
    expect(days.find((d) => d.key === "2026-07-17")!.isLogged).toBe(true);
    expect(days.find((d) => d.key === "2026-07-18")!.isLogged).toBe(true);
    expect(days.find((d) => d.key === "2026-07-16")!.isLogged).toBe(false);
    // 20th is in the future -> never "logged" even if the set says so.
    expect(days.find((d) => d.key === "2026-07-20")!.isLogged).toBe(false);
  });

  it("selects the viewed day, but never a future day", () => {
    const viewingPast = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-17",
      loggedDays: new Set(),
      startKey: "2026-07-14",
      endKey: "2026-07-20",
    });
    expect(viewingPast.filter((d) => d.isSelected).map((d) => d.key)).toEqual([
      "2026-07-17",
    ]);

    const viewingFuture = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-20",
      loggedDays: new Set(),
      startKey: "2026-07-14",
      endKey: "2026-07-25",
    });
    expect(viewingFuture.some((d) => d.isSelected)).toBe(false);
  });

  it("marks pre-sign-up days as imaginary filler: disabled, never logged/selected", () => {
    // Signed up on the 17th, but the strip starts 5 before today (the 14th) so
    // today can center -> the 14th..16th are imaginary filler.
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-15",
      loggedDays: new Set(["2026-07-15"]),
      startKey: "2026-07-14",
      endKey: "2026-07-20",
      minKey: "2026-07-17",
    });
    const filler = days.find((d) => d.key === "2026-07-15")!;
    expect(filler.isBeforeStart).toBe(true);
    expect(filler.isLogged).toBe(false); // never logged, even if the set says so
    expect(filler.isSelected).toBe(false); // disabled cell is never selected
    expect(days.find((d) => d.key === "2026-07-14")!.isBeforeStart).toBe(true);
    expect(days.find((d) => d.key === "2026-07-17")!.isBeforeStart).toBe(false);
    expect(days.find((d) => d.key === "2026-07-18")!.isBeforeStart).toBe(false);
  });
});
