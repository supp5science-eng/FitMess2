"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  resendConfirmationEmail,
  sendPasswordResetEmail,
  signInEmailPassword,
  signUpEmailPassword,
  updateProfilePhone,
  updateUserPassword,
  verifySignupOtp,
} from "@/lib/auth/core";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import {
  emailSchema,
  forgotPasswordSchema,
  normalizePhone,
  phoneSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyCodeSchema,
} from "@/lib/auth/validation";

/**
 * F011: thin Server Action wrappers around `@/lib/auth/core`.
 *
 * API contract per the clarified spec ("Redirects for page flows; JSON
 * {ok,error_sr} for actions"): a successful signup/login navigates via
 * `redirect()` (Next.js's `redirect()` throws internally -- there is no
 * normal return on that path); every failure path returns
 * `{ ok: false, error_sr }` for the calling `useActionState` form to render
 * inline, in Serbian, without a page navigation.
 */

export type AuthFormState =
  | { ok: boolean; error_sr?: string; reason?: "already_registered" }
  | null;

/**
 * Derives the current request's own origin from its headers rather than a
 * hardcoded/env-configured URL, so this works unchanged in dev
 * (`http://localhost:3000`, which matches the live Supabase project's
 * `site_url` and the `uri_allow_list` entry this feature added -- see
 * evidence/F011/live-verification.log) and after the eventual Vercel deploy
 * (docs/deploy.md -- not done yet at this feature's build time) without
 * needing a new env var kept in sync across environments.
 */
async function emailRedirectOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/**
 * The "proveri email" notice path. `justSent` is set only when we have just
 * triggered a confirmation email (signup) -- the page uses it to start the
 * resend button on a cooldown, so an immediate re-click can't hit GoTrue's
 * ~60s per-address send window and surface a rate-limit error that reads as
 * "resend is broken". The login-unconfirmed redirect does NOT set it (that
 * path sends no email), so a returning user can resend right away.
 */
function verifyEmailNoticePath(email: string, justSent = false): string {
  const params = new URLSearchParams({ email });
  if (justSent) params.set("poslato", "1");
  return `/registracija/proveri-email?${params.toString()}`;
}

/** AS-008: create an account with email + password. */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    phone: normalizePhone(
      String(formData.get("phone_cc") ?? ""),
      String(formData.get("phone_local") ?? "")
    ),
    // An unchecked box submits nothing at all, so a missing value here is
    // exactly the "no consent given" case -- see `consentSchema`.
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await signUpEmailPassword(
    supabase,
    parsed.data.email,
    parsed.data.password,
    `${await emailRedirectOrigin()}/auth/callback`,
    parsed.data.phone
  );

  if (!result.ok) {
    return {
      ok: false,
      error_sr: result.error_sr,
      reason: result.reason,
    };
  }

  redirect(verifyEmailNoticePath(parsed.data.email, true));
}

/**
 * AS-009 / AS-017: sign in with email + password. Unconfirmed accounts are
 * redirected to the same verification notice signup uses (redirect matrix:
 * "unverified to notice"). Wrong password and unknown email both surface the
 * identical generic Serbian message (AS-017).
 */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await signInEmailPassword(
    supabase,
    parsed.data.email,
    parsed.data.password
  );

  if (!result.ok) {
    if (result.reason === "unconfirmed") {
      redirect(verifyEmailNoticePath(parsed.data.email));
    }
    return { ok: false, error_sr: result.error_sr };
  }

  // Full onboarding/route-protection redirect matrix (not-onboarded ->
  // onboarding) lands with F013/F015; a confirmed user proceeds into the app
  // shell here (AS-018's onboarding gate is a later feature's concern).
  redirect("/danas");
}

/** Where the recovery email drops the user after their token is verified. */
function newPasswordPath(): string {
  return "/nova-lozinka";
}

/**
 * "Zaboravljena lozinka" -- request a password-recovery email (AS-008 sibling
 * flow). Always resolves to the same neutral "check your email" state on
 * success so a stranger can't use this form to learn whether an email has an
 * account (the same non-enumeration rule signup follows). Only non-leaking
 * failures (bad email format, rate limiting) surface a distinct message.
 */
export async function forgotPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await sendPasswordResetEmail(
    supabase,
    parsed.data.email,
    `${await emailRedirectOrigin()}${newPasswordPath()}`
  );

  // On success return `ok: true` -- the form renders the neutral
  // `passwordResetSent` notice, identical whether or not the email existed.
  return result;
}

/**
 * "Nova lozinka" -- set a new password using the recovery session that
 * `/auth/confirm` established from the emailed link. On success the user is
 * already signed in (recovery yields a real session), so we send them straight
 * into the app rather than back to the login form.
 */
export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await updateUserPassword(supabase, parsed.data.password);

  if (!result.ok) {
    return result;
  }

  redirect("/danas");
}

/**
 * Confirms the account with the 6-digit code from the confirmation email,
 * entered inside the app. On success GoTrue issues a session, so we send the
 * user straight into the app (the middleware then routes a verified-but-not-
 * onboarded user on to `/onboarding`) -- all without ever leaving the PWA,
 * which is the whole point of the in-app code over the browser-opening link.
 */
export async function verifyEmailCodeAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = verifyCodeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await verifySignupOtp(
    supabase,
    parsed.data.email,
    parsed.data.code
  );

  if (!result.ok) {
    return result;
  }

  redirect("/danas");
}

/**
 * Saves the phone number for a signed-in user who doesn't have one yet -- the
 * `/telefon` gate that Google OAuth users hit once right after signing in
 * (email/password users already gave a phone on the signup form). On success we
 * send them onward; the middleware then routes a not-yet-onboarded user into
 * onboarding, or a returning user straight into the app.
 */
export async function savePhoneAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = phoneSchema.safeParse(
    normalizePhone(
      String(formData.get("phone_cc") ?? ""),
      String(formData.get("phone_local") ?? "")
    )
  );
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // The route-protection gate only sends authenticated users here, so this
    // is a defensive guard rather than a reachable state.
    return { ok: false, error_sr: SR_AUTH_MESSAGES.generic };
  }

  const result = await updateProfilePhone(supabase, user.id, parsed.data);
  if (!result.ok) {
    return result;
  }

  redirect("/danas");
}

/** The "posalji ponovo" (resend) action on the verification notice page. */
export async function resendAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      ok: false,
      error_sr: parsed.error.issues[0]?.message ?? SR_AUTH_MESSAGES.generic,
    };
  }

  const supabase = await createClient();
  const result = await resendConfirmationEmail(
    supabase,
    parsed.data,
    `${await emailRedirectOrigin()}/auth/callback`
  );

  return result;
}
