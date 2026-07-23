import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// F071 / AS-117: unit coverage for the reminder cron route — the
// shared-secret gate (fails closed), the "nothing due" no-op, and a real
// send that stamps the idempotency marker and prunes dead subscriptions.

const sendPushMock = vi.fn();
vi.mock("@/lib/push/send", () => ({
  sendPush: (...args: unknown[]) => sendPushMock(...args),
}));

// A tiny scriptable stand-in for the admin client: each `from(table)` call
// returns a chainable object resolving to the queued result for that table.
type TableResult = { data: unknown; error: { message: string } | null };
const tableResults = new Map<string, TableResult>();
const updates: Array<{ table: string; values: unknown }> = [];
const deletes: Array<{ table: string }> = [];

function chainFor(table: string) {
  const result = tableResults.get(table) ?? { data: [], error: null };
  const chain = {
    select: () => chain,
    not: () => chain,
    or: () => chain,
    in: () => chain,
    gte: () => chain,
    lt: () => chain,
    update: (values: unknown) => {
      updates.push({ table, values });
      return chain;
    },
    delete: () => {
      deletes.push({ table });
      return chain;
    },
    eq: () => chain,
    then: (resolve: (value: TableResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ from: (table: string) => chainFor(table) }),
}));

import { POST } from "../route";

function request(secret?: string) {
  return new NextRequest("https://fitmess.app/api/cron/reminders", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  tableResults.clear();
  updates.length = 0;
  deletes.length = 0;
  sendPushMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access control: fails closed", () => {
  it("401 without the x-cron-secret header", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it("401 with a wrong secret", async () => {
    const response = await POST(request("wrong"));
    expect(response.status).toBe(401);
  });

  it("401 when CRON_SECRET is not configured at all — even with a header", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await POST(request(""));
    expect(response.status).toBe(401);
  });
});

describe("no-op paths", () => {
  it("no candidates -> 200 with zero counts (clean empty state)", async () => {
    tableResults.set("profiles", { data: [], error: null });
    const response = await POST(request("test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      checked: 0,
      due: 0,
      sent: 0,
    });
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});

describe("a due user gets exactly one delivered reminder", () => {
  function dueProfile() {
    // reminder_time = current Belgrade wall-clock minute, so the candidate
    // is due at test runtime regardless of when the suite runs.
    const belgrade = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Belgrade",
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    return {
      user_id: "user-1",
      full_name: "Ana",
      reminder_time: `${belgrade.replace(":", ":")}:00`,
      reminder_last_sent_on: null,
    };
  }

  it("sends, stamps reminder_last_sent_on, reports the summary", async () => {
    tableResults.set("profiles", { data: [dueProfile()], error: null });
    tableResults.set("logs", { data: [], error: null });
    tableResults.set("push_subscriptions", {
      data: [
        { user_id: "user-1", endpoint: "https://push/e1", p256dh: "k", auth: "a" },
      ],
      error: null,
    });
    sendPushMock.mockResolvedValue("sent");

    const response = await POST(request("test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(sendPushMock).toHaveBeenCalledTimes(1);
    // The payload greets by name and deep-links home.
    expect(sendPushMock.mock.calls[0][1]).toMatchObject({ url: "/danas" });
    expect(body).toMatchObject({ ok: true, due: 1, sent: 1 });
    // Idempotency marker stamped on the profile.
    expect(updates).toContainEqual({
      table: "profiles",
      values: expect.objectContaining({ reminder_last_sent_on: expect.any(String) }),
    });
  });

  it("prunes a dead subscription (410) and does NOT stamp the day", async () => {
    tableResults.set("profiles", { data: [dueProfile()], error: null });
    tableResults.set("logs", { data: [], error: null });
    tableResults.set("push_subscriptions", {
      data: [
        { user_id: "user-1", endpoint: "https://push/dead", p256dh: "k", auth: "a" },
      ],
      error: null,
    });
    sendPushMock.mockResolvedValue("gone");

    const response = await POST(request("test-secret"));
    const body = await response.json();

    expect(body).toMatchObject({ ok: true, due: 1, sent: 0, pruned: 1 });
    expect(deletes).toContainEqual({ table: "push_subscriptions" });
    // No delivery -> no stamp -> the next tick may retry inside the window.
    expect(
      updates.filter((u) => u.table === "profiles")
    ).toHaveLength(0);
  });

  it("zero-shame: a user who already logged today is not due", async () => {
    tableResults.set("profiles", { data: [dueProfile()], error: null });
    tableResults.set("logs", { data: [{ user_id: "user-1" }], error: null });

    const response = await POST(request("test-secret"));
    const body = await response.json();

    expect(body).toMatchObject({ ok: true, checked: 1, due: 0, sent: 0 });
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
