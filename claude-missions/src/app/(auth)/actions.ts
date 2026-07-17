"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  resendConfirmationEmail,
  signInEmailPassword,
  signUpEmailPassword,
} from "@/lib/auth/core";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import { emailSchema, signInSchema, signUpSchema } from "@/lib/auth/validation";

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

export type AuthFormState = { ok: boolean; error_sr?: string } | null;

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

function verifyEmailNoticePath(email: string): string {
  return `/registracija/proveri-email?email=${encodeURIComponent(email)}`;
}

/** AS-008: create an account with email + password. */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
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
  const result = await signUpEmailPassword(
    supabase,
    parsed.data.email,
    parsed.data.password,
    `${await emailRedirectOrigin()}/auth/callback`
  );

  if (!result.ok) {
    return result;
  }

  redirect(verifyEmailNoticePath(parsed.data.email));
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
