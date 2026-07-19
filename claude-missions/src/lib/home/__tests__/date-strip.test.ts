import { describe, expect, it } from "vitest";

import { buildDateStrip } from "@/lib/home/date-strip";

// Fixed "now": 2026-07-19 (a Sunday -- the very day in the reference design).
const NOW = new Date("2026-07-19T12:00:00.000Z");

describe("buildDateStrip", () => {
  it("builds a 7-day window: 5 days before today through 1 day after", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
    });
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.key)).toEqual([
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
      "2026-07-20",
    ]);
  });

  it("labels days with Serbian short weekdays (Mon=Pon..Sun=Ned)", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
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
    expect(days.map((d) => d.dayNum)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it("marks today and the future day", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(),
    });
    const today = days.find((d) => d.key === "2026-07-19")!;
    const tomorrow = days.find((d) => d.key === "2026-07-20")!;
    expect(today.isToday).toBe(true);
    expect(today.isFuture).toBe(false);
    expect(tomorrow.isFuture).toBe(true);
    expect(tomorrow.isToday).toBe(false);
  });

  it("flags days with a logged meal (and never the future day)", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-19",
      loggedDays: new Set(["2026-07-17", "2026-07-18", "2026-07-20"]),
    });
    expect(days.find((d) => d.key === "2026-07-17")!.isLogged).toBe(true);
    expect(days.find((d) => d.key === "2026-07-18")!.isLogged).toBe(true);
    expect(days.find((d) => d.key === "2026-07-16")!.isLogged).toBe(false);
    // 20th is in the future -> never "logged" even if the set says so.
    expect(days.find((d) => d.key === "2026-07-20")!.isLogged).toBe(false);
  });

  it("selects the viewed day", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-17",
      loggedDays: new Set(),
    });
    expect(days.filter((d) => d.isSelected).map((d) => d.key)).toEqual([
      "2026-07-17",
    ]);
  });

  it("disables days before the sign-up day and never logs/selects them", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-15",
      loggedDays: new Set(["2026-07-15"]),
      minKey: "2026-07-16",
    });
    const before = days.find((d) => d.key === "2026-07-15")!;
    const onStart = days.find((d) => d.key === "2026-07-16")!;
    expect(before.isBeforeStart).toBe(true);
    expect(before.isLogged).toBe(false);
    expect(before.isSelected).toBe(false); // disabled cell is never selected
    expect(onStart.isBeforeStart).toBe(false);
    expect(days.find((d) => d.key === "2026-07-14")!.isBeforeStart).toBe(true);
  });

  it("never selects a future day", () => {
    const days = buildDateStrip({
      now: NOW,
      selectedKey: "2026-07-20",
      loggedDays: new Set(),
    });
    expect(days.some((d) => d.isSelected)).toBe(false);
  });
});
