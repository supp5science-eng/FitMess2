import { describe, expect, it } from "vitest";

import {
  MAX_LATE_MINUTES,
  timeToMinutes,
  usersDueForNoLogReminder,
  type ReminderSettingsRow,
} from "@/lib/push/due";

const TODAY = "2026-07-25";

function row(overrides: Partial<ReminderSettingsRow> = {}): ReminderSettingsRow {
  return {
    user_id: "user-1",
    no_log_enabled: true,
    no_log_time: "12:00:00",
    no_log_last_sent: null,
    ...overrides,
  };
}

function due(
  settings: ReminderSettingsRow[],
  nowMinutes: number,
  logged: string[] = []
): string[] {
  return usersDueForNoLogReminder({
    settings,
    usersWithLogsToday: new Set(logged),
    todayKey: TODAY,
    nowMinutes,
  });
}

describe("timeToMinutes", () => {
  it("parses both the bare and the Postgres `time` shape", () => {
    expect(timeToMinutes("12:00")).toBe(720);
    expect(timeToMinutes("12:30:00")).toBe(750);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:45")).toBe(1425);
  });

  it("refuses nonsense instead of guessing", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("25:00")).toBeNull();
    expect(timeToMinutes("12:60")).toBeNull();
    expect(timeToMinutes("podne")).toBeNull();
  });
});

describe("usersDueForNoLogReminder", () => {
  it("sends once the chosen time has passed and the day is still empty", () => {
    expect(due([row()], 720)).toEqual(["user-1"]);
    expect(due([row()], 725)).toEqual(["user-1"]);
  });

  it("stays quiet before the chosen time", () => {
    expect(due([row()], 719)).toEqual([]);
  });

  it("never nags someone who already logged today", () => {
    expect(due([row()], 730, ["user-1"])).toEqual([]);
  });

  it("never fires twice in one day", () => {
    expect(due([row({ no_log_last_sent: TODAY })], 730)).toEqual([]);
    // …but yesterday's send does not block today's.
    expect(due([row({ no_log_last_sent: "2026-07-24" })], 730)).toEqual([
      "user-1",
    ]);
  });

  it("skips a reminder that is switched off", () => {
    expect(due([row({ no_log_enabled: false })], 730)).toEqual([]);
  });

  it("gives up on a badly missed slot instead of pushing at night", () => {
    // A scheduler hiccup inside the window still delivers…
    expect(due([row()], 720 + MAX_LATE_MINUTES)).toEqual(["user-1"]);
    // …but a 12:00 reminder must not land at 22:00.
    expect(due([row()], 720 + MAX_LATE_MINUTES + 1)).toEqual([]);
  });

  it("ignores a row whose stored time is unparseable rather than throwing", () => {
    expect(due([row({ no_log_time: "" })], 730)).toEqual([]);
  });

  it("decides per user in one pass", () => {
    const result = due(
      [
        row({ user_id: "empty-day" }),
        row({ user_id: "already-logged" }),
        row({ user_id: "later-today", no_log_time: "20:00:00" }),
        row({ user_id: "done-today", no_log_last_sent: TODAY }),
      ],
      730,
      ["already-logged"]
    );

    expect(result).toEqual(["empty-day"]);
  });
});
