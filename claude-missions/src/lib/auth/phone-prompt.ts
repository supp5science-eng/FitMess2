/**
 * Whether the one-time "leave us your phone number" ask still has anything to
 * ask — the pure decision behind the `/telefon` gate in `src/middleware.ts`.
 *
 * ## Why this stopped being a wall
 *
 * The phone number used to be mandatory: required on the signup form, and
 * enforced for OAuth users by a `/telefon` page they could not get past. That
 * is a rejection under **App Store guideline 5.1.1(v)** — an app may not
 * require personal information that is not directly relevant to its core
 * functionality, and a calorie tracker plainly does not need a phone number to
 * count calories.
 *
 * It also collided head-on with Sign in with Apple, which App Review required
 * under guideline 4.8 in the same rejection: Apple's **Hide My Email** exists
 * precisely so a person can create an account without handing over a reachable
 * address. Walling that person behind "now give us your phone number" hands
 * back with one screen exactly what the login option was designed to protect.
 *
 * So the number is now genuinely optional. It is asked for **once**, with a
 * visible "Preskoči", and never again on that device. It can be added or
 * removed at any time from `/profil/telefon`.
 *
 * ## Why a cookie and not a column
 *
 * "I was asked and said no" is a UI preference, not user data: it changes
 * nothing about the account, expires harmlessly, and costs a migration plus a
 * write on a path that must stay fast. Worst case if the cookie is cleared,
 * the user sees one optional, skippable screen a second time. Compare that to
 * the cost of getting a schema change wrong on the auth path.
 *
 * The value is the user id, not `"1"`, so the answer is only trusted for the
 * exact account it was issued to — the same rule the `fm_gate` cookie in
 * `src/middleware.ts` follows, and for the same reason: two accounts sharing
 * one phone must not share one answer.
 */

/** Cookie remembering that this user already answered the phone ask. */
export const PHONE_PROMPT_COOKIE = "fm_tel";

/** ~400 days — the upper bound browsers honour for a persistent cookie. */
export const PHONE_PROMPT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * The auth providers whose users never saw a phone field at signup, and are
 * therefore the only ones the ask has anything to say to. Email/password
 * signups are offered the (optional) field on the registration form itself.
 */
const OAUTH_PROVIDERS: readonly string[] = ["apple", "google"];

export type PhonePromptInput = {
  /** `app_metadata.provider` for the signed-in user. */
  provider: string | null;
  /** `profiles.phone` — a number already on file. */
  phone: string | null | undefined;
  /** The `fm_tel` cookie value on this request, if any. */
  promptCookie: string | null | undefined;
  /** The signed-in user's id, which the cookie must match to count. */
  userId: string;
};

/**
 * `true` when the `/telefon` ask has nothing left to do — i.e. the middleware
 * should let the request through.
 *
 * Note the name: this answers "is this gate satisfied", NOT "does this user
 * have a phone number". Those are different questions now, and conflating them
 * is how an optional field turns back into a mandatory one.
 */
export function hasClearedPhonePrompt({
  provider,
  phone,
  promptCookie,
  userId,
}: PhonePromptInput): boolean {
  // Email/password users were already offered the field at signup. Legacy
  // accounts created before the field existed have `phone = null` and must
  // never be walled out of the app either.
  if (!provider || !OAUTH_PROVIDERS.includes(provider)) return true;

  if (phone) return true;

  return Boolean(promptCookie) && promptCookie === userId;
}
