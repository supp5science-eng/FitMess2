import { NextResponse, type NextRequest } from "next/server";

import { isEmailVerified } from "@/lib/auth/core";
import { isMobileUserAgent } from "@/lib/device/is-mobile";
import {
  decideRouteAccess,
  VERIFY_EMAIL_NOTICE_PATH,
} from "@/lib/auth/route-protection";
import { updateSession } from "@/lib/supabase/middleware";

/** The phone-only gate route (see `src/app/samo-za-telefon/page.tsx`). */
const PHONE_ONLY_PATH = "/samo-za-telefon";

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

  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const authenticated = Boolean(user);
  const verified = authenticated && isEmailVerified(user);

  // Only spend a DB round trip on the profile checks once we already know the
  // user is authenticated + verified -- an anonymous or unverified visitor is
  // redirected before onboarding/phone status is ever relevant. One query
  // fetches both the onboarding marker and the phone (Google users lack it).
  let onboarded = false;
  let hasPhone = true;
  if (verified && user) {
    const { data } = await supabase
      .from("profiles")
      .select("onboarded_at, phone")
      .eq("user_id", user.id)
      .maybeSingle();
    onboarded = Boolean(data?.onboarded_at);
    // Only Google (OAuth) users are routed through the /telefon gate: they
    // never saw the signup form's phone field. Email/password users give a
    // phone at signup, and -- crucially -- legacy email accounts created
    // BEFORE the phone field existed have phone = null but must NEVER be walled
    // out of the whole app. So the phone requirement counts as met for any
    // non-Google user, regardless of whether a phone is on file.
    const signedUpWithGoogle = user.app_metadata?.provider === "google";
    hasPhone = signedUpWithGoogle ? Boolean(data?.phone) : true;
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
    if (decision.to === VERIFY_EMAIL_NOTICE_PATH && user?.email) {
      url.searchParams.set("email", user.email);
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
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
