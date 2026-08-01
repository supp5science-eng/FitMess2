import { describe, expect, it } from "vitest";

import {
  MAX_LATE_MINUTES,
  remindersDue,
  timeToMinutes,
  type DueReminder,
  type ReminderSettingsRow,
} from "@/lib/push/due";

const TODAY = "2026-07-25";

function row(overrides: Partial<ReminderSettingsRow> = {}): ReminderSettingsRow {
  return {
    user_id: "user-1",
    morning_enabled: true,
    morning_time: "10:00:00",
    morning_last_sent: null,
    evening_enabled: true,
    evening_time: "20:00:00",
    evening_last_sent: null,
    ...overrides,
  };
}

function due(
  settings: ReminderSettingsRow[],
  nowMinutes: number
): DueReminder[] {
  return remindersDue({ settings, todayKey: TODAY, nowMinutes });
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

  it("rejects nonsense rather than guessing", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("noon")).toBeNull();
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("12:99")).toBeNull();
  });
});

describe("remindersDue", () => {
  it("sends the morning reminder once its time has passed", () => {
    expect(due([row()], at("10:00"))).toEqual([
      { userId: "user-1", kind: "morning" },
    ]);
  });

  it("stays quiet before the chosen time", () => {
    expect(due([row()], at("09:45"))).toEqual([]);
  });

  it("sends the evening recap on its own schedule", () => {
    expect(due([row()], at("20:00"))).toEqual([
      { userId: "user-1", kind: "evening" },
    ]);
  });

  // The whole point of v2: a user who logs every day must still be reminded.
  // There is no longer any "did they log?" input to this decision at all.
  it("does not depend on whether the user has logged anything", () => {
    expect(due([row()], at("10:30"))).toEqual([
      { userId: "user-1", kind: "morning" },
    ]);
  });

  it("skips a reminder that is switched off, keeping the other", () => {
    expect(due([row({ morning_enabled: false })], at("10:00"))).toEqual([]);
    expect(due([row({ morning_enabled: false })], at("20:00"))).toEqual([
      { userId: "user-1", kind: "evening" },
    ]);
  });

  it("never sends the same reminder twice in a day", () => {
    expect(due([row({ morning_last_sent: TODAY })], at("10:15"))).toEqual([]);
  });

  it("tracks the two guards independently", () => {
    // Morning already went out; the evening recap is still owed.
    const settings = [row({ morning_last_sent: TODAY })];
    expect(due(settings, at("20:00"))).toEqual([
      { userId: "user-1", kind: "evening" },
    ]);
  });

  it("still sends a reminder the scheduler was late for", () => {
    expect(due([row()], at("10:00") + MAX_LATE_MINUTES)).toEqual([
      { userId: "user-1", kind: "morning" },
    ]);
  });

  it("gives up rather than sending a badly stale reminder", () => {
    expect(due([row()], at("10:00") + MAX_LATE_MINUTES + 1)).toEqual([]);
  });

  it("ignores an unparseable stored time instead of throwing", () => {
    expect(due([row({ morning_time: "" })], at("10:00"))).toEqual([]);
  });

  it("can owe one user both reminders when their times overlap", () => {
    const settings = [row({ morning_time: "20:00:00" })];
    expect(due(settings, at("20:00"))).toEqual([
      { userId: "user-1", kind: "morning" },
      { userId: "user-1", kind: "evening" },
    ]);
  });

  it("decides each user independently", () => {
    const settings = [
      row({ user_id: "a" }),
      row({ user_id: "b", morning_enabled: false }),
      row({ user_id: "c", morning_last_sent: TODAY }),
    ];

    expect(due(settings, at("10:00"))).toEqual([
      { userId: "a", kind: "morning" },
    ]);
  });
});

// Nedeljno merenje (0024): the third reminder, and the only weekly one. It
// exists because a weigh-in is only comparable week to week if it happens on
// the same weekday -- so "is it that day?" is part of being due.

/** 2026-07-25 is a Saturday, i.e. weekday index 5 (Monday = 0). */
const SATURDAY = 5;
const SUNDAY = 6;

function weighInRow(
  overrides: Partial<ReminderSettingsRow> = {}
): ReminderSettingsRow {
  return row({
    morning_enabled: false,
    evening_enabled: false,
    weighin_enabled: true,
    weighin_day: SATURDAY,
    weighin_time: "09:00:00",
    weighin_last_sent: null,
    ...overrides,
  });
}

describe("weekly weigh-in reminder", () => {
  it("test_it_fires_on_its_own_weekday_at_its_own_time", () => {
    const result = remindersDue({
      settings: [weighInRow()],
      todayKey: TODAY,
      nowMinutes: at("09:00"),
      todayWeekdayIndex: SATURDAY,
    });

    expect(result).toEqual([{ userId: "user-1", kind: "weighin" }]);
  });

  it("test_it_stays_silent_on_every_other_day_of_the_week", () => {
    const result = remindersDue({
      settings: [weighInRow({ weighin_day: SUNDAY })],
      todayKey: TODAY,
      nowMinutes: at("09:00"),
      todayWeekdayIndex: SATURDAY,
    });

    expect(result).toEqual([]);
  });

  it("test_a_caller_with_no_weekday_never_triggers_it", () => {
    // Silence beats nagging on a Tuesday: without a calendar we don't guess.
    const result = remindersDue({
      settings: [weighInRow()],
      todayKey: TODAY,
      nowMinutes: at("09:00"),
    });

    expect(result).toEqual([]);
  });

  it("test_a_row_written_before_the_migration_simply_has_no_weigh_in", () => {
    const result = remindersDue({
      settings: [row({ morning_enabled: false, evening_enabled: false })],
      todayKey: TODAY,
      nowMinutes: at("09:00"),
      todayWeekdayIndex: SATURDAY,
    });

    expect(result).toEqual([]);
  });

  it("test_it_obeys_the_same_late_window_as_the_daily_reminders", () => {
    const inWindow = remindersDue({
      settings: [weighInRow()],
      todayKey: TODAY,
      nowMinutes: at("09:00") + MAX_LATE_MINUTES,
      todayWeekdayIndex: SATURDAY,
    });
    expect(inWindow).toHaveLength(1);

    const tooLate = remindersDue({
      settings: [weighInRow()],
      todayKey: TODAY,
      nowMinutes: at("09:00") + MAX_LATE_MINUTES + 1,
      todayWeekdayIndex: SATURDAY,
    });
    expect(tooLate).toEqual([]);
  });

  it("test_it_cannot_go_out_twice_in_a_day", () => {
    const result = remindersDue({
      settings: [weighInRow({ weighin_last_sent: TODAY })],
      todayKey: TODAY,
      nowMinutes: at("09:30"),
      todayWeekdayIndex: SATURDAY,
    });

    expect(result).toEqual([]);
  });

  it("test_switching_it_off_switches_it_off", () => {
    const result = remindersDue({
      settings: [weighInRow({ weighin_enabled: false })],
      todayKey: TODAY,
      nowMinutes: at("09:00"),
      todayWeekdayIndex: SATURDAY,
    });

    expect(result).toEqual([]);
  });
});
