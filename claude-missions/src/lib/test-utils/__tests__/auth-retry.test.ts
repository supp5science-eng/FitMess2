import { describe, expect, it, vi } from "vitest";

import { isAuthRateLimitError, withAuthRetry } from "../auth-retry";

// F019a: unit coverage for the shared retry-with-backoff helper that wraps
// live-integration tests' Supabase Auth calls (signInWithPassword,
// admin.createUser, admin.deleteUser) -- unblocks AS-004 (`npm run test`
// passes reliably) project-wide by making the ~15+ live-integration test
// files resilient to Supabase's transient Auth rate limit instead of
// cascading into failures. Uses tiny `baseDelayMs`/`maxDelayMs` options so
// this test itself stays fast (no real network, no real Supabase call --
// `operation` is a plain mock).

function rateLimitError(overrides: Partial<{ status: number; code: string; message: string }> = {}) {
  return { status: 429, code: "over_request_rate_limit", message: "Request rate limit reached", ...overrides };
}

describe("isAuthRateLimitError: distinguishes transient rate limits from real failures", () => {
  it("test_AS_004_returns_true_for_a_429_status", () => {
    expect(isAuthRateLimitError({ status: 429 })).toBe(true);
  });

  it("test_AS_004_returns_true_for_the_over_request_rate_limit_code", () => {
    expect(isAuthRateLimitError({ code: "over_request_rate_limit" })).toBe(true);
  });

  it("test_AS_004_returns_true_for_a_rate_limit_message_regardless_of_case", () => {
    expect(isAuthRateLimitError({ message: "Request Rate Limit Reached" })).toBe(true);
    expect(isAuthRateLimitError({ message: "too many requests, slow down" })).toBe(true);
  });

  it("test_AS_004_returns_false_for_null_or_undefined", () => {
    expect(isAuthRateLimitError(null)).toBe(false);
    expect(isAuthRateLimitError(undefined)).toBe(false);
  });

  it("test_AS_004_returns_false_for_an_unrelated_real_failure_like_invalid_credentials", () => {
    expect(
      isAuthRateLimitError({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" })
    ).toBe(false);
  });
});

describe("withAuthRetry: retries only on rate-limit-shaped errors, bounded and non-infinite", () => {
  it("test_AS_004_succeeds_immediately_without_retrying_when_the_first_attempt_has_no_error", async () => {
    const operation = vi.fn().mockResolvedValue({ error: null, data: { ok: true } });

    const result = await withAuthRetry(operation, { baseDelayMs: 1, maxDelayMs: 2 });

    expect(result).toEqual({ error: null, data: { ok: true } });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("test_AS_004_retries_after_a_transient_rate_limit_and_returns_the_eventual_success", async () => {
    const operation = vi
      .fn()
      .mockResolvedValueOnce({ error: rateLimitError() })
      .mockResolvedValueOnce({ error: rateLimitError() })
      .mockResolvedValueOnce({ error: null, data: { ok: true } });

    const result = await withAuthRetry(operation, { baseDelayMs: 1, maxDelayMs: 2, maxAttempts: 5 });

    expect(result).toEqual({ error: null, data: { ok: true } });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("test_AS_004_does_not_retry_a_non_rate_limit_error_returns_immediately_on_the_first_attempt", async () => {
    const notRateLimited = { status: 400, code: "invalid_credentials", message: "Invalid login credentials" };
    const operation = vi.fn().mockResolvedValue({ error: notRateLimited });

    const result = await withAuthRetry(operation, { baseDelayMs: 1, maxDelayMs: 2, maxAttempts: 5 });

    expect(result).toEqual({ error: notRateLimited });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("test_AS_004_gives_up_after_maxAttempts_and_returns_the_last_rate_limit_error_never_hanging_forever", async () => {
    const operation = vi.fn().mockResolvedValue({ error: rateLimitError() });

    const result = await withAuthRetry(operation, { baseDelayMs: 1, maxDelayMs: 2, maxAttempts: 3 });

    expect(result.error).toEqual(rateLimitError());
    // Exactly maxAttempts calls -- proves the cap is a hard cap, not
    // best-effort, and that this never becomes an infinite sleep loop.
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("test_AS_004_respects_maxDelayMs_as_a_hard_cap_never_sleeping_longer_than_it_even_after_many_attempts", async () => {
    const operation = vi.fn().mockResolvedValue({ error: rateLimitError() });
    const sleepSpy = vi.spyOn(globalThis, "setTimeout");

    await withAuthRetry(operation, { baseDelayMs: 1000, maxDelayMs: 5, maxAttempts: 4 });

    const delaysUsed = sleepSpy.mock.calls.map((call) => call[1] as number);
    for (const delay of delaysUsed) {
      expect(delay).toBeLessThanOrEqual(5);
    }
    sleepSpy.mockRestore();
  });
});
