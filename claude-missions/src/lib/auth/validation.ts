import { z } from "zod";

/**
 * F011: shared email + password validation for the signup/login forms.
 *
 * Password minimum is 8 chars -- stricter than the live Supabase project's
 * own `password_min_length: 6` (verified via the Management API during this
 * feature's build; see evidence/F011/live-verification.log), which is fine:
 * a stricter client/server-side floor never conflicts with a looser
 * downstream floor, it just rejects a few more passwords Supabase itself
 * would technically accept. No character-class requirement is configured on
 * the project (`password_required_characters: null`), so none is enforced
 * here either.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Unesi email adresu.")
  .email("Unesi ispravnu email adresu.");

export const passwordSchema = z
  .string()
  .min(8, "Lozinka mora imati bar 8 karaktera.");

/**
 * Phone number in E.164 form (`+` then 7-15 digits). OPTIONAL everywhere it is
 * asked for -- NOT used for any verification, just stored on the profile so we
 * can reach a user who wants to be reached.
 *
 * It used to be mandatory. App Store guideline 5.1.1(v) does not allow that:
 * an app may not require personal information that isn't directly relevant to
 * its core functionality, and counting calories needs no phone number. See the
 * header of `@/lib/auth/phone-prompt` for the full reasoning, including why it
 * could not survive alongside Sign in with Apple's Hide My Email.
 *
 * This schema still validates the FORMAT of a number that was actually typed;
 * "no number at all" is expressed by `normalizePhone` returning `null`, never
 * by loosening the regex.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Unesi ispravan broj telefona.");

/**
 * Recombine the dial-code picker value (e.g. "+381") with the locally-typed
 * part into an E.164 string. Strips everything but digits from the local part
 * and drops the national trunk "0" (so "060 063 7486" under +381 becomes
 * "+381600637486"), matching how the number is actually dialed internationally.
 *
 * Returns `null` when the local part holds no digits at all -- an untouched
 * (or cleared) optional field. Without this, an empty field under the default
 * dial code would normalize to the bare `"+381"`, which is not a phone number
 * and would fail validation on a form the user was told they could leave
 * blank.
 */
export function normalizePhone(dialCode: string, local: string): string | null {
  const localDigits = local.replace(/\D/g, "").replace(/^0+/, "");
  if (!localDigits) return null;
  return `${dialCode}${localDigits}`;
}

/**
 * The consent tick on the signup form.
 *
 * Not a formality. What FitMess stores about a user — weight, what they eat, a
 * goal of losing or gaining — is health data, a special category under GDPR
 * art. 9 and the Serbian ZZPL. The only legal basis available to us for it is
 * *explicit* consent, and explicit means a deliberate act: a box the person
 * ticks, never a pre-ticked box and never "by continuing you agree".
 *
 * So this is required, unchecked by default, and validated server-side as well
 * as in the browser — a signup that arrives without it is refused rather than
 * quietly accepted, because an account created without consent has no basis
 * for the very first thing it does (the onboarding questionnaire).
 *
 * `src/components/legal/privacy-policy.tsx` is the document being consented to;
 * the form links to both it and the terms.
 */
export const consentSchema = z.literal("on", {
  message: "Potvrdi da si pročitao/la uslove i politiku privatnosti.",
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  /** Optional (5.1.1(v)) -- `null` from `normalizePhone` means "left blank",
   * and a blank field must never fail the form. A number that WAS typed is
   * still held to E.164. */
  phone: phoneSchema.nullable(),
  consent: consentSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  // Login intentionally does not re-validate password *strength* -- an
  // existing account may predate a policy change. Only presence is checked;
  // Supabase itself is the source of truth for whether it is correct
  // (AS-017: wrong password must map to the same generic message as a
  // nonexistent email, not a client-side validation error).
  password: z.string().min(1, "Unesi lozinku."),
});

/** The "forgot password" request form -- only an email is collected. */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * The "set a new password" form the recovery email lands on. Reuses the same
 * 8-char floor as signup (`passwordSchema`) and requires a matching
 * confirmation so a mistyped new password can't silently lock the user out.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Ponovi novu lozinku."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lozinke se ne poklapaju.",
    path: ["confirmPassword"],
  });

/**
 * The in-app signup confirmation form: email (carried hidden from the notice
 * page) + the 6-digit code from the confirmation email. Digits only, exactly 6
 * -- matches GoTrue's `{{ .Token }}` OTP so a user can confirm without ever
 * leaving the installed PWA.
 */
export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Unesi 6-cifreni kod iz mejla."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
