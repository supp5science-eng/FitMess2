import { describe, expect, it } from "vitest";

import {
  EVENING_LEFTOVER_KCAL,
  MAX_LATE_MINUTES,
  MAX_PER_DAY,
  eveningHasSomethingToSay,
  remindersDue,
  timeToMinutes,
  type DueReminder,
  type ReminderSettingsRow,
  type UserDayFacts,
} from "@/lib/push/due";

const TODAY = "2026-07-25";
const USER = "user-1";

function row(overrides: Partial<ReminderSettingsRow> = {}): ReminderSettingsRow {
  return {
    user_id: USER,
    meal_enabled: true,
    meal_last_sent: null,
    evening_enabled: true,
    evening_time: "20:00:00",
    evening_last_sent: null,
    ...overrides,
  };
}

/** A day in which nothing has happened and nothing is missing — every reminder
 * below then has to earn its way out of silence. */
function facts(overrides: Partial<UserDayFacts> = {}): UserDayFacts {
  return {
    todayLogMinutes: [],
    history: { byslot: { breakfast: [], lunch: [], dinner: [] } },
    hasWorkoutToday: false,
    usesWorkouts: false,
    loggedMeals: 0,
    hasTarget: false,
    remainingKcal: 0,
    overshootKcal: 0,
    ...overrides,
  };
}

function due(
  settings: ReminderSettingsRow[],
  nowMinutes: number,
  userFacts: UserDayFacts = facts(),
  todayWeekdayIndex?: number
): DueReminder[] {
  return remindersDue({
    settings,
    facts: new Map([[USER, userFacts]]),
    todayKey: TODAY,
    nowMinutes,
    todayWeekdayIndex,
  });
}

/** Minutes since midnight for a readable `"HH:MM"`. */
function at(clock: string): number {
  return timeToMinutes(clock)!;
}

describe("timeToMinutes", () => {
  it("parses both the bare and the Postgres `time` shape", () => {
    expect(timeToMinutes("12:00")).toBe(720);
    expect(timeToMinutes("12:30:00")).toBe(750);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:45")).toBe(1425);
  });

  it("rejects nonsense instead of inventing a time", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("25:00")).toBeNull();
    expect(timeToMinutes("12:60")).toBeNull();
    expect(timeToMinutes("podne")).toBeNull();
  });
});

describe("eveningHasSomethingToSay", () => {
  it("speaks when the day is empty", () => {
    expect(eveningHasSomethingToSay(facts({ loggedMeals: 0 }))).toBe(true);
  });

  it("speaks when a training day went unlogged", () => {
    expect(
      eveningHasSomethingToSay(
        facts({ loggedMeals: 3, usesWorkouts: true, hasWorkoutToday: false })
      )
    ).toBe(true);
  });

  it("does not ask about training from someone who never logs any", () => {
    expect(
      eveningHasSomethingToSay(
        facts({ loggedMeals: 3, usesWorkouts: false, hasTarget: true })
      )
    ).toBe(false);
  });

  it("speaks about an overshoot", () => {
    expect(
      eveningHasSomethingToSay(
        facts({ loggedMeals: 3, hasTarget: true, overshootKcal: 300 })
      )
    ).toBe(true);
  });

  it("speaks when a lot of the budget is still unspent", () => {
    expect(
      eveningHasSomethingToSay(
        facts({
          loggedMeals: 2,
          hasTarget: true,
          remainingKcal: EVENING_LEFTOVER_KCAL,
        })
      )
    ).toBe(true);
  });

  it("stays quiet on a day that went fine and is written down", () => {
    expect(
      eveningHasSomethingToSay(
        facts({
          loggedMeals: 3,
          hasTarget: true,
          remainingKcal: 120,
          usesWorkouts: true,
          hasWorkoutToday: true,
        })
      )
    ).toBe(false);
  });
});

describe("remindersDue — the meal nudge", () => {
  it("fires once the user's usual meal time has passed unlogged", () => {
    const result = due([row()], at("09:50"));
    expect(result).toEqual([
      { userId: USER, kind: "meal", mealReason: { kind: "slot", slot: "breakfast" } },
    ]);
  });

  it("stays quiet when that meal is already logged", () => {
    expect(
      due([row()], at("09:50"), facts({ todayLogMinutes: [at("08:30")] }))
    ).toEqual([]);
  });

  it("is off when the user switched it off", () => {
    expect(due([row({ meal_enabled: false })], at("09:50"))).toEqual([]);
  });

  it("never sends twice in one day", () => {
    expect(due([row({ meal_last_sent: TODAY })], at("09:50"))).toEqual([]);
  });

  it("says nothing without facts — an unjudged reminder is not sent", () => {
    expect(
      remindersDue({
        settings: [row()],
        todayKey: TODAY,
        nowMinutes: at("09:50"),
      })
    ).toEqual([]);
  });
});

describe("remindersDue — the evening close-out", () => {
  const emptyDay = facts({ loggedMeals: 0 });

  it("goes out at its time when it has something to say", () => {
    const result = due([row({ meal_enabled: false })], at("20:00"), emptyDay);
    expect(result).toEqual([{ userId: USER, kind: "evening" }]);
  });

  it("is skipped entirely on a day with no news", () => {
    const quietDay = facts({
      loggedMeals: 3,
      hasTarget: true,
      remainingKcal: 100,
    });
    expect(due([row({ meal_enabled: false })], at("20:00"), quietDay)).toEqual(
      []
    );
  });

  it("still goes out late, but not hours late", () => {
    expect(
      due([row({ meal_enabled: false })], at("20:00") + MAX_LATE_MINUTES, emptyDay)
    ).toHaveLength(1);
    expect(
      due(
        [row({ meal_enabled: false })],
        at("20:00") + MAX_LATE_MINUTES + 1,
        emptyDay
      )
    ).toEqual([]);
  });

  it("never sends twice in one day", () => {
    expect(
      due([row({ meal_enabled: false, evening_last_sent: TODAY })], at("20:00"), emptyDay)
    ).toEqual([]);
  });
});

describe("remindersDue — the weekly weigh-in", () => {
  const weighInRow = row({
    meal_enabled: false,
    evening_enabled: false,
    weighin_enabled: true,
    weighin_day: 6,
    weighin_time: "09:00:00",
  });

  it("fires on its weekday", () => {
    expect(due([weighInRow], at("09:00"), facts(), 6)).toEqual([
      { userId: USER, kind: "weighin" },
    ]);
  });

  it("is silent on every other day", () => {
    expect(due([weighInRow], at("09:00"), facts(), 2)).toEqual([]);
  });

  it("is silent when the caller has no calendar to check against", () => {
    expect(due([weighInRow], at("09:00"))).toEqual([]);
  });
});

describe("remindersDue — the daily ceiling", () => {
  it("sends at most two in a day, counting what already went out", () => {
    const spent = row({ sent_day: TODAY, sent_count: MAX_PER_DAY });
    expect(due([spent], at("09:50"))).toEqual([]);
  });

  it("ignores a count left over from a previous day", () => {
    const stale = row({ sent_day: "2026-07-24", sent_count: MAX_PER_DAY });
    expect(due([stale], at("09:50"))).toHaveLength(1);
  });

  it("gives the last slot to the higher-priority reminder", () => {
    // One slot left, and both the meal nudge and the weigh-in are due: the
    // weekly one wins, because the plan's self-correction depends on it.
    const both = row({
      sent_day: TODAY,
      sent_count: MAX_PER_DAY - 1,
      weighin_enabled: true,
      weighin_day: 6,
      weighin_time: "09:00:00",
    });
    expect(due([both], at("09:50"), facts(), 6)).toEqual([
      { userId: USER, kind: "weighin" },
    ]);
  });

  it("can send two in one run when the budget allows", () => {
    const both = row({
      weighin_enabled: true,
      weighin_day: 6,
      weighin_time: "09:00:00",
    });
    const result = due([both], at("09:50"), facts(), 6);
    expect(result.map((item) => item.kind)).toEqual(["weighin", "meal"]);
  });
});
