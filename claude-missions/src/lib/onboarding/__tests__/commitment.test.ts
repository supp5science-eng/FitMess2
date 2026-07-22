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
  it("weight-loss goal: kg delta + target date, first-person male copy", () => {
    const c = buildCommitment(
      {
        goal: "lose",
        sex: "male",
        weightKg: 80,
        targetWeightKg: 74,
        timeframeWeeks: 8,
      },
      NOW
    );
    expect(c.intro).toBe("Obećavam sebi da ću");
    expect(c.emphasis).toMatch(/^smršati 6 kg do \d+\. \p{L}+$/u);
    expect(c.pledge).toContain("iskren");
    expect(c.pledge).not.toContain("iskrena");
  });

  it("weight-gain goal: 'nabaciti' + female pledge form", () => {
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
    expect(c.emphasis).toMatch(/^nabaciti 5 kg do /);
    expect(c.pledge).toContain("iskrena");
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
    expect(c.emphasis).toBe("ostati veran svojim navikama i formi");
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
    expect(c.emphasis).toBe("izvajati i zategnuti svoje telo");
  });
});
