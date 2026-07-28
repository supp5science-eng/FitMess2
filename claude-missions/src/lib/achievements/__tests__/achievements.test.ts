import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_CATEGORIES,
  TOTAL_ACHIEVEMENTS,
  achievementsSummary,
  evaluateAchievements,
  groupByCategory,
  isGoalHit,
  type UserStats,
} from "@/lib/achievements/achievements";

const ZERO: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  fullDays: 0,
  totalMeals: 0,
  goalDays: 0,
  waterDays: 0,
  stepDays: 0,
};

describe("isGoalHit", () => {
  it("counts a day that landed on target (85%-110%)", () => {
    expect(isGoalHit(2000, 2000)).toBe(true); // exactly on
    expect(isGoalHit(1700, 2000)).toBe(true); // 85% floor
    expect(isGoalHit(2200, 2000)).toBe(true); // 110% ceiling
  });

  it("rejects under-logging and big overshoots", () => {
    expect(isGoalHit(1200, 2000)).toBe(false); // 60% -- only snacked
    expect(isGoalHit(2600, 2000)).toBe(false); // 130% -- well over
  });

  it("is false without a real target or any intake", () => {
    expect(isGoalHit(2000, 0)).toBe(false);
    expect(isGoalHit(0, 2000)).toBe(false);
  });
});

describe("evaluateAchievements", () => {
  it("earns nothing for a brand-new user, with 0 progress", () => {
    const list = evaluateAchievements(ZERO);
    expect(list).toHaveLength(TOTAL_ACHIEVEMENTS);
    expect(list.every((a) => !a.earned)).toBe(true);
    expect(list.every((a) => a.progress === 0)).toBe(true);
  });

  it("earns a badge exactly at its threshold", () => {
    const list = evaluateAchievements({ ...ZERO, totalMeals: 50 });
    const badge = list.find((a) => a.id === "obrok-50")!;
    expect(badge.earned).toBe(true);
    expect(badge.value).toBe(50);
    expect(badge.progress).toBe(1);
    // The next tier up is not yet earned, and its meter is partway.
    const next = list.find((a) => a.id === "obrok-250")!;
    expect(next.earned).toBe(false);
    expect(next.progress).toBeCloseTo(50 / 250, 5);
  });

  it("streak badges track the BEST streak, not the current one", () => {
    const list = evaluateAchievements({
      ...ZERO,
      currentStreak: 2,
      bestStreak: 30,
    });
    expect(list.find((a) => a.id === "niz-30")!.earned).toBe(true);
    expect(list.find((a) => a.id === "niz-100")!.earned).toBe(false);
  });

  it("caps progress at 1 when the value exceeds the threshold", () => {
    const list = evaluateAchievements({ ...ZERO, totalMeals: 900 });
    const badge = list.find((a) => a.id === "obrok-500")!;
    expect(badge.earned).toBe(true);
    expect(badge.progress).toBe(1);
  });
});

describe("groupByCategory", () => {
  it("groups in the canonical order with per-category counts", () => {
    const list = evaluateAchievements({
      ...ZERO,
      bestStreak: 7, // earns niz-3 and niz-7 (2 of 5)
    });
    const groups = groupByCategory(list);
    expect(groups.map((g) => g.category)).toEqual([...ACHIEVEMENT_CATEGORIES]);

    const niz = groups.find((g) => g.category === "niz")!;
    expect(niz.total).toBe(5);
    expect(niz.earned).toBe(2);
    expect(niz.label).toBe("Niz");

    // Every badge is accounted for exactly once across the groups.
    expect(groups.reduce((n, g) => n + g.total, 0)).toBe(TOTAL_ACHIEVEMENTS);
  });
});

describe("achievementsSummary", () => {
  it("counts earned out of the whole catalog", () => {
    const summary = achievementsSummary(
      evaluateAchievements({
        ...ZERO,
        totalMeals: 10, // obrok-1, obrok-10
        waterDays: 1, // voda-1
      })
    );
    expect(summary.total).toBe(TOTAL_ACHIEVEMENTS);
    expect(summary.earned).toBe(3);
  });
});
