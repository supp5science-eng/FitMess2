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

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
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

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
