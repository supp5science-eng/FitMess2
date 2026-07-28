import { describe, expect, it } from "vitest";

import {
  computeStreak,
  currentStreak,
  dayCountSr,
  dayNounSr,
  longestStreak,
  milestoneProgress,
  nextMilestone,
  recentDayKeys,
  shiftDayKey,
  streakMilestone,
} from "@/lib/streak/streak";

const TODAY = "2026-07-28"; // a Tuesday

/** Build a set of the `n` day keys ending at (and including) `end`. */
function runEndingAt(end: string, n: number): Set<string> {
  return new Set(recentDayKeys(end, n));
}

describe("shiftDayKey", () => {
  it("shifts within a month", () => {
    expect(shiftDayKey("2026-07-28", -1)).toBe("2026-07-27");
    expect(shiftDayKey("2026-07-28", 1)).toBe("2026-07-29");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDayKey("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap-day arithmetic", () => {
    expect(shiftDayKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDayKey("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("recentDayKeys", () => {
  it("returns oldest-first, inclusive of the end day", () => {
    expect(recentDayKeys(TODAY, 3)).toEqual([
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
    ]);
  });
});

describe("currentStreak", () => {
  it("is 0 for no logged days", () => {
    expect(currentStreak(new Set(), TODAY)).toBe(0);
  });

  it("counts today when today is logged", () => {
    const days = runEndingAt(TODAY, 4); // 25,26,27,28
    expect(currentStreak(days, TODAY)).toBe(4);
  });

  it("GRACE: an unlogged today does not break a run through yesterday", () => {
    // Logged Mon..yesterday, nothing today yet -- still counts yesterday's run.
    const days = new Set(["2026-07-25", "2026-07-26", "2026-07-27"]);
    expect(days.has(TODAY)).toBe(false);
    expect(currentStreak(days, TODAY)).toBe(3);
  });

  it("breaks to 0 when yesterday is missing and today is unlogged", () => {
    // Ran through the day before yesterday, then a gap. The day is over.
    const days = new Set(["2026-07-24", "2026-07-25", "2026-07-26"]);
    expect(currentStreak(days, TODAY)).toBe(0);
  });

  it("today logged after a gap yesterday is a fresh streak of 1", () => {
    const days = new Set(["2026-07-25", TODAY]); // gap on 26 & 27
    expect(currentStreak(days, TODAY)).toBe(1);
  });

  it("ignores days in the future of today", () => {
    const days = new Set(["2026-07-27", TODAY, "2026-07-29", "2026-07-30"]);
    expect(currentStreak(days, TODAY)).toBe(2);
  });

  it("is unaffected by duplicate / unordered input via computeStreak", () => {
    const summary = computeStreak(
      ["2026-07-27", TODAY, "2026-07-27", "2026-07-26"],
      TODAY
    );
    expect(summary.current).toBe(3);
  });
});

describe("longestStreak", () => {
  it("is 0 for an empty set", () => {
    expect(longestStreak(new Set())).toBe(0);
  });

  it("finds the longest run among gaps", () => {
    const days = new Set([
      // a run of 2
      "2026-06-01",
      "2026-06-02",
      // gap
      // a run of 4
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      // gap
      // a run of 1
      "2026-06-20",
    ]);
    expect(longestStreak(days)).toBe(4);
  });

  it("counts a run that crosses a month boundary", () => {
    const days = new Set([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(longestStreak(days)).toBe(4);
  });
});

describe("nextMilestone", () => {
  it("returns the first milestone strictly above current", () => {
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(3)).toBe(7);
    expect(nextMilestone(5)).toBe(7);
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(100)).toBe(180);
  });

  it("is null once every milestone is behind the user", () => {
    expect(nextMilestone(365)).toBeNull();
    expect(nextMilestone(400)).toBeNull();
  });
});

describe("milestoneProgress", () => {
  it("is 0 right after a milestone is hit", () => {
    expect(milestoneProgress(3)).toBe(0);
    expect(milestoneProgress(7)).toBe(0);
  });

  it("fills proportionally between milestones", () => {
    // 5 is halfway from 3 to 7.
    expect(milestoneProgress(5)).toBeCloseTo(0.5, 5);
    // 1 of the way from 0 to 3.
    expect(milestoneProgress(1)).toBeCloseTo(1 / 3, 5);
  });

  it("is a full ring past the last milestone", () => {
    expect(milestoneProgress(365)).toBe(1);
    expect(milestoneProgress(500)).toBe(1);
  });
});

describe("streakMilestone", () => {
  it("is null below the first milestone", () => {
    expect(streakMilestone(0)).toBeNull();
    expect(streakMilestone(2)).toBeNull();
  });

  it("crowns the earned tiers", () => {
    expect(streakMilestone(3)).toBe("Tri dana u nizu.");
    expect(streakMilestone(7)).toBe("Nedelju dana zaredom!");
    expect(streakMilestone(30)).toBe("Mesec dana zaredom!");
    expect(streakMilestone(365)).toBe("Godinu dana. Ovo si sada ti.");
  });
});

describe("Serbian day noun agreement", () => {
  it("uses the singular for numbers ending in 1 (except 11)", () => {
    expect(dayNounSr(1)).toBe("dan");
    expect(dayNounSr(21)).toBe("dan");
    expect(dayNounSr(11)).toBe("dana");
  });

  it("uses the plural elsewhere", () => {
    expect(dayNounSr(0)).toBe("dana");
    expect(dayNounSr(2)).toBe("dana");
    expect(dayNounSr(5)).toBe("dana");
  });

  it("formats a count with its noun", () => {
    expect(dayCountSr(1)).toBe("1 dan");
    expect(dayCountSr(5)).toBe("5 dana");
    expect(dayCountSr(21)).toBe("21 dan");
  });
});

describe("computeStreak", () => {
  it("derives the full summary for an active, mid-day streak", () => {
    // Logged 24..27, today (28) not logged yet -> grace keeps it at 4.
    const summary = computeStreak(
      ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"],
      TODAY
    );
    expect(summary.current).toBe(4);
    expect(summary.best).toBe(4);
    expect(summary.loggedToday).toBe(false);
    expect(summary.nextMilestone).toBe(7);
    expect(summary.daysToNext).toBe(3);
    expect(summary.milestone).toBe("Tri dana u nizu.");
  });

  it("returns a fresh empty summary for a user with no logs", () => {
    const summary = computeStreak([], TODAY);
    expect(summary.current).toBe(0);
    expect(summary.best).toBe(0);
    expect(summary.loggedToday).toBe(false);
    expect(summary.nextMilestone).toBe(3);
    expect(summary.daysToNext).toBe(3);
    expect(summary.milestone).toBeNull();
  });

  it("builds the dot row oldest-first with today flagged", () => {
    const summary = computeStreak(["2026-07-27", TODAY], TODAY, 3);
    expect(summary.recentDays).toEqual([
      { dayKey: "2026-07-26", logged: false, isToday: false },
      { dayKey: "2026-07-27", logged: true, isToday: false },
      { dayKey: "2026-07-28", logged: true, isToday: true },
    ]);
  });

  it("best can exceed the current run", () => {
    const summary = computeStreak(
      [
        // an old 5-day record
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
        // a current 2-day run
        "2026-07-27",
        TODAY,
      ],
      TODAY
    );
    expect(summary.current).toBe(2);
    expect(summary.best).toBe(5);
  });
});
