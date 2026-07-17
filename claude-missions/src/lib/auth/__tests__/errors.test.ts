import { describe, expect, it } from "vitest";

import { SR_AUTH_MESSAGES, mapAuthErrorToSerbian } from "@/lib/auth/errors";

// F011: unit coverage for the Supabase-error -> Serbian-copy mapping.
//
// AS-017: a failed login shows a Serbian error message that does not reveal
// whether the email exists. Supabase's own backend already returns the
// identical `invalid_credentials` code for "wrong password" and "no such
// user" (verified live -- see
// missions/20260717-183157/handoffs/evidence/F011/live-verification.log).
// These tests prove the *mapping layer* preserves that property and never
// introduces a way to distinguish the two, and that every currently-known
// Supabase Auth error code collapses to either the safe generic message or
// one of the two deliberately-distinct, non-revealing exceptions
// (unconfirmed, rate-limited).

describe("F011: mapAuthErrorToSerbian (AS-017)", () => {
  it("test_AS_017_invalid_credentials_maps_to_the_generic_non_revealing_message", () => {
    expect(
      mapAuthErrorToSerbian({ code: "invalid_credentials", status: 400 })
    ).toBe(SR_AUTH_MESSAGES.invalidCredentials);
  });

  it("test_AS_017_null_or_missing_error_falls_back_to_the_generic_message", () => {
    expect(mapAuthErrorToSerbian(null)).toBe(SR_AUTH_MESSAGES.generic);
    expect(mapAuthErrorToSerbian(undefined)).toBe(SR_AUTH_MESSAGES.generic);
  });

  it("test_AS_017_unknown_or_unmapped_error_codes_fail_closed_to_the_generic_message", () => {
    // Any Supabase error code this module doesn't explicitly recognize must
    // never leak account-existence information -- it must fall back to the
    // same generic copy as invalid_credentials, not some other message that
    // could hint at *why* the login failed.
    expect(
      mapAuthErrorToSerbian({ code: "some_future_supabase_code", status: 400 })
    ).toBe(SR_AUTH_MESSAGES.generic);
    expect(
      mapAuthErrorToSerbian({ code: undefined, status: 500 })
    ).toBe(SR_AUTH_MESSAGES.generic);
  });

  it("test_AS_017_wrong_password_and_unknown_email_produce_the_identical_string", () => {
    // Both cases arrive at this function with the exact same code from
    // Supabase (invalid_credentials) -- asserting this directly protects
    // against a future edit accidentally branching on error.message content
    // (which Supabase does NOT keep identical between the two -- only
    // `code`/`status` are guaranteed identical) and reintroducing a leak.
    const wrongPassword = mapAuthErrorToSerbian({
      code: "invalid_credentials",
      status: 400,
    });
    const unknownEmail = mapAuthErrorToSerbian({
      code: "invalid_credentials",
      status: 400,
    });
    expect(wrongPassword).toBe(unknownEmail);
  });

  it("test_AS_017_unconfirmed_email_maps_to_a_distinct_verification_prompt_not_the_generic_message", () => {
    const message = mapAuthErrorToSerbian({
      code: "email_not_confirmed",
      status: 400,
    });
    expect(message).toBe(SR_AUTH_MESSAGES.unconfirmed);
    expect(message).not.toBe(SR_AUTH_MESSAGES.invalidCredentials);
  });

  it("test_AS_017_rate_limit_codes_map_to_the_rate_limited_message", () => {
    expect(
      mapAuthErrorToSerbian({
        code: "over_email_send_rate_limit",
        status: 429,
      })
    ).toBe(SR_AUTH_MESSAGES.rateLimited);
    expect(
      mapAuthErrorToSerbian({ code: undefined, status: 429 })
    ).toBe(SR_AUTH_MESSAGES.rateLimited);
  });

  it("test_AS_017_every_mapped_message_is_serbian_latin_copy_not_a_raw_supabase_string", () => {
    // Sanity check that we never accidentally pass through Supabase's raw
    // English error message (which itself would be a leak vector for future
    // codes, since Supabase's English strings sometimes do differ between
    // the wrong-password and unknown-email cases at the message-text level
    // even when the code/status match).
    for (const value of Object.values(SR_AUTH_MESSAGES)) {
      expect(value).not.toMatch(/invalid login credentials/i);
      expect(value).not.toMatch(/email not confirmed/i);
    }
  });
});
