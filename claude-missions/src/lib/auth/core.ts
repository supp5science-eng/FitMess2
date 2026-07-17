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
  | { ok: false; error_sr: string };

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
 * Deliberately treats "no error" as success even when Supabase's anti-
 * enumeration behavior means the account already existed (in which case
 * `data.user.identities` comes back empty and no new confirmation email is
 * sent) -- the caller must not be able to tell the two cases apart, per the
 * clarified spec's "never reveal whether an email exists" failure-handling
 * rule, which this feature applies to signup as well as login.
 */
export async function signUpEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
  emailRedirectTo: string
): Promise<AuthActionResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    // `user_already_exists` is Supabase's older/alternate signal for the
    // same "account already registered" case the empty-identities response
    // also covers -- fold it into the same non-revealing success-shaped
    // message rather than surfacing an error that would confirm the email
    // is taken.
    if (error.code === "user_already_exists") {
      return { ok: true };
    }
    return { ok: false, error_sr: mapAuthErrorToSerbian(error) };
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
