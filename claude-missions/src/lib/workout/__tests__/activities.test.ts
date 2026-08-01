import { describe, expect, it } from "vitest";

import { briskWalkKcalPerMin } from "@/lib/home/adaptive";
import {
  FALLBACK_WEIGHT_KG,
  MAX_WORKOUT_MINUTES,
  WORKOUT_ACTIVITIES,
  findActivity,
  netMets,
  totalWorkoutKcal,
  totalWorkoutMinutes,
  workoutKcal,
} from "@/lib/workout/activities";

describe("workout catalog", () => {
  it("has unique, stable keys", () => {
    const keys = WORKOUT_ACTIVITIES.map((activity) => activity.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prices every activity with three ordered intensities", () => {
    for (const activity of WORKOUT_ACTIVITIES) {
      expect(activity.mets.lako).toBeLessThan(activity.mets.srednje);
      expect(activity.mets.srednje).toBeLessThan(activity.mets.jako);
      // Nothing in a workout catalog may be lighter than sitting still.
      expect(activity.mets.lako).toBeGreaterThan(1);
    }
  });

  it("gives every activity a sane default duration", () => {
    for (const activity of WORKOUT_ACTIVITIES) {
      expect(activity.defaultMinutes).toBeGreaterThan(0);
      expect(activity.defaultMinutes).toBeLessThanOrEqual(MAX_WORKOUT_MINUTES);
    }
  });

  it("resolves known keys and refuses unknown ones", () => {
    expect(findActivity("teretana")?.emoji).toBe("🏋️");
    expect(findActivity("kajak-na-mesecu")).toBeNull();
  });
});

describe("netMets", () => {
  it("charges only what a session costs ABOVE resting", () => {
    const teretana = findActivity("teretana")!;
    // 5.0 gross - 1 MET at rest.
    expect(netMets(teretana, "srednje")).toBeCloseTo(4.0, 5);
  });

  it("never goes negative", () => {
    const joga = findActivity("joga")!;
    expect(netMets(joga, "lako")).toBeGreaterThanOrEqual(0);
  });
});

describe("workoutKcal", () => {
  it("prices an hour of moderate weights for an 85 kg body", () => {
    // net 4.0 MET x 3.5 x 85 / 200 = 5.95 kcal/min x 60 min
    expect(
      workoutKcal({
        activityKey: "teretana",
        intensity: "srednje",
        minutes: 60,
        weightKg: 85,
      })
    ).toBe(357);
  });

  it("scales with body mass -- a heavier body burns more for the same session", () => {
    const light = workoutKcal({
      activityKey: "trcanje",
      intensity: "srednje",
      minutes: 30,
      weightKg: 55,
    });
    const heavy = workoutKcal({
      activityKey: "trcanje",
      intensity: "srednje",
      minutes: 30,
      weightKg: 95,
    });
    expect(heavy).toBeGreaterThan(light);
    // Burn is linear in mass: 95/55 of the work.
    expect(heavy / light).toBeCloseTo(95 / 55, 1);
  });

  it("scales with intensity and with duration", () => {
    const base = {
      activityKey: "bicikl",
      intensity: "lako" as const,
      minutes: 30,
      weightKg: 80,
    };
    expect(
      workoutKcal({ ...base, intensity: "jako" })
    ).toBeGreaterThan(workoutKcal(base));
    // Doubling the minutes doubles the burn, give or take the whole-kcal
    // rounding each call does on its own.
    expect(
      Math.abs(workoutKcal({ ...base, minutes: 60 }) - workoutKcal(base) * 2)
    ).toBeLessThanOrEqual(1);
  });

  it("agrees with the adaptive plan's walking model -- one walk, one price", () => {
    // The plan's activity suggestion (`briskWalkKcalPerMin`) and this catalog's
    // moderate walk are the SAME 4.3 MET brisk walk. If these ever diverge the
    // app quotes two different numbers for one walk, which is the bug this
    // assertion exists to prevent.
    for (const kg of [55, 70, 92]) {
      const catalogPerMin =
        workoutKcal({
          activityKey: "hodanje",
          intensity: "srednje",
          minutes: 100,
          weightKg: kg,
        }) / 100;
      expect(catalogPerMin).toBeCloseTo(briskWalkKcalPerMin(kg), 1);
    }
  });

  it("falls back to a mid-range mass when the profile has no weight", () => {
    const withFallback = workoutKcal({
      activityKey: "plivanje",
      intensity: "srednje",
      minutes: 45,
      weightKg: null,
    });
    const explicit = workoutKcal({
      activityKey: "plivanje",
      intensity: "srednje",
      minutes: 45,
      weightKg: FALLBACK_WEIGHT_KG,
    });
    expect(withFallback).toBe(explicit);
    expect(withFallback).toBeGreaterThan(0);
  });

  it("yields 0 for an unknown activity instead of throwing", () => {
    expect(
      workoutKcal({
        activityKey: "nepostojece",
        intensity: "jako",
        minutes: 60,
        weightKg: 80,
      })
    ).toBe(0);
  });

  it("clamps absurd or negative durations", () => {
    const capped = workoutKcal({
      activityKey: "hodanje",
      intensity: "srednje",
      minutes: 99999,
      weightKg: 80,
    });
    const atCap = workoutKcal({
      activityKey: "hodanje",
      intensity: "srednje",
      minutes: MAX_WORKOUT_MINUTES,
      weightKg: 80,
    });
    expect(capped).toBe(atCap);
    expect(
      workoutKcal({
        activityKey: "hodanje",
        intensity: "srednje",
        minutes: -30,
        weightKg: 80,
      })
    ).toBe(0);
  });

  it("stays under a light day's food for a genuinely hard session", () => {
    // Sanity bound on the whole model: two hours of hard running at 95 kg is a
    // big number, but it must not read like a second dinner's worth of licence.
    const brutal = workoutKcal({
      activityKey: "trcanje",
      intensity: "jako",
      minutes: 120,
      weightKg: 95,
    });
    expect(brutal).toBeGreaterThan(1500);
    expect(brutal).toBeLessThan(2600);
  });
});

describe("day totals", () => {
  it("sums kcal and minutes across a day's sessions", () => {
    const day = [
      { kcal: 357, minutes: 60 },
      { kcal: 120, minutes: 25 },
    ];
    expect(totalWorkoutKcal(day)).toBe(477);
    expect(totalWorkoutMinutes(day)).toBe(85);
  });

  it("ignores negative values from a corrupt row", () => {
    expect(totalWorkoutKcal([{ kcal: -50 }, { kcal: 100 }])).toBe(100);
    expect(totalWorkoutMinutes([{ minutes: -10 }, { minutes: 30 }])).toBe(30);
  });

  it("reads an empty day as zero", () => {
    expect(totalWorkoutKcal([])).toBe(0);
    expect(totalWorkoutMinutes([])).toBe(0);
  });
});
