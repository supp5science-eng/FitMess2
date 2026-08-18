"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";

/**
 * The one place the browser-side OAuth handshake lives, shared by the Google
 * button (F012 / AS-010) and the Sign in with Apple button that App Review
 * required under guideline 4.8.
 *
 * Deliberately a plain client-side call to `supabase.auth.signInWithOAuth`
 * rather than a Server Action -- the whole point of this call is that the
 * *browser* itself navigates away to the provider's consent screen (the
 * browser `@supabase/ssr` client does this internally once it gets a `url`
 * back with the default `skipBrowserRedirect: false`), which only makes sense
 * triggered from client-side code.
 *
 * `redirectTo` points at the same `/auth/callback` route handler F011 built
 * (`src/app/auth/callback/route.ts`) -- it calls `exchangeCodeForSession`
 * unconditionally for any `code` it receives, regardless of which provider
 * produced it, so adding a second provider needed no callback-route change.
 *
 * `window.location.origin` (not a request header, since this never runs on the
 * server) gives the correct origin in dev (`http://localhost:3000`) and in
 * production without a new env var, mirroring `emailRedirectOrigin()` in
 * `./actions.ts`.
 *
 * ## The native shell
 *
 * Inside the Capacitor shell this navigation leaves fitmess.app, and Capacitor
 * cancels any navigation to a host that is not in `server.allowNavigation`,
 * handing the URL to the system browser instead -- which would sign the user
 * in inside Safari and leave the app sitting on the login screen. Both
 * providers' hosts are therefore listed in `capacitor.config.ts`; that list
 * and this hook are two halves of one mechanism (see the comment there).
 */
export type OAuthProvider = "apple" | "google";

export type OAuthSignInState = {
  /** Serbian, never the raw provider/Supabase error text. */
  error: string | null;
  /** True from the click until the browser navigates away (or fails). */
  pending: boolean;
  signIn: () => Promise<void>;
};

export function useOAuthSignIn(
  provider: OAuthProvider,
  /**
   * Extra query params for the provider's authorize URL. Google gets
   * `prompt=select_account` so a browser already signed into one Google
   * account still offers the account chooser; Apple has no equivalent and is
   * passed nothing.
   */
  queryParams?: Record<string, string>
): OAuthSignInState {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(queryParams ? { queryParams } : {}),
      },
    });

    if (oauthError) {
      // Never surface the provider's raw error text -- the same
      // never-technical Serbian-error convention F011 established in
      // `@/lib/auth/errors`. A browser-side navigation normally happens before
      // this branch is ever reached; it is only hit if the OAuth request
      // couldn't even be started (provider not enabled, network failure).
      setError(SR_AUTH_MESSAGES.generic);
      setPending(false);
    }
  }

  return { error, pending, signIn };
}
