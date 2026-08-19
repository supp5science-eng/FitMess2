"use client";

import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";
import { signInWithGoogleNatively } from "@/lib/auth/google-native";

import { useOAuthSignIn } from "./use-oauth-sign-in";

/** Official multi-color Google "G" mark for the sign-in button. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * The shell's engine for the same button: the platform account picker, then
 * Supabase, then a FULL page load so the middleware re-runs against the fresh
 * session cookies and applies the same gates any other sign-in goes through.
 *
 * `pending` is never cleared on success on purpose — the page is on its way
 * out, and re-enabling the button under a user who is already signed in only
 * invites a second tap.
 */
function useNativeGoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogleNatively();
      window.location.assign("/danas");
    } catch {
      // Closing the sheet arrives here too, which is why this says nothing
      // about what went wrong: "you cancelled" and "Google refused" are the
      // same event to us, and the generic Serbian message covers both.
      setError(SR_AUTH_MESSAGES.generic);
      setPending(false);
    }
  }

  return { error, pending, signIn };
}

/**
 * F012 / AS-010: "Nastavi sa Google" button, shared by `/prijava` and
 * `/registracija` through `SocialSignIn`.
 *
 * The OAuth handshake itself moved into `useOAuthSignIn` when Sign in with
 * Apple was added (guideline 4.8) -- two buttons doing the same handshake in
 * two files is how one of them quietly stops matching the other. The divider
 * above the buttons moved to `social-sign-in.tsx` for the same reason: there
 * is one "ili" for the whole group, not one per provider.
 *
 * Two engines now sit behind it — see `native` below.
 */

export function GoogleSignInButton({ native = false }: { native?: boolean }) {
  const { t } = useT();
  const web = useOAuthSignIn("google", {
    // Always show Google's account chooser. Without this, once the browser is
    // already signed into a single Google account, Google silently reuses it
    // and bounces straight back -- giving the user no chance to pick which
    // account.
    prompt: "select_account",
  });
  const nativeFlow = useNativeGoogleSignIn();

  // Same button, two engines. Inside the shell the web view never goes to
  // Google at all (`@/lib/auth/google-native` explains why); everywhere else
  // this is the redirect handshake it has always been.
  const { error, pending, signIn } = native ? nativeFlow : web;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="auth-btn auth-btn-google"
        onClick={signIn}
        disabled={pending}
      >
        <GoogleLogo />
        {pending ? t("auth.oauth.googleRedirecting") : t("auth.oauth.google")}
      </button>
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
