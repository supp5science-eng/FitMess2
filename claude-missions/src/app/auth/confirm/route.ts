import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation (signup, email-change, recovery) via the stateless
 * `token_hash` + `verifyOtp` flow.
 *
 * Why this exists SEPARATELY from `/auth/callback`: the callback route uses
 * `exchangeCodeForSession`, which is the PKCE/OAuth path and needs the
 * `code_verifier` cookie set in the browser that STARTED the flow. Email
 * confirmation links are routinely opened in a different browser/device than
 * the one used to sign up — e.g. sign up inside the installed PWA, then open
 * the email in Safari — where that cookie does not exist, so
 * `exchangeCodeForSession` fails there and bounces the user to
 * `/prijava?greska=potvrda` instead of into the app. `verifyOtp` with a
 * `token_hash` carries no such requirement: it works from any context, which
 * is exactly what an email link needs.
 *
 * Requires the Supabase "Confirm signup" email template to point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * On success we redirect to `/danas`; the route-protection middleware (F013)
 * then bounces a verified-but-not-yet-onboarded user on to `/onboarding`, so
 * a fresh signup lands on the welcome + questionnaire as intended.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/danas";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No token, or verification failed (expired / already-used link) -- send the
  // visitor to login with the same generic Serbian notice the callback uses,
  // never exposing why it failed.
  return NextResponse.redirect(`${origin}/prijava?greska=potvrda`);
}
