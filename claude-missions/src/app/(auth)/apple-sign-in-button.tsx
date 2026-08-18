"use client";

import { useT } from "@/components/i18n/locale-provider";

import { useOAuthSignIn } from "./use-oauth-sign-in";

/** The Apple mark, single-path and `currentColor` so it inherits the button's
 * white foreground. Apple's brand guidelines allow the mark in white on a
 * black button, which is what `.auth-btn-apple` renders. */
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/**
 * "Nastavi sa Apple nalogom" -- Sign in with Apple, shown above the Google
 * button on `/prijava` and `/registracija`.
 *
 * ## Why it exists
 *
 * App Review rejected FitMess under **guideline 4.8 (Design - Login
 * Services)** on 17.08.2026: an app that offers a third-party login service
 * must offer, *as an equivalent option*, another login service that limits
 * collection to name + email, lets the user keep their email private, and does
 * not collect in-app interactions for advertising without consent. Google
 * sign-in alone does not satisfy that, and -- this is the part that is easy to
 * get wrong -- neither does our own email/password registration: the guideline
 * asks for another login *service*, not for a first-party account.
 *
 * "Equivalent" is also a placement requirement, not just an existence one.
 * This button therefore sits on the same two screens as Google, in the same
 * size and style, first rather than hidden behind a "more options" affordance.
 *
 * ## What it means for the rest of the app
 *
 * Apple offers **Hide My Email**, so a perfectly normal account can arrive
 * with an address like `abc123@privaterelay.appleid.com`. Nothing downstream
 * may treat that as suspicious, and nothing may demand a *second* identifier
 * to make up for it -- which is exactly why the phone-capture gate became
 * skippable in the same change (guideline 5.1.1(v)).
 *
 * Apple also sends the user's name only on the FIRST authorization and never
 * again. FitMess never asked for a name, so there is nothing to lose here; if
 * a display name is ever added, it has to be captured on that first callback.
 */
export function AppleSignInButton() {
  const { t } = useT();
  // No `queryParams`: Apple has no `prompt=select_account` equivalent, and an
  // unknown parameter on the authorize URL is an `invalid_request` from Apple
  // rather than something it politely ignores.
  const { error, pending, signIn } = useOAuthSignIn("apple");

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="auth-btn auth-btn-apple"
        onClick={signIn}
        disabled={pending}
      >
        <AppleLogo />
        {pending ? t("auth.oauth.appleRedirecting") : t("auth.oauth.apple")}
      </button>
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
