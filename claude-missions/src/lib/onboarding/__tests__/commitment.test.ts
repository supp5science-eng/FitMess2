import { describe, expect, it } from "vitest";

import { buildCommitment, formatSerbianDate } from "../commitment";

const NOW = new Date("2026-08-14T09:00:00Z");

describe("formatSerbianDate", () => {
  it("formats day + genitive month", () => {
    expect(formatSerbianDate(new Date("2026-10-14T00:00:00"))).toBe(
      "14. oktobra"
    );
  });
});

describe("buildCommitment", () => {
  it("weight-loss goal: kg delta + target date, genders the copy (male)", () => {
    const c = buildCommitment(
      {
        goal: "lose",
        sex: "male",
        weightKg: 80,
        targetWeightKg: 74,
        timeframeWeeks: 8, // ~ +56 days from Aug 14 -> Oct 9
      },
      NOW
    );
    expect(c.intro).toBe("Posvećen sam svom cilju da");
    expect(c.emphasis).toMatch(/^smršam 6 kg do \d+\. \p{L}+$/u);
    expect(c.pledge).toContain("odgovornim");
  });

  it("weight-gain goal: uses 'nabacim' and the female forms", () => {
    const c = buildCommitment(
      {
        goal: "gain",
        sex: "female",
        weightKg: 60,
        targetWeightKg: 65,
        timeframeWeeks: 10,
      },
      NOW
    );
    expect(c.intro).toBe("Posvećena sam svom cilju da");
    expect(c.emphasis).toMatch(/^nabacim 5 kg do /);
    expect(c.pledge).toContain("odgovornom");
  });

  it("maintain goal: number-free, goal-specific emphasis", () => {
    const c = buildCommitment(
      {
        goal: "maintain",
        sex: "male",
        weightKg: 75,
        targetWeightKg: null,
        timeframeWeeks: null,
      },
      NOW
    );
    expect(c.emphasis).toBe("zadržim svoju težinu i navike");
    expect(c.emphasis).not.toMatch(/kg/);
  });

  it("tone goal: number-free line", () => {
    const c = buildCommitment(
      {
        goal: "tone",
        sex: "female",
        weightKg: 70,
        targetWeightKg: null,
        timeframeWeeks: null,
      },
      NOW
    );
    expect(c.emphasis).toBe("se izvajam i zategnem");
  });
});
