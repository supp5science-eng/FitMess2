import { describe, expect, it } from "vitest";

import {
  acceptWeeklyMessage,
  allowedNumbers,
  extractLargeNumbers,
  MAX_MESSAGE_CHARS,
  numbersAreFaithful,
  weeklyMessageFacts,
  type WeeklyMessageFacts,
} from "@/lib/ai/weekly-message";
import type { WeeklyTrendResult } from "@/lib/weight/weekly-trend";

// The AI layer is allowed to WRITE and forbidden to DECIDE. The prompt says so;
// these tests are what makes it true, because a prompt is a request and this is
// a check. A model that invents "predlažem 2.200 kcal" must never reach a user
// whose actual suggested target is 2.400.

function facts(overrides: Partial<WeeklyMessageFacts> = {}): WeeklyMessageFacts {
  return {
    status: "STALLED",
    goal: "lose",
    currentWeightKg: 92,
    trendKgPerWeek: 0,
    expectedMinKgPerWeek: -0.92,
    expectedMaxKgPerWeek: -0.46,
    measuredTdeeKcal: 2600,
    plannedTdeeKcal: 2850,
    avgDailyKcal: 2600,
    measuredDays: 14,
    weighInCount: 3,
    currentDailyKcal: 2600,
    suggestedDailyKcal: 2400,
    suggestionDirection: "cut",
    extraSteps: 5000,
    capped: false,
    ...overrides,
  };
}

describe("extractLargeNumbers", () => {
  it("test_a_serbian_thousand_separator_reads_as_one_number_not_two", () => {
    expect(extractLargeNumbers("Predlažem 2.400 kcal dnevno.")).toEqual([2400]);
    expect(extractLargeNumbers("Predlažem 2 400 kcal dnevno.")).toEqual([2400]);
  });

  it("test_small_numbers_are_ignored", () => {
    // Weights, weeks and kg deltas are not the dangerous class of number.
    expect(extractLargeNumbers("Za 3 nedelje stojiš na 92 kg.")).toEqual([]);
  });

  it("test_several_numbers_in_one_sentence_are_all_found", () => {
    expect(
      extractLargeNumbers("Trošiš oko 2.600, a plan je računao 2.850.")
    ).toEqual([2600, 2850]);
  });
});

describe("allowedNumbers", () => {
  it("test_the_difference_between_the_two_targets_counts_as_given", () => {
    // "250 kcal manje" is derived from numbers we supplied, not invented.
    expect(allowedNumbers(facts())).toContain(200);
  });

  it("test_nulls_never_become_zeros_in_the_allowed_set", () => {
    const allowed = allowedNumbers(
      facts({ measuredTdeeKcal: null, plannedTdeeKcal: null })
    );
    expect(allowed).not.toContain(0);
  });
});

describe("numbersAreFaithful", () => {
  it("test_a_reply_quoting_only_our_numbers_passes", () => {
    const text =
      "Tri nedelje stojiš na 92 kg uz prosečan unos 2.600 kcal — znači da ti je stvarna potrošnja oko 2.600, a ne 2.850 kako je plan računao.";

    expect(numbersAreFaithful(text, facts())).toBe(true);
  });

  it("test_a_hallucinated_target_is_rejected", () => {
    const text = "Predlažem da spustiš na 2.150 kcal dnevno.";

    expect(numbersAreFaithful(text, facts())).toBe(false);
  });

  it("test_natural_rounding_is_allowed_but_a_different_claim_is_not", () => {
    // "oko 2.650" for 2.600 is how a person speaks.
    expect(numbersAreFaithful("Trošiš oko 2.650 kcal.", facts())).toBe(true);
    // 3.200 is near NOTHING we supplied — not the measured 2.600, not the
    // planned 2.850, not the suggested 2.400. (2.900 would pass, and should:
    // it is a rounding of the planned 2.850, which we did supply.)
    expect(numbersAreFaithful("Trošiš oko 3.200 kcal.", facts())).toBe(false);
  });

  it("test_a_reply_with_no_calorie_numbers_at_all_is_fine", () => {
    expect(
      numbersAreFaithful("Vaga stoji, pa predlažemo manji dnevni cilj.", facts())
    ).toBe(true);
  });
});

describe("acceptWeeklyMessage", () => {
  it("test_surrounding_quotes_are_stripped", () => {
    expect(acceptWeeklyMessage('"Vaga stoji tri nedelje."', facts())).toBe(
      "Vaga stoji tri nedelje."
    );
  });

  it("test_an_empty_answer_is_refused", () => {
    expect(acceptWeeklyMessage("   ", facts())).toBeNull();
  });

  it("test_a_runaway_answer_is_refused_rather_than_filling_the_card", () => {
    expect(
      acceptWeeklyMessage("a".repeat(MAX_MESSAGE_CHARS + 1), facts())
    ).toBeNull();
  });

  it("test_an_invented_number_loses_to_the_template", () => {
    expect(
      acceptWeeklyMessage("Spusti na 1.900 kcal dnevno.", facts())
    ).toBeNull();
  });
});

describe("weeklyMessageFacts", () => {
  it("test_it_carries_only_what_the_engine_decided", () => {
    const trend = {
      status: "TOO_FAST",
      reason: null,
      confidence: "good",
      weighInCount: 3,
      spanDays: 14,
      currentWeightKg: 87,
      trendKgPerWeek: -1.5,
      trendPctPerWeek: -0.017,
      expected: {
        minKgPerWeek: -0.87,
        maxKgPerWeek: -0.44,
        minPct: -0.01,
        maxPct: -0.005,
      },
      measuredTdeeKcal: 4050,
      plannedTdeeKcal: 2900,
      avgDailyKcal: 2400,
      trustedDays: 14,
      measuredDays: 14,
      suggestion: {
        direction: "add",
        deltaKcal: 250,
        newDailyKcal: 2650,
        extraSteps: null,
        capped: false,
        capReasons: [],
      },
    } satisfies WeeklyTrendResult;

    const result = weeklyMessageFacts(trend, 2400, "lose");

    expect(result.status).toBe("TOO_FAST");
    expect(result.suggestedDailyKcal).toBe(2650);
    expect(result.suggestionDirection).toBe("add");
    expect(result.currentDailyKcal).toBe(2400);
    expect(result.goal).toBe("lose");
  });
});
