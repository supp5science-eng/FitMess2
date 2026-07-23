import { NextResponse, type NextRequest } from "next/server";

import { isMobileUserAgent } from "@/lib/device/is-mobile";
import {
  decideRouteAccess,
  VERIFY_EMAIL_NOTICE_PATH,
} from "@/lib/auth/route-protection";
import { updateSession } from "@/lib/supabase/middleware";

/** The phone-only gate route (see `src/app/samo-za-telefon/page.tsx`). */
const PHONE_ONLY_PATH = "/samo-za-telefon";

/**
 * Cookie that caches "this user has cleared both onboarding + phone gates."
 * Both are one-way, permanent states (a user never un-onboards, and a phone is
 * never removed), so once set we can skip the per-navigation `profiles` round
 * trip entirely. The value is the user id, so the cache is only trusted for
 * the exact user it was issued to -- a different (or re-registered) account
 * won't match and falls back to a fresh DB check.
 */
const GATE_COOKIE = "fm_gate";
/** ~400 days -- the upper bound browsers honour for a persistent cookie. */
const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * F013: the app-wide route-protection boundary (AS-011, AS-012).
 *
 * Refreshes the session cookie via `updateSession` (must run on every
 * request that isn't excluded by `config.matcher` -- skipping it can cause
 * random sign-outs, per the Supabase SSR docs), resolves the current user's
 * verification + onboarding state, and delegates the actual allow/redirect
 * decision to the framework-free `decideRouteAccess` in
 * `@/lib/auth/route-protection` (unit-tested in isolation there).
 *
 * This is the enforcement point -- "This feature IS the auth/access
 * boundary; enforced server-side" per the clarified spec. Nothing here
 * trusts a locally-decoded JWT: `updateSession` resolves `user` via
 * `auth.getUser()`, which re-validates against Supabase Auth's servers.
 */
export async function middleware(request: NextRequest) {
  // Phone-only gate (runs before any auth/session work). FitMess is designed
  // and shipped for phones only: non-mobile visitors are redirected to the
  // "open it on your phone" gate for EVERY route, before the requested page
  // executes, so desktop never triggers the app's data fetching. Mobile
  // visitors who land on the gate URL are bounced back into the app.
  const isMobile = isMobileUserAgent(request.headers.get("user-agent"));
  const onGate = request.nextUrl.pathname === PHONE_ONLY_PATH;

  if (!isMobile && !onGate) {
    const url = request.nextUrl.clone();
    url.pathname = PHONE_ONLY_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (isMobile && onGate) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!isMobile && onGate) {
    // Desktop viewing the gate itself: serve it directly, no session refresh.
    return NextResponse.next();
  }

  const { response, claims, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const authenticated = Boolean(claims);
  // The project requires email confirmation, so Supabase never issues a
  // session to an unverified account (proven by the route-protection
  // integration test: an unverified user "has no session at all"). A present,
  // locally-verified token therefore implies a verified email -- which lets us
  // avoid `getUser()`'s network call while keeping the exact same access
  // decisions.
  const verified = authenticated;

  // Only spend a DB round trip on the profile checks once we already know the
  // user is authenticated + verified -- an anonymous or unverified visitor is
  // redirected before onboarding/phone status is ever relevant.
  let onboarded = false;
  let hasPhone = true;
  if (verified && claims) {
    // Fast path: if the gate cookie was issued to THIS user, both gates are
    // already permanently cleared -- skip the `profiles` round trip entirely.
    const gateHit = request.cookies.get(GATE_COOKIE)?.value === claims.sub;
    if (gateHit) {
      onboarded = true;
      hasPhone = true;
    } else {
      // One query fetches both the onboarding marker and the phone (Google
      // users lack it).
      const { data } = await supabase
        .from("profiles")
        .select("onboarded_at, phone")
        .eq("user_id", claims.sub)
        .maybeSingle();
      onboarded = Boolean(data?.onboarded_at);
      // Only Google (OAuth) users are routed through the /telefon gate: they
      // never saw the signup form's phone field. Email/password users give a
      // phone at signup, and -- crucially -- legacy email accounts created
      // BEFORE the phone field existed have phone = null but must NEVER be
      // walled out of the whole app. So the phone requirement counts as met
      // for any non-Google user, regardless of whether a phone is on file.
      const signedUpWithGoogle = claims.provider === "google";
      hasPhone = signedUpWithGoogle ? Boolean(data?.phone) : true;

      // Cache the cleared-gates state so subsequent navigations take the fast
      // path above. Bound to the user id; only set once BOTH gates pass.
      if (onboarded && hasPhone) {
        response.cookies.set(GATE_COOKIE, claims.sub, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: GATE_COOKIE_MAX_AGE,
        });
      }
    }
  }

  const decision = decideRouteAccess({
    pathname,
    isAuthenticated: authenticated,
    isEmailVerified: verified,
    isOnboarded: onboarded,
    hasPhone,
  });

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    // Prefill the resend-confirmation form with the signed-in-but-unverified
    // user's own email -- a convenience, not a security decision (the value
    // only ever comes from the already-authenticated session, never from
    // request input).
    if (decision.to === VERIFY_EMAIL_NOTICE_PATH && claims?.email) {
      url.searchParams.set("email", claims.email);
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excludes Next.js internals, the favicon, the PWA manifest, and common
  // static-asset extensions so the session-refresh + auth/onboarding lookup
  // above only runs for actual page/route navigations, per the clarified
  // spec's "keep the middleware matcher efficient" instruction. Pattern
  // follows Supabase's own Next.js SSR guide
  // (https://supabase.com/docs/guides/auth/server-side/nextjs).
  // `api/cron` is excluded too: those routes are invoked machine-to-machine
  // (Supabase pg_cron via pg_net, no cookies, non-mobile UA) and guard
  // themselves with a shared-secret header instead — running the phone gate
  // + session refresh on them would only redirect the scheduler away.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
