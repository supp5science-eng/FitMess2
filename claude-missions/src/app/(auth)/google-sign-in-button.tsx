"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";

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
 * F012 / AS-010: "Nastavi sa Google" button, shared by `/prijava` and
 * `/registracija`.
 *
 * Deliberately a plain client-side call to
 * `supabase.auth.signInWithOAuth({ provider: "google", ... })` rather than a
 * Server Action -- the whole point of this call is that the *browser* itself
 * navigates away to Google's consent screen (the browser `@supabase/ssr`
 * client does this internally once it gets a `url` back with the default
 * `skipBrowserRedirect: false`), which only makes sense triggered from
 * client-side code. `redirectTo` points at the same `/auth/callback` route
 * handler F011 already built (`src/app/auth/callback/route.ts`) -- it calls
 * `exchangeCodeForSession` unconditionally for any `code` it receives,
 * regardless of which provider produced it, so no callback-route changes
 * were needed for this feature; reusing it here is what "wire the
 * client-side OAuth flow" means for this feature per its run instructions.
 *
 * `window.location.origin` (not a request header, since this never runs on
 * the server) gives the correct origin in dev
 * (`http://localhost:3000`, already in the live project's `uri_allow_list`
 * per F011) and after the eventual Vercel deploy without a new env var,
 * mirroring `emailRedirectOrigin()`'s reasoning in `../actions.ts`.
 */
export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      // Never surface Google/Supabase's raw error text -- same
      // never-technical Serbian-error convention F011 established in
      // `@/lib/auth/errors`. A browser-side navigation to Google normally
      // happens before this branch is ever reached; it's only hit if the
      // OAuth request itself couldn't even be started (e.g. provider
      // misconfiguration, network failure).
      setError(SR_AUTH_MESSAGES.generic);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="auth-or" aria-hidden="true">
        <span>ili</span>
      </div>
      <button
        type="button"
        className="auth-btn auth-btn-google"
        onClick={handleClick}
        disabled={pending}
      >
        <GoogleLogo />
        {pending ? "Preusmeravanje na Google…" : "Nastavi sa Google"}
      </button>
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
