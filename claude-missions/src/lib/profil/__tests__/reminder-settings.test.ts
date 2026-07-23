import { describe, expect, it, vi } from "vitest";

import {
  isValidReminderTime,
  updateReminderTime,
} from "../reminder-settings";

// F071 / AS-116, AS-118: unit coverage for the reminder-settings core.

function supabaseMock(updateError: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as never,
    from,
    update,
    eq,
  };
}

describe("isValidReminderTime", () => {
  it("accepts what <input type=time> submits", () => {
    expect(isValidReminderTime("08:30")).toBe(true);
    expect(isValidReminderTime("23:59")).toBe(true);
    expect(isValidReminderTime("00:00")).toBe(true);
  });

  it("rejects malformed or out-of-range values", () => {
    expect(isValidReminderTime("24:00")).toBe(false);
    expect(isValidReminderTime("12:60")).toBe(false);
    expect(isValidReminderTime("9:30")).toBe(false);
    expect(isValidReminderTime("evening")).toBe(false);
  });
});

describe("updateReminderTime", () => {
  it("writes the chosen time to the caller's own profile row", async () => {
    const mock = supabaseMock();
    const result = await updateReminderTime(mock.client, "user-1", "19:00");

    expect(result).toEqual({ ok: true });
    expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.update).toHaveBeenCalledWith({ reminder_time: "19:00" });
    expect(mock.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("clearing (null) disables reminders AND resets the sent marker (AS-118)", async () => {
    const mock = supabaseMock();
    const result = await updateReminderTime(mock.client, "user-1", null);

    expect(result).toEqual({ ok: true });
    expect(mock.update).toHaveBeenCalledWith({
      reminder_time: null,
      reminder_last_sent_on: null,
    });
  });

  it("rejects an invalid time with a Serbian error, without writing", async () => {
    const mock = supabaseMock();
    const result = await updateReminderTime(mock.client, "user-1", "25:99");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_sr).toMatch(/vreme/i);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("maps a DB failure to a friendly Serbian error", async () => {
    const mock = supabaseMock({ message: "boom" });
    const result = await updateReminderTime(mock.client, "user-1", "19:00");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_sr).toMatch(/podsetnik/i);
  });
});
