import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { updateProfilePhone } from "@/lib/auth/core";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import {
  normalizePhone,
  phoneSchema,
  signUpSchema,
} from "@/lib/auth/validation";

/**
 * Unit coverage for the OPTIONAL phone field: the dial-code + local
 * recombination (`normalizePhone`), the E.164 shape check (`phoneSchema`), and
 * that `signUpSchema` accepts a signup with no number at all. The phone is
 * stored so we can reach a user who wants to be reached -- never used for
 * verification, and never required (App Store guideline 5.1.1(v); see
 * `@/lib/auth/phone-prompt`).
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

  it("returns null for an untouched optional field, not the bare dial code", () => {
    // The trap this guards: "+381" on its own is not a phone number, and
    // returning it would fail `phoneSchema` on a field the user was told they
    // could leave blank.
    expect(normalizePhone("+381", "")).toBeNull();
  });

  it("returns null when the local part holds no digits at all", () => {
    expect(normalizePhone("+381", "   ")).toBeNull();
    expect(normalizePhone("+381", "(-)")).toBeNull();
    // A lone trunk zero is stripped and leaves nothing behind.
    expect(normalizePhone("+381", "0")).toBeNull();
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

describe("signUpSchema treats the phone as optional", () => {
  it("accepts email + password + a valid phone", () => {
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
      phone: "+381600637486",
      // The GDPR art. 9 consent tick, added alongside the phone field.
      consent: "on",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a signup with no phone number at all", () => {
    // The whole point of the 5.1.1(v) fix: a blank field is a complete signup,
    // not a validation error.
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
      phone: null,
      consent: "on",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBeNull();
  });

  it("still rejects a number that was typed but typed wrong", () => {
    // Optional is not the same as unvalidated -- a half-typed number must not
    // be stored as if it were reachable.
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
      phone: "+3816",
      consent: "on",
    });
    expect(parsed.success).toBe(false);
  });

  it("still rejects a signup whose form never posted the field", () => {
    // `null` means "left blank"; a MISSING key means the form is not the form
    // we think it is, which is worth failing loudly.
    const parsed = signUpSchema.safeParse({
      email: "a@b.com",
      password: "lozinka12",
      consent: "on",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("updateProfilePhone", () => {
  function stubDbClient(result: { error: unknown }) {
    const eq = vi.fn().mockResolvedValue(result);
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    return { client: { from } as unknown as SupabaseClient, from, update, eq };
  }

  it("updates the caller's own profile row and returns ok", async () => {
    const { client, from, update, eq } = stubDbClient({ error: null });

    const result = await updateProfilePhone(client, "user-123", "+381600637486");

    expect(result).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ phone: "+381600637486" });
    expect(eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("returns a Serbian error when the update fails", async () => {
    const { client } = stubDbClient({ error: { message: "nope" } });

    const result = await updateProfilePhone(client, "user-123", "+381600637486");

    expect(result).toEqual({ ok: false, error_sr: SR_AUTH_MESSAGES.generic });
  });
});

/**
 * The consent tick is the legal basis for every body/food figure the app then
 * stores (GDPR art. 9). It has to fail closed: an unticked box submits no
 * value at all, and that must be refused server-side, not just hidden behind
 * `required` in the browser.
 */
describe("signUpSchema requires explicit consent", () => {
  const valid = {
    email: "a@b.com",
    password: "lozinka12",
    phone: "+381600637486",
  };

  it("rejects a signup with the box left unticked", () => {
    // An unchecked checkbox is absent from the form data entirely.
    expect(signUpSchema.safeParse(valid).success).toBe(false);
  });

  it("rejects a forged value that is not the browser's own", () => {
    expect(signUpSchema.safeParse({ ...valid, consent: "false" }).success).toBe(
      false
    );
    expect(signUpSchema.safeParse({ ...valid, consent: "" }).success).toBe(false);
  });

  it("explains in Serbian what to do about it", () => {
    const parsed = signUpSchema.safeParse(valid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message).join(" ")).toMatch(
        /uslove i politiku privatnosti/i
      );
    }
  });
});
