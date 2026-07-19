import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { verifySignupOtp } from "@/lib/auth/core";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import { verifyCodeSchema } from "@/lib/auth/validation";

/**
 * Unit coverage for the in-app signup-confirmation code flow: the 6-digit OTP
 * that lets a user finish signing up without leaving the installed PWA (on iOS
 * the email link would open Safari/Chrome and drop them out of the app). The
 * Supabase client is a hand-rolled stub whose `.auth.verifyOtp` matches what
 * `verifySignupOtp` calls, so no live project is needed.
 */

function stubClient(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("verifyCodeSchema", () => {
  it("accepts an email plus exactly six digits", () => {
    const parsed = verifyCodeSchema.safeParse({
      email: "a@b.com",
      code: "482193",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a code that is not six digits", () => {
    expect(
      verifyCodeSchema.safeParse({ email: "a@b.com", code: "1234" }).success
    ).toBe(false);
    expect(
      verifyCodeSchema.safeParse({ email: "a@b.com", code: "12345678" }).success
    ).toBe(false);
  });

  it("rejects a code containing non-digits", () => {
    expect(
      verifyCodeSchema.safeParse({ email: "a@b.com", code: "12a45b" }).success
    ).toBe(false);
  });
});

describe("verifySignupOtp", () => {
  it("returns ok and calls verifyOtp with the signup type", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const client = stubClient({ verifyOtp });

    const result = await verifySignupOtp(client, "a@b.com", "482193");

    expect(result).toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "a@b.com",
      token: "482193",
      type: "signup",
    });
  });

  it("maps a wrong/expired code (otp_expired) to the clear invalid-code message", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      error: { code: "otp_expired", status: 403 },
    });
    const client = stubClient({ verifyOtp });

    const result = await verifySignupOtp(client, "a@b.com", "000000");

    expect(result).toEqual({
      ok: false,
      error_sr: SR_AUTH_MESSAGES.invalidCode,
    });
  });

  it("preserves the rate-limit message instead of collapsing it to invalidCode", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      error: { code: "over_request_rate_limit", status: 429 },
    });
    const client = stubClient({ verifyOtp });

    const result = await verifySignupOtp(client, "a@b.com", "482193");

    expect(result).toEqual({
      ok: false,
      error_sr: SR_AUTH_MESSAGES.rateLimited,
    });
  });
});
