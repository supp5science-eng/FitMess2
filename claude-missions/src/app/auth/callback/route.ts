import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * F011: exchanges the `code` query param from a Supabase confirmation-email
 * link for a real session cookie (the standard `@supabase/ssr` App Router
 * pattern -- https://supabase.com/docs/guides/auth/server-side/nextjs).
 *
 * The confirmation link a user clicks (Supabase's default "Confirm signup"
 * template) verifies the token server-side, then redirects here with
 * `?code=...`; `exchangeCodeForSession` turns that one-time code into a
 * session and -- via `createClient()`'s cookie `setAll` -- writes it as an
 * HTTP-only cookie on the response, matching this feature's "State
 * location: HTTP-only cookies via @supabase/ssr" clarified answer. Once
 * this succeeds, `auth.users.email_confirmed_at` is set, so the user is now
 * a confirmed user with a real session -- the AS-009 gate in
 * `@/lib/auth/core`'s `signInEmailPassword` no longer applies to them going
 * forward.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/danas";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/already-used link, etc.) --
  // send the visitor to login with a generic Serbian notice rather than
  // exposing why the exchange failed.
  return NextResponse.redirect(`${origin}/prijava?greska=potvrda`);
}
