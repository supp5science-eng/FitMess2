import { describe, expect, it } from "vitest";

import {
  currentStreak,
  previousDayKey,
  streakMilestone,
} from "@/lib/awards/streak";

const TODAY = "2026-07-26";

describe("previousDayKey", () => {
  it("steps back one calendar day", () => {
    expect(previousDayKey("2026-07-26")).toBe("2026-07-25");
  });

  it("crosses month and year boundaries", () => {
    expect(previousDayKey("2026-08-01")).toBe("2026-07-31");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
  });

  it("handles a leap day", () => {
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
  });
});

describe("currentStreak", () => {
  it("is zero with no awards at all", () => {
    expect(currentStreak([], TODAY)).toEqual({ days: 0, earnedToday: false });
  });

  it("counts today plus the days behind it", () => {
    expect(
      currentStreak(["2026-07-26", "2026-07-25", "2026-07-24"], TODAY)
    ).toEqual({ days: 3, earnedToday: true });
  });

  // The mid-day rule: a day is only "missed" once it is over, so yesterday's
  // streak is still standing this morning.
  it("keeps yesterday's streak alive before today is earned", () => {
    expect(currentStreak(["2026-07-25", "2026-07-24"], TODAY)).toEqual({
      days: 2,
      earnedToday: false,
    });
  });

  it("breaks once a whole day was skipped", () => {
    expect(currentStreak(["2026-07-24", "2026-07-23"], TODAY)).toEqual({
      days: 0,
      earnedToday: false,
    });
  });

  it("counts only the CURRENT run, not the best one ever", () => {
    const days = [
      "2026-07-26",
      "2026-07-25",
      // gap on the 24th
      "2026-07-23",
      "2026-07-22",
      "2026-07-21",
      "2026-07-20",
    ];
    expect(currentStreak(days, TODAY).days).toBe(2);
  });

  it("does not care about order or duplicates", () => {
    const days = ["2026-07-25", "2026-07-26", "2026-07-25", "2026-07-24"];
    expect(currentStreak(days, TODAY).days).toBe(3);
  });

  it("ignores days in the future", () => {
    expect(currentStreak(["2026-07-27", "2026-07-28"], TODAY)).toEqual({
      days: 0,
      earnedToday: false,
    });
  });

  it("walks back across a month boundary", () => {
    expect(
      currentStreak(["2026-08-01", "2026-07-31", "2026-07-30"], "2026-08-01")
        .days
    ).toBe(3);
  });
});

describe("streakMilestone", () => {
  it("says nothing on an ordinary day", () => {
    expect(streakMilestone(1)).toBeNull();
    expect(streakMilestone(2)).toBeNull();
  });

  it("crowns each threshold with the biggest one reached", () => {
    expect(streakMilestone(3)).toBe("Tri dana zaredom.");
    expect(streakMilestone(7)).toBe("Nedelju dana zaredom!");
    expect(streakMilestone(14)).toBe("Dve nedelje bez preskakanja.");
    expect(streakMilestone(30)).toBe("Mesec dana zaredom.");
    expect(streakMilestone(365)).toBe(
      "100 dana. Ovo više nije navika, ovo si ti."
    );
  });
});
