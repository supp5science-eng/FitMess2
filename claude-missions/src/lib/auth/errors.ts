import type { AuthError } from "@supabase/supabase-js";

/**
 * F011: Serbian (sr-Latn, "ti" form) copy for every auth-flow message, plus
 * the mapping from Supabase Auth errors to that copy.
 *
 * Central rule (AS-017 + clarified "Failure handling"): a failed login must
 * never reveal whether an email address has an account. Supabase's own
 * GoTrue backend already returns the identical `invalid_credentials` error
 * (400) for "wrong password" and "no such user" -- verified empirically
 * against the live project during this feature's build (see
 * missions/20260717-183157/handoffs/evidence/F011/live-verification.log).
 * This module preserves that non-enumeration property: every code that is
 * NOT specifically actionable-without-leaking-existence (format errors, rate
 * limiting, the deliberately-distinct "unconfirmed" case) collapses to the
 * same generic message.
 */

export const SR_AUTH_MESSAGES = {
  /** Wrong password OR unknown email -- Supabase already returns the same
   * error for both, so this string must never change based on which one it
   * actually was (AS-017). */
  invalidCredentials: "Pogrešan email ili lozinka.",
  /** Correct credentials, but the account has not clicked the confirmation
   * link yet (AS-009). Distinct from invalidCredentials -- this is only ever
   * reachable by someone who already knows the correct password, so surfacing
   * it does not leak account existence to a third party. */
  unconfirmed:
    "Nalog nije potvrđen. Proveri email i klikni na link za potvrdu naloga.",
  /** Sign-up with an email that already has an account. PRODUCT DECISION
   * (per user): the signup form DELIBERATELY reveals existence here, so people
   * stop retrying a registration that (by anti-enumeration) silently sends no
   * email and just looks broken. This trades the non-enumeration property on
   * the *signup* form only -- login and forgot-password stay generic. */
  emailAlreadyRegistered:
    "Već postoji nalog sa ovom email adresom. Prijavi se, a ako još nisi potvrdio/la nalog, proveri email za kod.",
  /** Sign-up (and resend) success -- deliberately identical whether the email
   * was brand-new or already registered, so signup cannot be used to probe
   * account existence either. */
  checkYourEmail:
    "Proveri email! Poslali smo ti link za potvrdu naloga na email adresu koju si uneo/la.",
  /** Shown after a "forgot password" request -- deliberately identical whether
   * the email has an account or not, so this flow can't be used to probe
   * account existence either (same non-enumeration rule as signup). */
  passwordResetSent:
    "Ako postoji nalog sa tom email adresom, poslali smo link za promenu lozinke. Proveri email.",
  /** The recovery link expired or was already used, so no valid recovery
   * session is active on the set-new-password page. */
  passwordResetLinkInvalid:
    "Link za promenu lozinke je istekao ili je već iskorišćen. Zatraži novi.",
  /** The 6-digit signup confirmation code the user typed is wrong or expired
   * (the in-app OTP path, so a returning user never has to leave the app). */
  invalidCode: "Kod nije ispravan ili je istekao. Zatraži novi kod ispod.",
  weakPassword: "Lozinka je preslaba. Koristi bar 8 karaktera.",
  invalidEmail: "Unesi ispravnu email adresu.",
  rateLimited: "Previše pokušaja u kratkom periodu. Sačekaj malo pa pokušaj ponovo.",
  signupDisabled: "Registracija trenutno nije moguća. Pokušaj kasnije.",
  generic: "Došlo je do greške. Pokušaj ponovo.",
} as const;

export type SrAuthMessage =
  (typeof SR_AUTH_MESSAGES)[keyof typeof SR_AUTH_MESSAGES];

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);

/**
 * Maps a Supabase `AuthError` (or any thrown value) to safe Serbian copy.
 * Never branches on `error.message` content in a way that would distinguish
 * "no such user" from "wrong password" -- only on `error.code`/`error.status`
 * values that Supabase itself already treats as safe to disclose.
 */
export function mapAuthErrorToSerbian(
  error: Pick<AuthError, "code" | "status"> | null | undefined
): string {
  if (!error) return SR_AUTH_MESSAGES.generic;

  switch (error.code) {
    case "invalid_credentials":
      return SR_AUTH_MESSAGES.invalidCredentials;
    case "email_not_confirmed":
      return SR_AUTH_MESSAGES.unconfirmed;
    case "weak_password":
      return SR_AUTH_MESSAGES.weakPassword;
    case "email_address_invalid":
    case "validation_failed":
      return SR_AUTH_MESSAGES.invalidEmail;
    case "signup_disabled":
    case "email_provider_disabled":
      return SR_AUTH_MESSAGES.signupDisabled;
    default:
      if (error.code && RATE_LIMIT_CODES.has(error.code)) {
        return SR_AUTH_MESSAGES.rateLimited;
      }
      if (error.status === 429) {
        return SR_AUTH_MESSAGES.rateLimited;
      }
      // Any other/unknown code (including anything that could hint at
      // account existence) falls back to the generic message -- fail closed,
      // never fail open on a new/unmapped Supabase error code.
      return SR_AUTH_MESSAGES.generic;
  }
}
