"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";

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
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ili</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Preusmeravanje na Google…" : "Nastavi sa Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
