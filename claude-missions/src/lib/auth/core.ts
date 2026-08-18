import type { SupabaseClient, User } from "@supabase/supabase-js";

import { SR_AUTH_MESSAGES, mapAuthErrorToSerbian } from "@/lib/auth/errors";

/**
 * F011: core email/password auth operations, deliberately written as plain
 * functions that take an already-constructed `SupabaseClient` rather than
 * constructing one themselves.
 *
 * Why: the real caller is a Next.js Server Action, which must build its
 * client via `@/lib/supabase/server`'s `createClient()` (cookie-bound, only
 * callable inside a request). That makes it awkward to exercise from a
 * Vitest suite. Every function here instead accepts any client whose `.auth`
 * surface matches `SupabaseClient` -- the Server Action wrapper passes the
 * cookie-bound client, and tests pass a plain `@supabase/supabase-js` client
 * signed in against the real project (the same pattern
 * `src/lib/supabase/__tests__/profiles-rls.integration.test.ts` uses for
 * F010's RLS proof). No business logic lives in the Server Action files
 * themselves -- they are thin `"use server"` wrappers around these
 * functions plus `redirect()`.
 */

export type AuthActionResult =
  | { ok: true }
  | {
      ok: false;
      error_sr: string;
      /** Set only on the signup path when the email already has an account, so
       * the form can offer a "Prijavi se" shortcut alongside the message. */
      reason?: "already_registered";
    };

export type SignInResult =
  | { ok: true }
  | {
      ok: false;
      error_sr: string;
      /** Distinguishes "needs email confirmation" from any other failure so
       * the caller can redirect to the verification notice (AS-009) instead
       * of just showing an inline error. Never used to change the *message*
       * shown for wrong-password/unknown-email (AS-017 stays generic either
       * way) -- only to decide *where* to send the user next. */
      reason: "unconfirmed" | "other";
    };

/**
 * F012 / AS-010: the single source of truth for "has this identity's email
 * been verified" -- keys on Supabase's own `email_confirmed_at` timestamp,
 * never on `app_metadata.provider`.
 *
 * This matters because a Google-authenticated identity is already verified
 * by Google's own consent flow, and GoTrue reflects that by setting
 * `email_confirmed_at` on the `auth.users` row at account-creation time for
 * an OAuth identity -- it is never left null the way it is for a
 * freshly-`signUp()`'d email/password account awaiting a clicked
 * confirmation link. Any confirmation gate (this file's defensive check
 * below today; a future route-protection middleware, F013) must check this
 * field and never branch on which provider produced the identity, or it
 * would incorrectly block a pre-verified Google user. Verified empirically
 * against the live project for both cases -- see
 * evidence/F012/live-verification.log.
 */
export function isEmailVerified(
  user: Pick<User, "email_confirmed_at"> | null | undefined
): boolean {
  return Boolean(user?.email_confirmed_at);
}

/**
 * Signs a new user up with email + password (AS-008).
 *
 * PRODUCT DECISION (per user, 2026-07): the signup form now DOES tell the
 * visitor when the email already has an account, instead of the previous
 * anti-enumeration silence. That silence made a very confusing experience --
 * a returning user re-registers, GoTrue sends no new email (the account
 * exists), and the app just says "check your email" for a mail that never
 * comes. So here we detect the "already registered" case two ways and surface
 * it as an actionable error (`reason: "already_registered"`):
 *   1. `error.code === "user_already_exists"` (the explicit signal), and
 *   2. the anti-enumeration success shape, where GoTrue returns no error but
 *      `data.user.identities` is an EMPTY array (a real new signup always has
 *      exactly one identity). This covers projects/versions that obfuscate the
 *      duplicate instead of erroring.
 * Login and forgot-password keep their non-enumeration behavior -- only the
 * signup form leaks existence, which is the flow the confusion lived in.
 */
export async function signUpEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
  emailRedirectTo: string,
  phone?: string
): Promise<AuthActionResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      // Stash the phone in user_metadata so the `handle_new_auth_user` trigger
      // (migration 0009) can copy it onto profiles.phone atomically at signup.
      // Not used for verification -- carried purely for later cold-calling.
      data: phone ? { phone } : undefined,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return {
        ok: false,
        error_sr: SR_AUTH_MESSAGES.emailAlreadyRegistered,
        reason: "already_registered",
      };
    }
    return { ok: false, error_sr: mapAuthErrorToSerbian(error) };
  }

  // Anti-enumeration success shape: an existing email comes back with no error
  // but zero identities (a genuine new account always has exactly one).
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      ok: false,
      error_sr: SR_AUTH_MESSAGES.emailAlreadyRegistered,
      reason: "already_registered",
    };
  }

  return { ok: true };
}

/**
 * Signs a user in with email + password (AS-009 gate, AS-017 error mapping).
 *
 * Supabase's GoTrue backend refuses to issue a session at all for an
 * unconfirmed user -- verified empirically against the live project (see
 * evidence/F011/live-verification.log): `signInWithPassword` for a correct-
 * password-but-unconfirmed account returns `error.code ===
 * 'email_not_confirmed'` with no session and no user in the response. That
 * means there is nothing for this function to "undo" -- the unverified user
 * never gets a cookie in the first place, so no protected data is ever
 * reachable through this path (the actual enforcement of AS-009 for this
 * feature, ahead of F013's full route-protection middleware).
 */
export async function signInEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        error_sr: SR_AUTH_MESSAGES.unconfirmed,
        reason: "unconfirmed",
      };
    }
    return { ok: false, error_sr: mapAuthErrorToSerbian(error), reason: "other" };
  }

  // Defensive belt-and-suspenders: even though Supabase did not error, never
  // trust a session for an account whose email isn't confirmed yet. If a
  // session somehow came back for an unconfirmed user, drop it immediately
  // rather than letting it reach the app. Uses the shared `isEmailVerified`
  // gate (AS-010) so this check is provably the same one a Google-OAuth
  // identity would pass.
  if (data.user && !isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error_sr: SR_AUTH_MESSAGES.unconfirmed,
      reason: "unconfirmed",
    };
  }

  return { ok: true };
}

/** Resends the signup confirmation email (the "posalji ponovo" action). */
export async function resendConfirmationEmail(
  supabase: SupabaseClient,
  email: string,
  emailRedirectTo: string
): Promise<AuthActionResult> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    return { ok: false, error_sr: mapAuthErrorToSerbian(error) };
  }

  return { ok: true };
}

/**
 * Confirms a signup with the 6-digit code from the confirmation email
 * (`type: "signup"` OTP). This is the in-app path: the user types the code
 * inside the installed PWA instead of clicking the email link, which on iOS
 * would open Safari/Chrome and drop them out of the app. On success GoTrue
 * returns a real session, so the cookie-bound server client writes the auth
 * cookies and the user is signed in exactly as if they'd clicked the link.
 *
 * Almost every failure here is "wrong or expired code" -- collapse the unknown
 * `generic` fallback to a clear, actionable Serbian message while preserving
 * the specific rate-limit / invalid-email copy.
 */
export async function verifySignupOtp(
  supabase: SupabaseClient,
  email: string,
  token: string
): Promise<AuthActionResult> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    const mapped = mapAuthErrorToSerbian(error);
    return {
      ok: false,
      error_sr:
        mapped === SR_AUTH_MESSAGES.generic
          ? SR_AUTH_MESSAGES.invalidCode
          : mapped,
    };
  }

  return { ok: true };
}

/**
 * Writes the phone number onto the current user's own profile row. Used by the
 * `/telefon` capture page that Google OAuth users pass through once (they never
 * saw the signup form's phone field). RLS (`profiles_update_own`) already
 * restricts the update to the caller's own row; passing `userId` keeps the
 * `where` explicit and unit-testable. Phone is stored for cold-calling only.
 */
export async function updateProfilePhone(
  supabase: SupabaseClient,
  userId: string,
  /** `null` CLEARS the number. The phone is optional (guideline 5.1.1(v)), and
   * a field a user may leave blank is one they must also be able to empty
   * again — see `@/lib/auth/phone-prompt`. */
  phone: string | null
): Promise<AuthActionResult> {
  const { error } = await supabase
    .from("profiles")
    .update({ phone })
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error_sr: SR_AUTH_MESSAGES.generic };
  }

  return { ok: true };
}

/**
 * Sends a password-recovery email (the "zaboravljena lozinka" flow).
 *
 * Supabase's `resetPasswordForEmail` is non-enumerating by design: it returns
 * success and sends nothing for an email that has no account, so the two cases
 * are indistinguishable to the caller -- exactly the "never reveal whether an
 * email exists" rule the signup path also follows. The only errors that come
 * back here are non-leaking ones (rate limiting, malformed email), which
 * `mapAuthErrorToSerbian` already collapses to safe generic copy.
 *
 * The recovery email itself must point at `/auth/confirm?type=recovery` (the
 * stateless `token_hash` + `verifyOtp` path) so it works cross-device the same
 * way the signup confirmation link does -- see the "Reset Password" email
 * template configured on the live project. `redirectTo` is where the user
 * lands *after* the token is verified: the set-new-password page.
 */
export async function sendPasswordResetEmail(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string
): Promise<AuthActionResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { ok: false, error_sr: mapAuthErrorToSerbian(error) };
  }

  return { ok: true };
}

/**
 * Sets a new password for the currently-authenticated user (the final step of
 * the recovery flow). The caller must already hold the recovery session that
 * `/auth/confirm`'s `verifyOtp({ type: "recovery" })` established -- without a
 * session Supabase returns an auth error, which surfaces here as a prompt to
 * request a fresh recovery link rather than a silent no-op.
 */
export async function updateUserPassword(
  supabase: SupabaseClient,
  password: string
): Promise<AuthActionResult> {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { ok: false, error_sr: mapAuthErrorToSerbian(error) };
  }

  return { ok: true };
}
