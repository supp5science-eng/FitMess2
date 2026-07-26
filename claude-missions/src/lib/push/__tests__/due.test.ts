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
