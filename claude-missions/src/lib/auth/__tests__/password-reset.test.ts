import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  sendPasswordResetEmail,
  updateUserPassword,
} from "@/lib/auth/core";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/auth/validation";

/**
 * Unit coverage for the "zaboravljena lozinka" (password-recovery) flow: the
 * two `@/lib/auth/core` operations and the two zod schemas that back the
 * forgot/set-new-password forms. Framework-free -- the Supabase client is a
 * hand-rolled stub whose `.auth` surface matches what each function calls, the
 * same pattern the rest of `core` is designed for (plain functions taking an
 * already-built client), so no live project is needed here.
 */

function stubClient(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("sendPasswordResetEmail", () => {
  it("returns ok on success and forwards the redirect target to Supabase", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const client = stubClient({ resetPasswordForEmail });

    const result = await sendPasswordResetEmail(
      client,
      "korisnik@example.com",
      "https://fitmess.app/nova-lozinka"
    );

    expect(result).toEqual({ ok: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("korisnik@example.com", {
      redirectTo: "https://fitmess.app/nova-lozinka",
    });
  });

  it("maps a rate-limit error to the safe Serbian rate-limited message", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    const client = stubClient({ resetPasswordForEmail });

    const result = await sendPasswordResetEmail(client, "a@b.com", "https://x/y");

    expect(result).toEqual({
      ok: false,
      error_sr: SR_AUTH_MESSAGES.rateLimited,
    });
  });
});

describe("updateUserPassword", () => {
  it("returns ok when the recovery session lets the password update succeed", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = stubClient({ updateUser });

    const result = await updateUserPassword(client, "novaLozinka123");

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "novaLozinka123" });
  });

  it("surfaces a Serbian error when there is no valid session to update", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      error: { code: "session_not_found", status: 401 },
    });
    const client = stubClient({ updateUser });

    const result = await updateUserPassword(client, "novaLozinka123");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Unknown/unmapped code fails closed to the generic message.
      expect(result.error_sr).toBe(SR_AUTH_MESSAGES.generic);
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email and trims it", () => {
    const parsed = forgotPasswordSchema.safeParse({ email: "  a@b.com " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("a@b.com");
  });

  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nije-email" }).success).toBe(
      false
    );
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const parsed = resetPasswordSchema.safeParse({
      password: "lozinka12",
      confirmPassword: "lozinka12",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const parsed = resetPasswordSchema.safeParse({
      password: "kratko",
      confirmPassword: "kratko",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when the confirmation does not match", () => {
    const parsed = resetPasswordSchema.safeParse({
      password: "lozinka12",
      confirmPassword: "lozinka99",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Lozinke se ne poklapaju.");
    }
  });
});
