import { describe, expect, it } from "vitest";

import {
  bucketDayIntake,
  classifyDay,
  parseDayAnswers,
  plausibilityFloor,
  serializeDayAnswers,
  withDayAnswer,
} from "@/lib/home/day-trust";

function intake(kcal: number, logCount: number, dayKey = "2026-01-06") {
  return { dayKey, kcal, logCount };
}

describe("plausibilityFloor", () => {
  it("uses BMR when the profile can produce one", () => {
    expect(plausibilityFloor(1873, "male")).toBe(1873);
  });

  it("falls back to the sex floor when BMR is unknown", () => {
    expect(plausibilityFloor(null, "male")).toBe(1400);
    expect(plausibilityFloor(undefined, "female")).toBe(1200);
  });

  it("ignores a nonsense BMR rather than trusting it", () => {
    expect(plausibilityFloor(0, "female")).toBe(1200);
    expect(plausibilityFloor(Number.NaN, "male")).toBe(1400);
  });
});

describe("bucketDayIntake", () => {
  it("sums kcal and counts entries per Belgrade day", () => {
    const days = bucketDayIntake([
      { logged_at: "2026-01-06T07:00:00.000Z", kcal: 300 },
      { logged_at: "2026-01-06T18:00:00.000Z", kcal: 700 },
      { logged_at: "2026-01-07T09:00:00.000Z", kcal: 450 },
    ]);
    expect(days.get("2026-01-06")).toEqual({
      dayKey: "2026-01-06",
      kcal: 1000,
      logCount: 2,
    });
    expect(days.get("2026-01-07")?.logCount).toBe(1);
  });

  it("returns an empty map for no logs", () => {
    expect(bucketDayIntake([]).size).toBe(0);
  });
});

describe("classifyDay", () => {
  it("trusts a day at or above the plausibility floor", () => {
    expect(classifyDay(intake(2100, 4), 1900)).toMatchObject({
      trust: "trusted",
      counts: true,
      needsAnswer: false,
    });
  });

  it("flags a day whose log is below what a body burns at rest", () => {
    expect(classifyDay(intake(122, 1), 1900)).toMatchObject({
      trust: "incomplete",
      counts: false,
      needsAnswer: true,
    });
  });

  it("never questions a day with no logs -- the answer is already obvious", () => {
    expect(classifyDay(intake(0, 0), 1900)).toMatchObject({
      trust: "empty",
      counts: false,
      needsAnswer: false,
    });
  });

  it("takes the user at their word when they confirm a light day", () => {
    expect(classifyDay(intake(122, 1), 1900, "complete")).toMatchObject({
      trust: "trusted",
      counts: true,
      needsAnswer: false,
    });
  });

  it("keeps a self-declared partial day out of the math, and stops asking", () => {
    expect(classifyDay(intake(122, 1), 1900, "partial")).toMatchObject({
      trust: "incomplete",
      counts: false,
      needsAnswer: false,
    });
  });

  it("treats exactly-at-the-floor as plausible (the cutoff is strict-below)", () => {
    expect(classifyDay(intake(1900, 3), 1900).counts).toBe(true);
  });
});

describe("the answer cookie", () => {
  it("round-trips answers", () => {
    const answers = parseDayAnswers("2026-01-05~c,2026-01-06~p");
    expect(answers.get("2026-01-05")).toBe("complete");
    expect(answers.get("2026-01-06")).toBe("partial");
    expect(serializeDayAnswers(answers)).toBe("2026-01-05~c,2026-01-06~p");
  });

  it("drops malformed entries instead of throwing", () => {
    const answers = parseDayAnswers("garbage,2026-01-06~z,~c,2026-01-07~p,");
    expect([...answers.entries()]).toEqual([["2026-01-07", "partial"]]);
  });

  it("treats a missing cookie as no answers", () => {
    expect(parseDayAnswers(null).size).toBe(0);
    expect(parseDayAnswers("").size).toBe(0);
  });

  it("adds an answer and prunes entries older than the lookback", () => {
    const next = withDayAnswer(
      "2025-12-01~c,2026-01-05~p",
      "2026-01-06",
      "complete",
      "2026-01-07"
    );
    // 2025-12-01 is well past the 21-day window; the other two survive.
    expect(next).toBe("2026-01-05~p,2026-01-06~c");
  });

  it("overwrites an earlier answer for the same day", () => {
    const next = withDayAnswer("2026-01-06~p", "2026-01-06", "complete", "2026-01-07");
    expect(next).toBe("2026-01-06~c");
  });
});
