import { describe, expect, it } from "vitest";

import { KCAL_FLOOR, MAX_DEFICIT_PCT } from "@/lib/budget/engine";

import {
  computeWeeklyTrend,
  daysBetween,
  GOOD_CONFIDENCE_WEIGH_INS,
  MAX_CORRECTION_KCAL,
  MAX_TDEE_DEVIATION_PCT,
  measurementIsPlausible,
  MIN_CORRECTION_KCAL,
  MIN_PLAUSIBLE_TDEE_KCAL,
  MIN_SPAN_DAYS,
  type TrustedDayIntake,
  type WeighInPoint,
  type WeeklyTrendInput,
} from "../weekly-trend";

// Nedeljno merenje: the scale, read against the food log, is the only thing in
// this app that MEASURES expenditure instead of predicting it. These tests
// exist mostly to pin down the four laws in the module header -- never react to
// one weigh-in, never apply anything automatically, never blame the plan for a
// log we don't believe, and never breach the budget engine's safety caps.

/** A run of days all logged at the same believable kcal. */
function days(
  fromDay: string,
  count: number,
  kcal: number,
  counts = true
): TrustedDayIntake[] {
  const out: TrustedDayIntake[] = [];
  const [year, month, date] = fromDay.split("-").map(Number);
  for (let i = 0; i < count; i += 1) {
    const key = new Date(Date.UTC(year!, month! - 1, date! + i))
      .toISOString()
      .slice(0, 10);
    out.push({ dayKey: key, kcal, counts });
  }
  return out;
}

function weighIns(
  startDay: string,
  weights: readonly number[],
  everyDays = 7
): WeighInPoint[] {
  const [year, month, date] = startDay.split("-").map(Number);
  return weights.map((weightKg, i) => ({
    day: new Date(Date.UTC(year!, month! - 1, date! + i * everyDays))
      .toISOString()
      .slice(0, 10),
    weightKg,
  }));
}

function input(overrides: Partial<WeeklyTrendInput> = {}): WeeklyTrendInput {
  return {
    weighIns: weighIns("2026-07-06", [90, 89.5, 89]),
    days: days("2026-07-06", 14, 2400),
    goal: "lose",
    sex: "male",
    currentDailyKcal: 2400,
    plannedTdeeKcal: 2900,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("test_counts_whole_days_across_a_month_boundary", () => {
    expect(daysBetween("2026-07-29", "2026-08-05")).toBe(7);
    expect(daysBetween("2026-08-05", "2026-07-29")).toBe(-7);
    expect(daysBetween("2026-08-05", "2026-08-05")).toBe(0);
  });
});

// ---------------------------------------------------------------------
// Law 1: never react to a single measurement
// ---------------------------------------------------------------------

describe("INSUFFICIENT_DATA", () => {
  it("test_one_weigh_in_never_produces_a_verdict_or_a_suggestion", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-20", [90]) })
    );

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("few_weigh_ins");
    expect(result.suggestion).toBeNull();
    expect(result.trendKgPerWeek).toBeNull();
    // The one number we DO know is still handed back, so the card can show it.
    expect(result.currentWeightKg).toBe(90);
  });

  it("test_no_weigh_ins_at_all_is_the_same_answer_not_a_crash", () => {
    const result = computeWeeklyTrend(input({ weighIns: [], days: [] }));

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("few_weigh_ins");
    expect(result.currentWeightKg).toBeNull();
  });

  it("test_two_weigh_ins_too_close_together_are_not_a_weekly_trend", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-20", [90, 89], 3),
        days: days("2026-07-20", 3, 2400),
      })
    );

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("span_too_short");
    expect(result.spanDays).toBeLessThan(MIN_SPAN_DAYS);
    expect(result.suggestion).toBeNull();
  });

  it("test_two_weigh_ins_are_enough_to_act_on_but_only_at_low_confidence", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-13", [90, 89.5]),
        days: days("2026-07-13", 7, 2400),
      })
    );

    expect(result.status).not.toBe("INSUFFICIENT_DATA");
    expect(result.confidence).toBe("low");
  });

  it("test_three_weigh_ins_earn_good_confidence", () => {
    expect(computeWeeklyTrend(input()).confidence).toBe("good");
  });

  it("test_a_duplicate_day_cannot_appear_twice_in_the_fit", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: [
          { day: "2026-07-06", weightKg: 90 },
          { day: "2026-07-06", weightKg: 91 },
          { day: "2026-07-20", weightKg: 89 },
        ],
      })
    );

    expect(result.weighInCount).toBe(2);
  });
});

// ---------------------------------------------------------------------
// Law 3: never blame the plan for a log we don't believe
// ---------------------------------------------------------------------

describe("untrusted intake", () => {
  it("test_a_half_empty_log_yields_no_data_rather_than_a_verdict", () => {
    // Two of every three days never made it into the app.
    const patchy = days("2026-07-06", 14, 2400).map((day, i) => ({
      ...day,
      counts: i % 3 === 0,
    }));

    const result = computeWeeklyTrend(input({ days: patchy }));

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("untrusted_intake");
    expect(result.suggestion).toBeNull();
    expect(result.measuredTdeeKcal).toBeNull();
    // The WEIGHT side is still perfectly knowable, and is still reported.
    expect(result.trendKgPerWeek).toBeCloseTo(-0.5, 2);
    expect(result.currentWeightKg).toBe(89);
  });

  it("test_an_untrusted_day_is_imputed_at_the_mean_not_counted_at_its_logged_kcal", () => {
    // One forgotten day holding a single 120 kcal coffee. If that number fed
    // the average, measured TDEE would collapse by ~160 kcal.
    const withHole = days("2026-07-06", 14, 2400).map((day, i) =>
      i === 5 ? { ...day, kcal: 120, counts: false } : day
    );

    const clean = computeWeeklyTrend(input());
    const holed = computeWeeklyTrend(input({ days: withHole }));

    expect(holed.status).not.toBe("INSUFFICIENT_DATA");
    expect(holed.avgDailyKcal).toBe(clean.avgDailyKcal);
    expect(holed.measuredTdeeKcal).toBe(clean.measuredTdeeKcal);
  });

  it("test_an_untrusted_recent_week_does_not_poison_the_older_reliable_one", () => {
    // Newest segment (the last 7 days) is mostly unlogged -> the measurement
    // must stop at the segment boundary rather than spanning the hole.
    const mixed = [
      ...days("2026-07-06", 7, 2400),
      ...days("2026-07-13", 7, 2400, false),
    ];

    const result = computeWeeklyTrend(input({ days: mixed }));

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("untrusted_intake");
  });
});

// ---------------------------------------------------------------------
// The measurement itself
// ---------------------------------------------------------------------

describe("implausible measurement (2026-08-01)", () => {
  it("test_measurementIsPlausible_rejects_a_burn_no_body_has", () => {
    expect(measurementIsPlausible(-204, 3362)).toBe(false);
    expect(measurementIsPlausible(0, 3362)).toBe(false);
    expect(measurementIsPlausible(MIN_PLAUSIBLE_TDEE_KCAL - 1, null)).toBe(
      false
    );
    expect(measurementIsPlausible(Number.NaN, 3362)).toBe(false);
  });

  it("test_a_real_correction_still_gets_through_the_band", () => {
    // The whole feature exists because the Mifflin estimate can be wrong by
    // 15-20%. That must not be filtered out as implausible.
    expect(measurementIsPlausible(2600, 2850)).toBe(true);
    expect(measurementIsPlausible(2300, 2850)).toBe(true);
    const edge = 2850 * (1 - MAX_TDEE_DEVIATION_PCT);
    expect(measurementIsPlausible(edge, 2850)).toBe(true);
    expect(measurementIsPlausible(edge - 100, 2850)).toBe(false);
  });

  it("test_the_users_real_card_no_longer_proposes_a_cut", () => {
    // Reproduces the screenshot: 85,0 kg on 22 July, 88,4 kg on 1 August, an
    // average of ~2.414 kcal logged throughout. The balance method makes that
    // a NEGATIVE metabolism, and the app offered to cut 250 kcal off it.
    const result = computeWeeklyTrend(
      input({
        weighIns: [
          { day: "2026-07-22", weightKg: 85 },
          { day: "2026-08-01", weightKg: 88.4 },
        ],
        days: days("2026-07-22", 10, 2414),
        currentDailyKcal: 3142,
        plannedTdeeKcal: 3362,
      })
    );

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reason).toBe("implausible_measurement");
    expect(result.suggestion).toBeNull();
    // The scale itself is still the user's own number and is still reported.
    expect(result.trendKgPerWeek).toBeGreaterThan(0);
  });
});

describe("a suggestion waits for the third weigh-in", () => {
  it("test_two_weigh_ins_report_a_trend_but_propose_nothing", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [90, 89.95]),
        days: days("2026-07-06", 7, 2400),
      })
    );

    expect(result.weighInCount).toBe(2);
    expect(result.confidence).toBe("low");
    expect(result.status).not.toBe("INSUFFICIENT_DATA");
    expect(result.suggestion).toBeNull();
  });

  it("test_the_third_weigh_in_unlocks_the_proposal", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [90, 89.95, 89.9]),
        days: days("2026-07-06", 14, 2400),
      })
    );

    expect(result.weighInCount).toBe(GOOD_CONFIDENCE_WEIGH_INS);
    expect(result.suggestion).not.toBeNull();
  });
});

describe("measured TDEE", () => {
  it("test_intake_balance_recovers_a_hand_computed_expenditure", () => {
    // 2400 kcal/day for 14 days, 1 kg down => 2400 + (1 x 7700)/14 = 2950.
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [90, 89.5, 89]),
        days: days("2026-07-06", 14, 2400),
      })
    );

    expect(result.avgDailyKcal).toBe(2400);
    expect(result.measuredDays).toBe(14);
    expect(result.measuredTdeeKcal).toBe(2950);
  });

  it("test_a_stable_weight_measures_expenditure_as_exactly_what_was_eaten", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [92, 92, 92]),
        days: days("2026-07-06", 14, 2600),
        goal: "maintain",
      })
    );

    expect(result.measuredTdeeKcal).toBe(2600);
    expect(result.status).toBe("ON_TRACK");
  });

  it("test_the_measurement_contradicts_the_prediction_when_the_plan_was_wrong", () => {
    // The scenario the whole feature exists for: three weeks stuck at 92 kg on
    // 2600 kcal, while the plan was written against a predicted 2850 TDEE.
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [92, 92, 92]),
        days: days("2026-07-06", 14, 2600),
        goal: "lose",
        currentDailyKcal: 2600,
        plannedTdeeKcal: 2850,
      })
    );

    expect(result.measuredTdeeKcal).toBe(2600);
    expect(result.plannedTdeeKcal).toBe(2850);
    expect(result.status).toBe("STALLED");
  });

  it("test_one_salty_morning_at_the_end_does_not_set_the_whole_verdict", () => {
    // Same real trend, but the final weigh-in lands 1 kg heavy on water. A
    // last-minus-first reading would call this a GAIN; the fit must not.
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-06-29", [91, 90.5, 90, 90.5]),
        days: days("2026-06-29", 21, 2400),
      })
    );

    expect(result.trendKgPerWeek).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------

describe("status", () => {
  it("test_losing_inside_the_half_to_one_percent_band_is_on_track", () => {
    const result = computeWeeklyTrend(input());

    expect(result.status).toBe("ON_TRACK");
    expect(result.suggestion).toBeNull();
    expect(result.trendKgPerWeek).toBeCloseTo(-0.5, 2);
    // 0.5-1.0% of 89 kg, shown on the scale's own sign.
    expect(result.expected?.minKgPerWeek).toBeCloseTo(-0.89, 2);
    expect(result.expected?.maxKgPerWeek).toBeCloseTo(-0.44, 2);
  });

  it("test_barely_moving_on_a_cut_is_too_slow", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 89.9, 89.8]) })
    );

    expect(result.status).toBe("TOO_SLOW");
    expect(result.suggestion?.direction).toBe("cut");
  });

  it("test_two_weeks_of_no_movement_on_a_cut_is_stalled_not_merely_slow", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 90, 90]) })
    );

    expect(result.status).toBe("STALLED");
    expect(result.spanDays).toBe(14);
  });

  it("test_one_flat_week_is_not_yet_a_stall", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-13", [90, 90]),
        days: days("2026-07-13", 7, 2400),
      })
    );

    expect(result.status).toBe("TOO_SLOW");
  });

  it("test_a_flat_maintain_never_reads_as_stalled", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [90, 90, 90]),
        goal: "maintain",
      })
    );

    expect(result.status).toBe("ON_TRACK");
  });

  it("test_losing_faster_than_one_percent_a_week_is_too_fast_and_adds_food", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 88.5, 87]) })
    );

    expect(result.status).toBe("TOO_FAST");
    expect(result.suggestion?.direction).toBe("add");
    expect(result.suggestion!.deltaKcal).toBeGreaterThan(0);
    // Protecting lean mass is not a licence to prescribe walking.
    expect(result.suggestion?.extraSteps).toBeNull();
  });

  it("test_gaining_while_trying_to_lose_is_too_slow", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [89, 89.5, 90]) })
    );

    expect(result.status).toBe("TOO_SLOW");
    expect(result.suggestion?.direction).toBe("cut");
  });

  it("test_tone_uses_a_gentler_band_than_lose", () => {
    // ~0.34%/week: under `lose`'s 0.5% floor, comfortably inside `tone`'s.
    const slow = weighIns("2026-07-06", [90, 89.7, 89.4]);
    const asLose = computeWeeklyTrend(input({ weighIns: slow, goal: "lose" }));
    const asTone = computeWeeklyTrend(input({ weighIns: slow, goal: "tone" }));

    expect(asLose.status).toBe("TOO_SLOW");
    expect(asTone.status).toBe("ON_TRACK");
  });
});

describe("gain mirrors the whole thing", () => {
  const gaining = (weights: readonly number[]) =>
    computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", weights),
        days: days("2026-07-06", 14, 3000),
        goal: "gain",
        currentDailyKcal: 3000,
      })
    );

  it("test_gaining_a_third_of_a_percent_a_week_is_on_track", () => {
    expect(gaining([80, 80.3, 80.6]).status).toBe("ON_TRACK");
  });

  it("test_not_gaining_is_too_slow_and_asks_for_MORE_food", () => {
    const result = gaining([80, 80, 80]);

    expect(result.status).toBe("TOO_SLOW");
    expect(result.suggestion?.direction).toBe("add");
    expect(result.suggestion!.deltaKcal).toBeGreaterThan(0);
  });

  it("test_gaining_too_fast_cuts_food_rather_than_prescribing_a_walk", () => {
    const result = gaining([80, 81, 82]);

    expect(result.status).toBe("TOO_FAST");
    expect(result.suggestion?.direction).toBe("cut");
    expect(result.suggestion!.deltaKcal).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------
// Law 4: the suggestion obeys the budget engine's caps
// ---------------------------------------------------------------------

describe("suggestion", () => {
  it("test_a_correction_is_never_smaller_than_150_or_larger_than_250_kcal", () => {
    const cases = [
      computeWeeklyTrend(input({ weighIns: weighIns("2026-07-06", [90, 90, 90]) })),
      computeWeeklyTrend(
        input({ weighIns: weighIns("2026-07-06", [90, 89.95, 89.9]) })
      ),
      computeWeeklyTrend(
        input({ weighIns: weighIns("2026-07-06", [90, 88.5, 87]) })
      ),
    ];

    for (const result of cases) {
      const delta = Math.abs(result.suggestion!.deltaKcal);
      expect(delta).toBeGreaterThanOrEqual(MIN_CORRECTION_KCAL);
      expect(delta).toBeLessThanOrEqual(MAX_CORRECTION_KCAL);
    }
  });

  it("test_the_new_target_is_the_current_one_plus_the_delta", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 90, 90]) })
    );

    expect(result.suggestion!.newDailyKcal).toBe(
      2400 + result.suggestion!.deltaKcal
    );
  });

  it("test_a_cut_always_offers_walking_as_the_alternative_to_eating_less", () => {
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 90, 90]) })
    );

    expect(result.suggestion!.extraSteps).toBeGreaterThan(0);
    expect(result.suggestion!.extraSteps! % 500).toBe(0);
  });

  it("test_the_cut_never_breaks_the_25_percent_deficit_cap", () => {
    // A slow metabolism: 1550 kcal a day measures out at ~1990 TDEE, and the
    // loss is just under the band. A full 250 cut would land at 1300 -- a 35%
    // deficit -- so the cap shortens the step to the 25% line.
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [90, 89.6, 89.2]),
        days: days("2026-07-06", 14, 1550),
        currentDailyKcal: 1550,
      })
    );

    const suggestion = result.suggestion!;
    expect(result.status).toBe("TOO_SLOW");
    expect(suggestion.newDailyKcal).toBeGreaterThanOrEqual(
      result.measuredTdeeKcal! * (1 - MAX_DEFICIT_PCT)
    );
    expect(suggestion.capped).toBe(true);
    expect(suggestion.capReasons).toContain("max_deficit_25_percent");
    // …and the deficit the food cannot deliver becomes a walk instead.
    expect(suggestion.extraSteps).toBeGreaterThan(0);
  });

  it("test_a_cap_never_lengthens_a_step_into_a_600_kcal_jump", () => {
    // Losing fast means eating far under measured expenditure (here ~4050 vs
    // 2400 -- a 41% deficit). The 25% rule must not "rescue" that in one leap.
    const result = computeWeeklyTrend(
      input({ weighIns: weighIns("2026-07-06", [90, 88.5, 87]) })
    );

    expect(result.suggestion!.deltaKcal).toBe(MAX_CORRECTION_KCAL);
  });

  // These three describe a 55 kg woman, so they also carry a planned TDEE that
  // suits her (~1.500). They used to inherit the 2.900 default, which is a
  // prediction no formula would make for this body -- and which the
  // plausibility band now correctly refuses to measure against.
  it("test_the_cut_never_goes_under_the_sex_specific_kcal_floor", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [55, 55, 55]),
        days: days("2026-07-06", 14, 1300),
        sex: "female",
        currentDailyKcal: 1300,
        plannedTdeeKcal: 1500,
      })
    );

    const suggestion = result.suggestion!;
    expect(suggestion.newDailyKcal).toBeGreaterThanOrEqual(KCAL_FLOOR.female);
    expect(suggestion.capReasons).toContain("floor_kcal");
    expect(suggestion.deltaKcal).toBeLessThanOrEqual(0);
  });

  it("test_a_cap_that_leaves_no_food_room_still_answers_with_activity", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [55, 55, 55]),
        days: days("2026-07-06", 14, 1200),
        sex: "female",
        currentDailyKcal: 1200,
        plannedTdeeKcal: 1500,
      })
    );

    const suggestion = result.suggestion!;
    expect(suggestion.deltaKcal).toBe(0);
    expect(suggestion.extraSteps).toBeGreaterThan(0);
  });

  it("test_a_cap_can_never_flip_a_cut_into_a_rise", () => {
    const result = computeWeeklyTrend(
      input({
        weighIns: weighIns("2026-07-06", [55, 55, 55]),
        days: days("2026-07-06", 14, 1150),
        sex: "female",
        currentDailyKcal: 1150,
        plannedTdeeKcal: 1500,
      })
    );

    expect(result.suggestion!.deltaKcal).toBeLessThanOrEqual(0);
  });

  it("test_an_on_track_week_is_left_completely_alone", () => {
    const result = computeWeeklyTrend(input());

    expect(result.suggestion).toBeNull();
  });
});
