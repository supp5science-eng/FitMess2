import { describe, expect, it, vi, beforeEach } from "vitest";

import { PHONE_PROMPT_COOKIE } from "@/lib/auth/phone-prompt";

// The "Preskoči" on `/telefon`. It is the one control on that screen App Store
// guideline 5.1.1(v) requires to work, and the version before this one silently
// did not on a device — so it gets its own test rather than relying on the
// page test to notice it went missing.

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

import { GET } from "../route";

beforeEach(() => {
  getUserMock.mockReset();
});

function request() {
  return new Request("https://fitmess.app/telefon/preskoci");
}

describe("GET /telefon/preskoci", () => {
  it("clears the phone ask for good and sends the user into the app", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://fitmess.app/danas");

    // Bound to the user id, not "1": two accounts on one phone must not share
    // one answer (see `@/lib/auth/phone-prompt`).
    const cookie = response.cookies.get(PHONE_PROMPT_COOKIE);
    expect(cookie?.value).toBe("user-1");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    // Long-lived: the ask is answered once per device, not once per session.
    expect(cookie?.maxAge).toBeGreaterThan(60 * 60 * 24 * 100);
  });

  it("sends a visitor with no session to the login page, not into a redirect loop", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const response = await GET(request());

    expect(response.headers.get("location")).toBe("https://fitmess.app/prijava");
    expect(response.cookies.get(PHONE_PROMPT_COOKIE)).toBeUndefined();
  });
});
