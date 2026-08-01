import { describe, expect, it } from "vitest";

import {
  DEFAULT_USUAL_MINUTES,
  mealNudgeDue,
  slotOf,
  usualMealMinutes,
  type MealHistory,
} from "@/lib/push/meal-rhythm";

/** Minutes since midnight, written the way a human reads a clock. */
function at(hours: number, minutes = 0): number {
  return hours * 60 + minutes;
}

function history(partial: Partial<MealHistory["byslot"]> = {}): MealHistory {
  return {
    byslot: {
      breakfast: partial.breakfast ?? [],
      lunch: partial.lunch ?? [],
      dinner: partial.dinner ?? [],
    },
  };
}

describe("slotOf", () => {
  it("splits the day into three meals", () => {
    expect(slotOf(at(8))).toBe("breakfast");
    expect(slotOf(at(13))).toBe("lunch");
    expect(slotOf(at(20))).toBe("dinner");
  });

  it("counts a past-midnight entry as dinner, not tomorrow's breakfast", () => {
    expect(slotOf(at(0, 30))).toBe("dinner");
  });
});

describe("usualMealMinutes", () => {
  it("falls back to the defaults without enough history", () => {
    expect(usualMealMinutes(history({ breakfast: [at(7), at(7, 15)] }))).toEqual(
      DEFAULT_USUAL_MINUTES
    );
  });

  it("learns the user's own time once there is enough of it", () => {
    const usual = usualMealMinutes(
      history({ breakfast: [at(7), at(7, 20), at(6, 40)] })
    );
    expect(usual.breakfast).toBe(at(7));
  });

  it("is not dragged by one meal written down at midnight", () => {
    // Four sane lunches and one logged at 23:00: the mean would land in the
    // late afternoon, the median stays where the person actually eats.
    const usual = usualMealMinutes(
      history({ lunch: [at(13), at(13, 30), at(12, 30), at(13), at(23)] })
    );
    expect(usual.lunch).toBe(at(13));
  });
});

describe("mealNudgeDue", () => {
  const rhythm = history({
    breakfast: [at(8), at(8), at(8)],
    lunch: [at(13), at(13), at(13)],
    dinner: [at(20), at(20), at(20)],
  });

  it("says nothing while the user is still inside the grace period", () => {
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: rhythm,
        nowMinutes: at(8, 30),
      })
    ).toBeNull();
  });

  it("names the meal once its usual time has passed", () => {
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: rhythm,
        nowMinutes: at(9),
      })
    ).toEqual({ kind: "slot", slot: "breakfast" });
  });

  it("says nothing when that meal is already logged", () => {
    expect(
      mealNudgeDue({
        todayLogMinutes: [at(8, 10)],
        history: rhythm,
        nowMinutes: at(9),
      })
    ).toBeNull();
  });

  it("asks about dinner, not the breakfast that is no longer coming", () => {
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: rhythm,
        nowMinutes: at(21),
      })
    ).toEqual({ kind: "slot", slot: "dinner" });
  });

  it("gives up on a slot once its window has closed", () => {
    // 16:00: breakfast is long gone and lunch's grace has not elapsed.
    expect(
      mealNudgeDue({
        todayLogMinutes: [at(13)],
        history: rhythm,
        nowMinutes: at(16),
      })
    ).toBeNull();
  });

  it("notices a long silence that fits no slot window", () => {
    // 17:00 for a 13:00 luncher: lunch's window closed an hour ago and dinner
    // is not due yet, but nothing has been written down since breakfast.
    const result = mealNudgeDue({
      todayLogMinutes: [at(8)],
      history: rhythm,
      nowMinutes: at(17),
    });
    expect(result).toEqual({
      kind: "gap",
      sinceMinutes: at(9),
      lastSlot: "breakfast",
    });
  });

  it("prefers naming the meal over reporting the silence", () => {
    // Both rules could fire at 15:00 for a no-history user (lunch is assumed at
    // 13:30). "Ručak nije upisan" is more useful than "prošlo je 7 sati".
    expect(
      mealNudgeDue({
        todayLogMinutes: [at(8)],
        history: history({}),
        nowMinutes: at(15),
      })
    ).toEqual({ kind: "slot", slot: "lunch" });
  });

  it("never speaks before 08:00 or after 21:30", () => {
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: rhythm,
        nowMinutes: at(6),
      })
    ).toBeNull();
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: rhythm,
        nowMinutes: at(22, 30),
      })
    ).toBeNull();
  });

  it("uses the defaults for a user with no history at all", () => {
    // No history: breakfast is assumed at 09:00, so 09:50 is past its grace.
    expect(
      mealNudgeDue({
        todayLogMinutes: [],
        history: history({}),
        nowMinutes: at(9, 50),
      })
    ).toEqual({ kind: "slot", slot: "breakfast" });
  });
});
