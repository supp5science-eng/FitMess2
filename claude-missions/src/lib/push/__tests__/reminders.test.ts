import { describe, expect, it } from "vitest";

import {
  REMINDER_WINDOW_MINUTES,
  belgradeMinutesOfDay,
  buildReminderPayload,
  isReminderDue,
  parseTimeToMinutes,
} from "../reminders";

// F071 / AS-117: the daily-reminder due-ness rules. All wall-clock values in
// Europe/Belgrade — winter dates are CET (UTC+1), summer dates CEST (UTC+2).

// 2026-01-15 (winter, CET): 19:00 Belgrade = 18:00 UTC.
const WINTER_19H = new Date("2026-01-15T18:00:00Z");
const WINTER_DAY = "2026-01-15";
// 2026-07-15 (summer, CEST): 19:00 Belgrade = 17:00 UTC.
const SUMMER_19H = new Date("2026-07-15T17:00:00Z");
const SUMMER_DAY = "2026-07-15";

const BASE = {
  reminderTime: "19:00:00",
  lastSentOn: null,
  hasLoggedToday: false,
};

describe("parseTimeToMinutes", () => {
  it("parses HH:MM:SS and HH:MM", () => {
    expect(parseTimeToMinutes("19:00:00")).toBe(19 * 60);
    expect(parseTimeToMinutes("08:30")).toBe(8 * 60 + 30);
  });

  it("returns null for NULL/malformed/out-of-range values", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes("not-a-time")).toBeNull();
    expect(parseTimeToMinutes("25:00")).toBeNull();
    expect(parseTimeToMinutes("12:75")).toBeNull();
  });
});

describe("belgradeMinutesOfDay handles CET and CEST", () => {
  it("winter (CET, UTC+1): 18:00 UTC is 19:00 in Belgrade", () => {
    expect(belgradeMinutesOfDay(WINTER_19H)).toBe(19 * 60);
  });

  it("summer (CEST, UTC+2): 17:00 UTC is 19:00 in Belgrade", () => {
    expect(belgradeMinutesOfDay(SUMMER_19H)).toBe(19 * 60);
  });
});

describe("isReminderDue", () => {
  it("due exactly at the chosen time (winter and summer)", () => {
    expect(isReminderDue(BASE, WINTER_19H, WINTER_DAY)).toBe(true);
    expect(isReminderDue(BASE, SUMMER_19H, SUMMER_DAY)).toBe(true);
  });

  it("not due before the chosen time", () => {
    // 18:55 Belgrade in winter = 17:55 UTC.
    const before = new Date("2026-01-15T17:55:00Z");
    expect(isReminderDue(BASE, before, WINTER_DAY)).toBe(false);
  });

  it("due inside the catch-up window, not after it", () => {
    // 19:00 + (window - 1) minutes — still due.
    const inside = new Date(
      WINTER_19H.getTime() + (REMINDER_WINDOW_MINUTES - 1) * 60_000
    );
    expect(isReminderDue(BASE, inside, WINTER_DAY)).toBe(true);
    // 19:00 + window minutes — a stale reminder, skipped.
    const outside = new Date(
      WINTER_19H.getTime() + REMINDER_WINDOW_MINUTES * 60_000
    );
    expect(isReminderDue(BASE, outside, WINTER_DAY)).toBe(false);
  });

  it("idempotent within a day: already sent today means not due (AS-117)", () => {
    expect(
      isReminderDue({ ...BASE, lastSentOn: WINTER_DAY }, WINTER_19H, WINTER_DAY)
    ).toBe(false);
    // …but yesterday's send doesn't block today.
    expect(
      isReminderDue(
        { ...BASE, lastSentOn: "2026-01-14" },
        WINTER_19H,
        WINTER_DAY
      )
    ).toBe(true);
  });

  it("zero-shame: never nags someone who already logged a meal today", () => {
    expect(
      isReminderDue({ ...BASE, hasLoggedToday: true }, WINTER_19H, WINTER_DAY)
    ).toBe(false);
  });

  it("NULL reminder_time means reminders are off (AS-118)", () => {
    expect(
      isReminderDue({ ...BASE, reminderTime: null }, WINTER_19H, WINTER_DAY)
    ).toBe(false);
  });
});

describe("buildReminderPayload", () => {
  it("greets by name when one exists and always deep-links to /danas", () => {
    const payload = buildReminderPayload("Ana");
    expect(payload.title).toContain("Ana");
    expect(payload.url).toBe("/danas");
  });

  it("has a name-free variant", () => {
    const payload = buildReminderPayload(null);
    expect(payload.title.length).toBeGreaterThan(0);
    expect(payload.title).not.toContain("null");
  });
});
