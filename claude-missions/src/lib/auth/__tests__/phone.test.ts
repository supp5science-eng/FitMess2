import { describe, expect, it } from "vitest";

import {
  normalizePhone,
  phoneSchema,
  signUpSchema,
} from "@/lib/auth/validation";

/**
 * Unit coverage for the mandatory signup phone field: the dial-code + local
 * recombination (`normalizePhone`), the E.164 shape check (`phoneSchema`), and
 * that `signUpSchema` now requires a phone. Phone is stored for cold-calling
 * only -- never used for verification.
 */

describe("normalizePhone", () => {
  it("drops the national trunk 0 and spaces, keeping the dial code", () => {
    expect(normalizePhone("+381", "060 063 7486")).toBe("+381600637486");
  });

  it("leaves an already-trunkless local part unchanged", () => {
    expect(normalizePhone("+381", "600637486")).toBe("+381600637486");
  });

  it("works for other dial codes", () => {
    expect(normalizePhone("+49", "171 2345678")).toBe("+491712345678");
  });

  it("strips stray non-digit characters from the local part", () => {
    expect(normalizePhone("+381", "(60) 123-4567")).toBe("+381601234567");
  });
});

describe("phoneSchema", () => {
  it("accepts a well-formed E.164 number", () => {
    expect(phoneSchema.safeParse("+381600637486").success).toBe(true);
  });

  it("rejects a number without the leading +", () => {
    expect(phoneSchema.safeParse("381600637486").success).toBe(false);
  });

  it("rejects a number that is too short", () => {
    expect(phoneSchema.safeParse("+3816").success).toBe(false);
  });

  it("rejects a leading-zero country code", () => {
    expect(phoneSchema.safeParse("+0600637486").success).toBe(false);
  });
});

describe("signUpSchema now requires a phone", () => {
  it("accepts email + password + a valid phone", () => {
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
      phone: "+381600637486",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a signup missing the phone", () => {
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
    });
    expect(parsed.success).toBe(false);
  });
});
